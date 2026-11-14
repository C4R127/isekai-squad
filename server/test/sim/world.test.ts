import { describe, expect, it } from "vitest";
import { MAX_ENEMIES } from "@isekai/shared";
import { World, activePlayers } from "../../src/sim/world";
import { quietWorld } from "./helpers";

describe("World", () => {
  it("cada clase empieza con su vida y mirando a la derecha", () => {
    const w = quietWorld();
    const g = w.addPlayer("g", "G", "guerrero");
    const m = w.addPlayer("m", "M", "maga");
    expect([g.hp, g.maxHp]).toEqual([130, 130]);
    expect([m.hp, m.maxHp]).toEqual([100, 100]);
    expect(g.facing).toEqual({ x: 1, y: 0 });
    expect({ x: g.x, y: g.y }).not.toEqual({ x: m.x, y: m.y });
  });

  it("el jugador se mueve a 80 px/s y mira hacia donde camina", () => {
    const w = quietWorld();
    const p = w.addPlayer("a", "A", "guerrero");
    const y0 = p.y;
    w.setInput("a", { dx: 0, dy: -1 });
    w.step(50);
    expect(p.y).toBeCloseTo(y0 - 4);
    expect(p.facing).toEqual({ x: 0, y: -1 });
    w.setInput("a", { dx: 0, dy: 0 });
    w.step(50);
    expect(p.facing).toEqual({ x: 0, y: -1 });
  });

  it("un jugador desconectado no se mueve ni cuenta como activo", () => {
    const w = quietWorld();
    const p = w.addPlayer("a", "A", "guerrero");
    w.setInput("a", { dx: 1, dy: 0 });
    w.setConnected("a", false);
    const x0 = p.x;
    w.step(50);
    expect(p.x).toBe(x0);
    expect(activePlayers(w)).toHaveLength(0);
    w.setInput("a", { dx: 1, dy: 0 });
    expect(p.input).toEqual({ dx: 0, dy: 0 });
  });

  it("nunca hay más de 150 enemigos", () => {
    const w = quietWorld();
    for (let i = 0; i < MAX_ENEMIES; i++) expect(w.spawnEnemy("slime", 100, 100)).not.toBeNull();
    expect(w.spawnEnemy("slime", 100, 100)).toBeNull();
    expect(w.enemies.size).toBe(MAX_ENEMIES);
  });

  it("en derrota la simulación no avanza", () => {
    const w = new World();
    w.addPlayer("a", "A", "guerrero");
    w.phase = "defeat";
    expect(w.step(50)).toEqual([]);
    expect(w.elapsedMs).toBe(0);
  });

  it("quitar a un jugador libera su punto de aparición", () => {
    const w = quietWorld();
    const a = w.addPlayer("a", "A", "guerrero");
    const spot = { x: a.x, y: a.y };
    w.removePlayer("a");
    const b = w.addPlayer("b", "B", "maga");
    expect({ x: b.x, y: b.y }).toEqual(spot);
    expect(w.players.size).toBe(1);
  });
});
