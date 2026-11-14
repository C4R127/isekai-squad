import { describe, expect, it } from "vitest";
import { distance } from "@isekai/shared";
import { playerAt, quietWorld, run } from "./helpers";

const DEG = Math.PI / 180;

describe("Guerrero: corte en arco", () => {
  it("corta cada 0.8 s hacia donde mira y daña al enemigo de delante", () => {
    const w = quietWorld();
    const g = playerAt(w, "g", 400, 400);
    g.invulnerableMs = 1e12;
    const slime = w.spawnEnemy("slime", 430, 400)!;

    expect(run(w, 750).filter((e) => e.type === "slash")).toHaveLength(0);
    const events = run(w, 50);
    expect(events).toContainEqual({ type: "slash", x: 400, y: 400, angle: 0 });
    expect(events.some((e) => e.type === "hit")).toBe(true);
    expect(slime.hp).toBe(8);

    const later = run(w, 800);
    expect(w.enemies.has(slime.id)).toBe(false);
    expect(later.some((e) => e.type === "enemyDied" && e.kind === "slime")).toBe(true);
  });

  it("golpea a todos los enemigos del arco y a ninguno de detrás", () => {
    const w = quietWorld();
    const g = playerAt(w, "g", 400, 400);
    g.invulnerableMs = 1e12;
    const front = [w.spawnEnemy("goblin", 430, 400)!, w.spawnEnemy("goblin", 425, 385)!, w.spawnEnemy("goblin", 425, 415)!];
    const behind = w.spawnEnemy("goblin", 360, 400)!;
    run(w, 800);
    for (const e of front) expect(e.hp).toBe(18);
    expect(behind.hp).toBe(30);
  });

  it("corta aunque no haya enemigos", () => {
    const w = quietWorld();
    playerAt(w, "g", 400, 400);
    expect(run(w, 2400).filter((e) => e.type === "slash")).toHaveLength(3);
  });

  it("quieto, corta hacia su última dirección", () => {
    const w = quietWorld();
    playerAt(w, "g", 400, 400);
    w.setInput("g", { dx: 0, dy: -1 });
    w.step(50);
    w.setInput("g", { dx: 0, dy: 0 });
    const slash = run(w, 800).find((e) => e.type === "slash");
    expect(slash && slash.type === "slash" && slash.angle).toBeCloseTo(-Math.PI / 2);
  });
});

describe("Maga: orbe que busca", () => {
  it("lanza un orbe por segundo hacia el enemigo más cercano", () => {
    const w = quietWorld();
    const m = playerAt(w, "m", 400, 400, "maga");
    m.invulnerableMs = 1e12;
    w.spawnEnemy("goblin", 400, 700);
    run(w, 950);
    expect(w.projectiles.size).toBe(0);
    w.step(50);
    expect(w.projectiles.size).toBe(1);
    const orb = [...w.projectiles.values()][0];
    expect({ x: orb.x, y: orb.y }).toEqual({ x: 400, y: 400 });
    expect(orb.angle).toBeCloseTo(Math.PI / 2);

    w.step(50);
    expect(distance(orb, { x: 400, y: 400 })).toBeCloseTo(8); // 160 px/s
  });

  it("al tocar a un enemigo le quita 10 y desaparece", () => {
    const w = quietWorld();
    const m = playerAt(w, "m", 400, 400, "maga");
    m.invulnerableMs = 1e12;
    const goblin = w.spawnEnemy("goblin", 400, 500)!;
    const events = run(w, 2000);
    expect(goblin.hp).toBeLessThanOrEqual(20);
    expect(events.some((e) => e.type === "hit")).toBe(true);
  });

  it("un orbe solo daña a un enemigo", () => {
    const w = quietWorld();
    const m = playerAt(w, "m", 400, 400, "maga");
    m.invulnerableMs = 1e12;
    const a = w.spawnEnemy("goblin", 400, 460)!;
    const b = w.spawnEnemy("goblin", 400, 460)!;
    run(w, 1000); // nace el orbe
    m.attackTimerMs = -1e12; // y no lanza más
    run(w, 900);
    expect(w.projectiles.size).toBe(0);
    expect(a.hp + b.hp).toBe(50);
  });

  it("sin enemigos no dispara", () => {
    const w = quietWorld();
    playerAt(w, "m", 400, 400, "maga");
    run(w, 5000);
    expect(w.projectiles.size).toBe(0);
  });

  it("gira hacia su objetivo como máximo 18° por paso", () => {
    const w = quietWorld();
    const m = playerAt(w, "m", 400, 400, "maga");
    m.invulnerableMs = 1e12;
    const goblin = w.spawnEnemy("goblin", 700, 400)!;
    run(w, 1000);
    m.attackTimerMs = -1e12;
    const orb = [...w.projectiles.values()][0];
    expect(orb.angle).toBeCloseTo(0);
    goblin.x = orb.x;
    goblin.y = orb.y + 300; // ahora el objetivo queda a 90°
    w.step(50);
    expect(orb.angle).toBeCloseTo(18 * DEG);
    w.step(50);
    expect(orb.angle).toBeCloseTo(36 * DEG);
  });

  it("sin objetivo sigue recto y desaparece a los 2 s", () => {
    const w = quietWorld();
    const m = playerAt(w, "m", 400, 400, "maga");
    m.invulnerableMs = 1e12;
    const goblin = w.spawnEnemy("goblin", 700, 400)!;
    run(w, 1000);
    m.attackTimerMs = -1e12;
    w.enemies.delete(goblin.id);
    const orb = [...w.projectiles.values()][0];
    run(w, 1000);
    expect(orb.y).toBeCloseTo(400);
    expect(orb.x).toBeCloseTo(560);
    expect(w.projectiles.size).toBe(1);
    run(w, 1000);
    expect(w.projectiles.size).toBe(0);
  });

  it("un orbe que sale del mapa desaparece", () => {
    const w = quietWorld();
    const m = playerAt(w, "m", 30, 400, "maga");
    m.invulnerableMs = 1e12;
    const goblin = w.spawnEnemy("goblin", 12, 400)!;
    w.step(50);
    m.attackTimerMs = 1000;
    goblin.x = 12; // a la izquierda de la maga
    w.step(50);
    expect(w.projectiles.size).toBe(1);
    m.attackTimerMs = -1e12;
    w.enemies.delete(goblin.id);
    run(w, 500);
    expect(w.projectiles.size).toBe(0);
  });
});

describe("quién ataca", () => {
  it("un jugador caído o desconectado no ataca ni acumula tiempo", () => {
    const w = quietWorld();
    const g = playerAt(w, "g", 400, 400);
    playerAt(w, "otro", 900, 600).attackTimerMs = -1e12;
    g.downed = true;
    expect(run(w, 2000).filter((e) => e.type === "slash")).toHaveLength(0);
    expect(g.attackTimerMs).toBe(0);
    g.downed = false;
    w.setConnected("g", false);
    expect(run(w, 2000).filter((e) => e.type === "slash")).toHaveLength(0);
    expect(g.attackTimerMs).toBe(0);
  });
});
