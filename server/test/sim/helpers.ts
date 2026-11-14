import type { HeroClass } from "@isekai/shared";
import { World, type PlayerSim } from "../../src/sim/world";

/** Generador de azar repetible, para pruebas con "azar variado". */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Avanza la simulación `ms` milisegundos en pasos de 50 ms y junta los eventos. */
export function run(world: World, ms: number, stepMs = 50) {
  const events = [];
  for (let t = 0; t < ms; t += stepMs) events.push(...world.step(stepMs));
  return events;
}

/** Añade un jugador en una posición concreta. */
export function playerAt(world: World, id: string, x: number, y: number, heroClass: HeroClass = "guerrero"): PlayerSim {
  const p = world.addPlayer(id, id, heroClass);
  p.x = x;
  p.y = y;
  return p;
}

/** Impide que un jugador ataque, para probar otras reglas sin interferencias. */
export function pacify(p: PlayerSim): PlayerSim {
  p.attackTimerMs = -1e12;
  return p;
}

/** Un mundo en el que no aparecen enemigos solos. */
export function quietWorld(random: () => number = () => 0.5): World {
  const world = new World(random);
  world.spawnTimerMs = -1e12;
  return world;
}
