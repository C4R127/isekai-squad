import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { MAP_HEIGHT, MAP_WIDTH, PLAYER_SIZE, PLAYER_SPEED, ROOM_NAME, TICK_MS } from "@isekai/shared";
import appConfig from "../src/app.config";
import type { LevelRoom } from "../src/rooms/LevelRoom";

const STEP = (PLAYER_SPEED * TICK_MS) / 1000;

async function ticks(room: LevelRoom, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await room.waitForNextTimestep();
}

describe("LevelRoom", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  const createRoom = async (): Promise<LevelRoom> => colyseus.createRoom(ROOM_NAME);

  it("al entrar aparece un jugador dentro del mapa con el nombre limpio", async () => {
    const room = await createRoom();
    const c = await colyseus.connectTo(room, { name: "  Kira  ", heroClass: "maga" });
    await room.waitForNextPatch();
    const p = room.state.players.get(c.sessionId)!;
    expect(p.name).toBe("Kira");
    expect(p.heroClass).toBe("maga");
    expect(p.connected).toBe(true);
    expect(p.x).toBeGreaterThanOrEqual(PLAYER_SIZE / 2);
    expect(p.x).toBeLessThanOrEqual(MAP_WIDTH - PLAYER_SIZE / 2);
    expect(p.y).toBeGreaterThanOrEqual(PLAYER_SIZE / 2);
    expect(p.y).toBeLessThanOrEqual(MAP_HEIGHT - PLAYER_SIZE / 2);
  });

  it("opciones vacías o basura dan nombre Héroe y clase guerrero", async () => {
    const room = await createRoom();
    const c = await colyseus.connectTo(room, { name: 123, heroClass: "ninja" });
    const p = room.state.players.get(c.sessionId)!;
    expect(p.name).toBe("Héroe");
    expect(p.heroClass).toBe("guerrero");
  });

  it("dos jugadores no aparecen en el mismo punto", async () => {
    const room = await createRoom();
    const a = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
    const b = await colyseus.connectTo(room, { name: "B", heroClass: "maga" });
    const pa = room.state.players.get(a.sessionId)!;
    const pb = room.state.players.get(b.sessionId)!;
    expect({ x: pa.x, y: pa.y }).not.toEqual({ x: pb.x, y: pb.y });
  });

  it("move desplaza al jugador a PLAYER_SPEED", async () => {
    const room = await createRoom();
    const c = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
    const p = room.state.players.get(c.sessionId)!;
    const x0 = p.x;
    const y0 = p.y;
    c.send("move", { dx: 1, dy: 0 });
    await room.waitForMessage("move");
    await ticks(room, 4);
    expect(p.x - x0).toBeGreaterThanOrEqual(STEP * 3);
    expect(p.x - x0).toBeLessThanOrEqual(STEP * 5);
    expect(p.y).toBe(y0);
  });

  it.each([null, "x", { dx: NaN, dy: 1 }, { dx: "1" }, [], 9e99])(
    "move con %j no mueve ni rompe la sala",
    async (payload) => {
      const room = await createRoom();
      const c = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
      const p = room.state.players.get(c.sessionId)!;
      const x0 = p.x;
      const y0 = p.y;
      c.send("move", payload);
      await room.waitForMessage("move");
      await ticks(room, 3);
      expect({ x: p.x, y: p.y }).toEqual({ x: x0, y: y0 });
      expect(room.state.players.size).toBe(1);
    },
  );

  it("un vector enorme no supera la velocidad máxima", async () => {
    const room = await createRoom();
    const c = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
    const p = room.state.players.get(c.sessionId)!;
    const x0 = p.x;
    c.send("move", { dx: 1000, dy: 0 });
    await room.waitForMessage("move");
    await ticks(room, 4);
    expect(p.x - x0).toBeGreaterThan(0);
    expect(p.x - x0).toBeLessThanOrEqual(STEP * 5);
  });

  it("el quinto jugador es rechazado y los otros cuatro siguen", async () => {
    const room = await createRoom();
    for (let i = 0; i < 4; i++) await colyseus.connectTo(room, { name: `J${i}`, heroClass: "guerrero" });
    await expect(colyseus.sdk.joinById(room.roomId, { name: "J5", heroClass: "maga" })).rejects.toBeTruthy();
    expect(room.state.players.size).toBe(4);
  });

  it("una caída de conexión conserva al jugador y al reconectar recupera su lugar", async () => {
    const room = await createRoom();
    const c = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
    const id = c.sessionId;
    const token = c.reconnectionToken;
    c.send("move", { dx: 1, dy: 0 });
    await room.waitForMessage("move");
    c.reconnection.enabled = false; // la prueba reconecta a mano
    await c.leave(false); // simula una caída
    await ticks(room, 3);
    const p = room.state.players.get(id)!;
    expect(p.connected).toBe(false);
    const xDropped = p.x;
    await ticks(room, 3);
    expect(p.x).toBe(xDropped); // un jugador caído no sigue caminando
    const c2 = await colyseus.sdk.reconnect(token);
    await ticks(room, 1);
    expect(c2.sessionId).toBe(id);
    expect(room.state.players.get(id)!.connected).toBe(true);
    expect(room.state.players.size).toBe(1);
  });

  it("salir a propósito borra al jugador", async () => {
    const room = await createRoom();
    const a = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
    await colyseus.connectTo(room, { name: "B", heroClass: "maga" });
    await a.leave();
    await ticks(room, 2);
    expect(room.state.players.size).toBe(1);
    expect(room.state.players.has(a.sessionId)).toBe(false);
  });

  describe("combate", () => {
    it("al entrar, el jugador trae la vida de su clase y la partida está en curso", async () => {
      const room = await createRoom();
      const g = await colyseus.connectTo(room, { name: "G", heroClass: "guerrero" });
      const m = await colyseus.connectTo(room, { name: "M", heroClass: "maga" });
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("playing");
      const pg = room.state.players.get(g.sessionId)!;
      const pm = room.state.players.get(m.sessionId)!;
      expect([pg.hp, pg.maxHp, pg.downed]).toEqual([130, 130, false]);
      expect([pm.hp, pm.maxHp, pm.downed]).toEqual([100, 100, false]);
    });

    it("aparecen enemigos, con posición entera", async () => {
      const room = await createRoom();
      await colyseus.connectTo(room, { name: "G", heroClass: "guerrero" });
      await ticks(room, 34);
      expect(room.state.enemies.size).toBeGreaterThanOrEqual(1);
      room.state.enemies.forEach((enemy) => {
        expect(["slime", "goblin", "murcielago"]).toContain(enemy.kind);
        expect(Number.isInteger(enemy.x) && Number.isInteger(enemy.y)).toBe(true);
        expect(enemy.hp).toBeGreaterThan(0);
      });
    });

    it("el cliente recibe el efecto del corte del Guerrero", async () => {
      const room = await createRoom();
      const g = await colyseus.connectTo(room, { name: "G", heroClass: "guerrero" });
      const events = await g.waitForMessage("fx");
      expect(events.some((e: { type: string }) => e.type === "slash")).toBe(true);
    });

    it("los orbes de la Maga llegan al estado", async () => {
      const room = await createRoom();
      const m = await colyseus.connectTo(room, { name: "M", heroClass: "maga" });
      const p = room.world.players.get(m.sessionId)!;
      p.invulnerableMs = 1e12;
      room.world.spawnEnemy("goblin", p.x + 250, p.y);
      await ticks(room, 22);
      expect(room.state.projectiles.size).toBeGreaterThanOrEqual(1);
    });

    it("restart en plena partida no hace nada", async () => {
      const room = await createRoom();
      const g = await colyseus.connectTo(room, { name: "G", heroClass: "guerrero" });
      const p = room.world.players.get(g.sessionId)!;
      room.world.spawnEnemy("goblin", p.x + 300, p.y);
      await ticks(room, 2);
      const elapsed = room.world.elapsedMs;
      g.send("restart");
      await room.waitForMessage("restart");
      await ticks(room, 2);
      expect(room.state.enemies.size).toBeGreaterThanOrEqual(1);
      expect(room.world.elapsedMs).toBeGreaterThan(elapsed);
    });

    it("derrota y volver a jugar", async () => {
      const room = await createRoom();
      const g = await colyseus.connectTo(room, { name: "G", heroClass: "guerrero" });
      const p = room.world.players.get(g.sessionId)!;
      room.world.spawnEnemy("goblin", p.x + 300, p.y);
      p.hp = 0;
      await ticks(room, 2);
      expect(room.state.phase).toBe("defeat");
      expect(room.state.players.get(g.sessionId)!.downed).toBe(true);
      const frozen = room.world.elapsedMs;
      await ticks(room, 3);
      expect(room.world.elapsedMs).toBe(frozen);

      g.send("restart", { basura: [1, 2, 3] });
      await room.waitForMessage("restart");
      expect(room.state.phase).toBe("playing");
      expect(room.state.enemies.size).toBe(0);
      const synced = room.state.players.get(g.sessionId)!;
      expect([synced.hp, synced.downed]).toEqual([130, false]);
    });

    it("debug:fill llena la sala hasta 150 enemigos", async () => {
      const room = await createRoom();
      const g = await colyseus.connectTo(room, { name: "G", heroClass: "guerrero" });
      g.send("debug:fill");
      await room.waitForMessage("debug:fill");
      expect(room.state.enemies.size).toBe(150);
    });

    it("mientras espera reconexión, a un jugador no lo dañan", async () => {
      const room = await createRoom();
      const a = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
      await colyseus.connectTo(room, { name: "B", heroClass: "guerrero" });
      const p = room.world.players.get(a.sessionId)!;
      a.reconnection.enabled = false;
      await a.leave(false);
      await ticks(room, 2);
      expect(p.connected).toBe(false);
      room.world.spawnEnemy("goblin", p.x + 5, p.y);
      await ticks(room, 6);
      expect(p.hp).toBe(130);
      expect(room.state.phase).toBe("playing");
    });
  });

  it("GET /health responde ok", async () => {
    const res = await colyseus.http.get("/health");
    expect(res.data).toBe("ok");
  });

  it("GET /health permite consultas desde otro dominio", async () => {
    const res = await colyseus.http.get("/health");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});
