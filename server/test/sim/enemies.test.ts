import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH, distance } from "@isekai/shared";
import { pacify, playerAt, quietWorld, run } from "./helpers";

describe("enemigos", () => {
  it("el slime va directo al jugador a 30 px/s", () => {
    const w = quietWorld();
    pacify(playerAt(w, "a", 400, 400));
    const s = w.spawnEnemy("slime", 500, 400)!;
    w.step(50);
    expect(s.x).toBeCloseTo(498.5);
    expect(s.y).toBeCloseTo(400);
  });

  it("persigue al jugador activo más cercano e ignora a caídos y desconectados", () => {
    const w = quietWorld();
    pacify(playerAt(w, "lejos", 800, 400));
    const cerca = pacify(playerAt(w, "cerca", 450, 400));
    const s = w.spawnEnemy("slime", 500, 400)!;
    w.step(50);
    expect(s.x).toBeLessThan(500);

    cerca.downed = true;
    s.x = 500;
    w.step(50);
    expect(s.x).toBeGreaterThan(500);

    cerca.downed = false;
    w.setConnected("cerca", false);
    s.x = 500;
    w.step(50);
    expect(s.x).toBeGreaterThan(500);
  });

  it("sin jugadores activos, los enemigos se quedan quietos", () => {
    const w = quietWorld();
    const s = w.spawnEnemy("goblin", 500, 400)!;
    run(w, 500);
    expect({ x: s.x, y: s.y }).toEqual({ x: 500, y: 400 });
  });

  it("el murciélago avanza en zigzag", () => {
    const w = quietWorld();
    pacify(playerAt(w, "a", 300, 400));
    const bat = w.spawnEnemy("murcielago", 700, 400)!;
    let maxLateral = 0;
    for (let t = 0; t < 1200; t += 50) {
      w.step(50);
      maxLateral = Math.max(maxLateral, Math.abs(bat.y - 400));
    }
    expect(maxLateral).toBeGreaterThan(5);
    expect(bat.x).toBeLessThan(660);
  });

  it("dos enemigos en el mismo punto se separan", () => {
    const w = quietWorld();
    pacify(playerAt(w, "a", 100, 100));
    const a = w.spawnEnemy("slime", 900, 500)!;
    const b = w.spawnEnemy("slime", 900, 500)!;
    run(w, 500);
    expect(distance(a, b)).toBeGreaterThan(4);
  });

  it("al tocar al jugador le quita vida, con una pausa de 600 ms entre golpes", () => {
    const w = quietWorld();
    const p = pacify(playerAt(w, "a", 400, 400));
    w.spawnEnemy("slime", 390, 400);
    w.step(50);
    expect(p.hp).toBe(122);
    run(w, 550);
    expect(p.hp).toBe(122);
    run(w, 50);
    expect(p.hp).toBe(114);
  });

  it("no toca a quien está lejos, ni a quien es invulnerable", () => {
    const w = quietWorld();
    const p = pacify(playerAt(w, "a", 400, 400));
    w.spawnEnemy("slime", 430, 400); // justo fuera del contacto (24 px)
    w.step(50);
    expect(p.hp).toBe(130);
    p.invulnerableMs = 1000;
    w.spawnEnemy("slime", 395, 400);
    run(w, 500);
    expect(p.hp).toBe(130);
  });

  it("la vida no baja de 0", () => {
    const w = quietWorld();
    const p = pacify(playerAt(w, "a", 400, 400));
    p.hp = 3;
    w.spawnEnemy("goblin", 395, 400);
    w.step(50);
    expect(p.hp).toBe(0);
  });

  it("los enemigos no salen del mapa", () => {
    const w = quietWorld();
    pacify(playerAt(w, "a", 16, 16));
    const enemies = Array.from({ length: 30 }, () => w.spawnEnemy("murcielago", 20, 20)!);
    run(w, 3000);
    for (const e of enemies) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(MAP_WIDTH);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThanOrEqual(MAP_HEIGHT);
    }
  });
});
