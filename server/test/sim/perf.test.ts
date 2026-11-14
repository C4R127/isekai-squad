import { describe, expect, it } from "vitest";
import { ENEMY_KINDS, MAX_ENEMIES } from "@isekai/shared";
import { World } from "../../src/sim/world";
import { seeded } from "./helpers";

describe("rendimiento de la simulación", () => {
  // Un paso dura 50 ms; el límite de 5 ms deja margen para cuando las pruebas corren en paralelo.
  it("4 jugadores y 150 enemigos: menos de 5 ms por paso de media", () => {
    const random = seeded(5);
    const world = new World(random);
    for (const [i, id] of ["a", "b", "c", "d"].entries()) {
      const p = world.addPlayer(id, id, i % 2 === 0 ? "guerrero" : "maga");
      p.invulnerableMs = 1e12;
    }
    const refill = () => {
      while (world.enemies.size < MAX_ENEMIES) {
        world.spawnEnemy(ENEMY_KINDS[Math.floor(random() * 3)], 300 + random() * 840, 150 + random() * 510);
      }
    };
    refill();
    for (let i = 0; i < 20; i++) world.step(50); // calentamiento

    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      refill();
      world.step(50);
    }
    const elapsed = performance.now() - start;
    expect(world.enemies.size).toBeGreaterThan(100);
    console.info(`simulación: ${(elapsed / 200).toFixed(2)} ms por paso`);
    expect(elapsed).toBeLessThan(1000);
  });
});
