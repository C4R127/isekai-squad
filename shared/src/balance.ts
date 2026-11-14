import type { HeroClass } from "./player";

/**
 * Todos los números de combate del juego. Cambiar un valor aquí lo cambia
 * tanto en el servidor como en el cliente.
 */

export type EnemyKind = "slime" | "goblin" | "murcielago";
export const ENEMY_KINDS: readonly EnemyKind[] = ["slime", "goblin", "murcielago"];

export const BASE_HP = 100;

/** damage: daño de cada ataque. attackIntervalMs: tiempo entre ataques. */
export const HEROES: Record<HeroClass, { maxHp: number; attackIntervalMs: number; damage: number }> = {
  guerrero: { maxHp: BASE_HP * 1.3, attackIntervalMs: 800, damage: 12 }, // +30 % de vida
  maga: { maxHp: BASE_HP, attackIntervalMs: 1000, damage: 10 },
};

/** Corte del Guerrero: un arco frente a la dirección de movimiento. */
export const SLASH = { radius: 44, arcDegrees: 120 };

/** Orbe de la Maga: busca al enemigo más cercano. */
export const ORB = { speed: 160, radius: 4, lifetimeMs: 2000, turnDegPerSec: 360 };

/** speed en píxeles por segundo; damage es el daño por contacto; size es el lado en píxeles. */
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; damage: number; size: number }> = {
  slime: { hp: 20, speed: 30, damage: 8, size: 16 },
  goblin: { hp: 30, speed: 55, damage: 10, size: 24 },
  murcielago: { hp: 10, speed: 90, damage: 6, size: 16 },
};

/** Zigzag del murciélago: cada cuánto cambia de lado y cuánto se desvía. */
export const BAT_ZIGZAG = { periodMs: 600, lateral: 0.8 };

/** Tiempo mínimo entre dos golpes del mismo enemigo. */
export const CONTACT_COOLDOWN_MS = 600;

export const REVIVE = { radius: 28, durationMs: 3000, hpFraction: 0.5, invulnerableMs: 2000 };

/** Límite técnico de enemigos vivos por sala. */
export const MAX_ENEMIES = 150;

/**
 * Aparición continua de enemigos (hasta que la etapa 4 traiga las oleadas):
 * el intervalo baja de startIntervalMs a minIntervalMs a lo largo de rampSeconds.
 */
export const SPAWN = {
  startIntervalMs: 1500,
  minIntervalMs: 400,
  rampSeconds: 180,
  minDistance: 220,
  maxDistance: 320,
  /** Nunca aparecen más cerca que esto de un jugador. */
  safeDistance: 200,
  goblinGroup: [3, 5] as const,
  unlockSeconds: { slime: 0, goblin: 30, murcielago: 60 } as Record<EnemyKind, number>,
};

/** Cuánto aumenta la dificultad por cada jugador adicional. */
export const PLAYER_SCALING = { spawnRatePerExtraPlayer: 0.6, hpPerExtraPlayer: 0.25 };

function extraPlayers(players: number): number {
  return Math.max(0, Math.floor(players) - 1);
}

export function enemyHp(kind: EnemyKind, players: number): number {
  return Math.round(ENEMIES[kind].hp * (1 + PLAYER_SCALING.hpPerExtraPlayer * extraPlayers(players)));
}

export function spawnIntervalMs(elapsedMs: number, players: number): number {
  const progress = Math.min(1, Math.max(0, elapsedMs / (SPAWN.rampSeconds * 1000)));
  const base = SPAWN.startIntervalMs + (SPAWN.minIntervalMs - SPAWN.startIntervalMs) * progress;
  return base / (1 + PLAYER_SCALING.spawnRatePerExtraPlayer * extraPlayers(players));
}
