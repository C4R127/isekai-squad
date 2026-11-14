import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH, MAX_ENEMIES, SPAWN, distance, enemyHp } from "@isekai/shared";
import { World } from "../../src/sim/world";
import { pacify, run, seeded } from "./helpers";

describe("generador de enemigos", () => {
  it("sin jugadores activos no aparece nada", () => {
    const w = new World(() => 0.5);
    run(w, 10_000);
    expect(w.enemies.size).toBe(0);
    const p = w.addPlayer("a", "A", "guerrero");
    w.setConnected(p.id, false);
    run(w, 10_000);
    expect(w.enemies.size).toBe(0);
  });

  it("con un jugador, el primer enemigo llega a los 1.5 s y es un slime", () => {
    const w = new World(() => 0.5);
    pacify(w.addPlayer("a", "A", "guerrero"));
    run(w, 1450);
    expect(w.enemies.size).toBe(0);
    run(w, 50);
    expect(w.enemies.size).toBe(1);
    expect([...w.enemies.values()][0].kind).toBe("slime");
  });

  it("los goblins llegan a partir de los 30 s y los murciélagos a partir de los 60 s", () => {
    const w = new World(seeded(7));
    pacify(w.addPlayer("a", "A", "guerrero")).invulnerableMs = 1e12;
    const kindsAt = (untilMs: number) => {
      const seen = new Set<string>();
      while (w.elapsedMs < untilMs) {
        w.step(100);
        for (const e of w.enemies.values()) seen.add(e.kind);
      }
      return seen;
    };
    expect([...kindsAt(29_900)]).toEqual(["slime"]);
    const before60 = kindsAt(59_900);
    expect(before60.has("murcielago")).toBe(false);
    const later = kindsAt(150_000);
    expect(later.has("goblin")).toBe(true);
    expect(later.has("murcielago")).toBe(true);
  });

  it("los goblins aparecen en grupos de 3 a 5, juntos", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = new World(seeded(seed));
      pacify(w.addPlayer("a", "A", "guerrero")).invulnerableMs = 1e12;
      w.elapsedMs = 31_000;
      let goblins: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 2000 && goblins.length === 0; i++) {
        const before = new Set(w.enemies.keys());
        w.step(50);
        goblins = [...w.enemies.values()].filter((e) => !before.has(e.id) && e.kind === "goblin");
      }
      expect(goblins.length).toBeGreaterThanOrEqual(3);
      expect(goblins.length).toBeLessThanOrEqual(5);
      for (const a of goblins) for (const b of goblins) expect(distance(a, b)).toBeLessThan(40);
    }
  });

  it("aparecen dentro del mapa, lejos de los jugadores y con la vida escalada", () => {
    const w = new World(seeded(11));
    const players = ["a", "b", "c"].map((id) => pacify(w.addPlayer(id, id, "guerrero")));
    for (const p of players) p.invulnerableMs = 1e12;
    w.elapsedMs = 70_000;
    let checked = 0;
    for (let i = 0; i < 1200; i++) {
      const before = new Set(w.enemies.keys());
      w.step(50);
      for (const e of w.enemies.values()) {
        if (before.has(e.id)) continue;
        checked++;
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.x).toBeLessThanOrEqual(MAP_WIDTH);
        expect(e.y).toBeGreaterThanOrEqual(0);
        expect(e.y).toBeLessThanOrEqual(MAP_HEIGHT);
        // Los goblins se reparten alrededor del punto elegido, de ahí el margen de 16 px.
        for (const p of players) expect(distance(e, p)).toBeGreaterThanOrEqual(SPAWN.safeDistance - 16);
        expect(e.hp).toBe(enemyHp(e.kind, 3));
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("con 4 jugadores y 4 minutos sin atacar, nunca hay más de 150 enemigos", () => {
    const w = new World(seeded(3));
    for (const id of ["a", "b", "c", "d"]) pacify(w.addPlayer(id, id, "maga")).invulnerableMs = 1e12;
    let max = 0;
    for (let t = 0; t < 240_000; t += 100) {
      w.step(100);
      max = Math.max(max, w.enemies.size);
    }
    expect(max).toBe(MAX_ENEMIES);
  });
});
