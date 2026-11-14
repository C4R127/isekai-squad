import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH } from "@isekai/shared";
import { pacify, playerAt, quietWorld, run } from "./helpers";

function duo() {
  const w = quietWorld();
  const a = pacify(playerAt(w, "a", 400, 400));
  const b = pacify(playerAt(w, "b", 900, 600));
  return { w, a, b };
}

describe("caer", () => {
  it("con 0 de vida el jugador cae: no se mueve, no ataca y deja de ser objetivo", () => {
    const { w, a } = duo();
    w.setInput("a", { dx: 1, dy: 0 });
    a.hp = 0;
    const events = w.step(50);
    expect(events).toContainEqual({ type: "downed", id: "a" });
    expect(a.downed).toBe(true);
    expect(a.input).toEqual({ dx: 0, dy: 0 });

    const x0 = a.x;
    w.setInput("a", { dx: 1, dy: 0 });
    const slime = w.spawnEnemy("slime", 420, 400)!;
    run(w, 500);
    expect(a.x).toBe(x0);
    expect(slime.x).toBeGreaterThan(420); // va por el otro jugador
    expect(w.phase).toBe("playing");
  });

  it("jugando solo, caer es perder", () => {
    const w = quietWorld();
    const a = pacify(playerAt(w, "a", 400, 400));
    a.hp = 0;
    w.step(50);
    expect(w.phase).toBe("defeat");
  });

  it("si caen todos, se pierde", () => {
    const { w, a, b } = duo();
    a.hp = 0;
    w.step(50);
    expect(w.phase).toBe("playing");
    b.hp = 0;
    w.step(50);
    expect(w.phase).toBe("defeat");
  });

  it("un caído más un desconectado es derrota; un caído desconectado con otro en pie, no", () => {
    const first = duo();
    first.a.hp = 0;
    first.w.step(50);
    first.w.setConnected("b", false);
    first.w.step(50);
    expect(first.w.phase).toBe("defeat");

    const second = duo();
    second.a.hp = 0;
    second.w.step(50);
    second.w.setConnected("a", false);
    run(second.w, 500);
    expect(second.w.phase).toBe("playing");
  });

  it("si todos se desconectan sin caer, la partida no se pierde", () => {
    const { w } = duo();
    w.setConnected("a", false);
    w.setConnected("b", false);
    run(w, 500);
    expect(w.phase).toBe("playing");
  });
});

describe("revivir", () => {
  it("un compañero al lado durante 3 s lo levanta con media vida y 2 s de protección", () => {
    const { w, a, b } = duo();
    a.hp = 0;
    w.step(50);
    b.x = 420;
    b.y = 400;
    run(w, 1500);
    expect(a.reviveProgress).toBeCloseTo(0.5);
    expect(a.downed).toBe(true);
    const events = run(w, 1500);
    expect(events).toContainEqual({ type: "revived", id: "a" });
    expect(a.downed).toBe(false);
    expect(a.hp).toBe(65);
    expect(a.invulnerableMs).toBe(2000);
    expect(a.reviveProgress).toBe(0);
  });

  it("si el compañero se aleja, hay que empezar de nuevo", () => {
    const { w, a, b } = duo();
    a.hp = 0;
    w.step(50);
    b.x = 420;
    b.y = 400;
    run(w, 2000);
    b.x = 449; // a 49 px: fuera del radio de 28
    w.step(50);
    expect(a.reviveProgress).toBe(0);
    b.x = 420;
    run(w, 2950);
    expect(a.downed).toBe(true);
    w.step(50);
    expect(a.downed).toBe(false);
  });

  it("si el que revive cae o se desconecta, el progreso se pierde", () => {
    const one = duo();
    const c = pacify(playerAt(one.w, "c", 1200, 700));
    one.a.hp = 0;
    one.w.step(50);
    one.b.x = 420;
    one.b.y = 400;
    run(one.w, 1500);
    one.b.hp = 0;
    one.w.step(50);
    expect(one.a.reviveProgress).toBe(0);
    expect(c.downed).toBe(false);

    const two = duo();
    pacify(playerAt(two.w, "c", 1200, 700));
    two.a.hp = 0;
    two.w.step(50);
    two.b.x = 420;
    two.b.y = 400;
    run(two.w, 1500);
    two.w.setConnected("b", false);
    two.w.step(50);
    expect(two.a.reviveProgress).toBe(0);
  });

  it("un caído no revive a otro", () => {
    const { w, a, b } = duo();
    const c = pacify(playerAt(w, "c", 1200, 700));
    a.hp = 0;
    b.hp = 0;
    b.x = 420;
    b.y = 400;
    run(w, 4000);
    expect(a.downed).toBe(true);
    expect(b.downed).toBe(true);
    expect(c.downed).toBe(false);
  });
});

describe("reiniciar", () => {
  it("deja la partida como al principio, con los mismos jugadores", () => {
    const { w, a, b } = duo();
    w.spawnEnemy("slime", 100, 100);
    w.projectiles.set("o", { id: "o", ownerId: "a", x: 1, y: 1, angle: 0, damage: 1, lifeMs: 500 });
    a.hp = 0;
    b.hp = 0;
    w.step(50);
    expect(w.phase).toBe("defeat");

    w.restart();
    expect(w.phase).toBe("playing");
    expect(w.elapsedMs).toBe(0);
    expect(w.enemies.size).toBe(0);
    expect(w.projectiles.size).toBe(0);
    for (const p of [a, b]) {
      expect(p.downed).toBe(false);
      expect(p.hp).toBe(p.maxHp);
      expect(Math.abs(p.x - MAP_WIDTH / 2)).toBeLessThanOrEqual(40);
      expect(Math.abs(p.y - MAP_HEIGHT / 2)).toBeLessThanOrEqual(40);
    }
    expect(w.step(50)).toEqual([]);
    expect(w.elapsedMs).toBe(50);
  });
});
