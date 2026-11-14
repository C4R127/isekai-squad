import {
  ENEMIES,
  HEROES,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_ENEMIES,
  enemyHp,
  stepPlayer,
  type EnemyKind,
  type HeroClass,
  type MoveMessage,
  type Vec2,
} from "@isekai/shared";
import { stepAttacks, stepProjectiles } from "./attacks";
import { stepContactDamage, stepEnemyMovement } from "./enemies";
import { stepRevive } from "./revive";
import { stepSpawner } from "./spawner";

export type PlayerSim = {
  id: string;
  name: string;
  heroClass: HeroClass;
  /** Punto de aparición que ocupa (0 a 3). */
  slot: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  connected: boolean;
  downed: boolean;
  /** Avance de la reanimación, de 0 a 1. */
  reviveProgress: number;
  /** Última dirección de movimiento no nula (unitaria). */
  facing: Vec2;
  input: MoveMessage;
  attackTimerMs: number;
  invulnerableMs: number;
};

export type EnemySim = {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  contactCooldownMs: number;
  ageMs: number;
};

export type ProjectileSim = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  /** Dirección de avance, en radianes. */
  angle: number;
  damage: number;
  lifeMs: number;
};

/** Cosas que pasaron en un paso y que el cliente muestra como efectos. */
export type SimEvent =
  | { type: "slash"; x: number; y: number; angle: number }
  | { type: "hit"; x: number; y: number }
  | { type: "enemyDied"; x: number; y: number; kind: EnemyKind }
  | { type: "downed"; id: string }
  | { type: "revived"; id: string };

/** Separación entre los puntos de aparición, alrededor del centro del mapa. */
const SPAWN_OFFSET = 40;
const SPAWN_SLOTS: Vec2[] = [
  { x: -SPAWN_OFFSET, y: 0 },
  { x: SPAWN_OFFSET, y: 0 },
  { x: 0, y: -SPAWN_OFFSET },
  { x: 0, y: SPAWN_OFFSET },
];

/**
 * Toda la partida, en datos planos y sin red: se puede probar con un reloj
 * y un azar controlados. La sala de Colyseus solo la hace avanzar y copia
 * el resultado al estado sincronizado.
 */
export class World {
  phase: "playing" | "defeat" = "playing";
  elapsedMs = 0;
  /** Tiempo acumulado desde la última aparición de enemigos. */
  spawnTimerMs = 0;
  readonly players = new Map<string, PlayerSim>();
  readonly enemies = new Map<string, EnemySim>();
  readonly projectiles = new Map<string, ProjectileSim>();
  private nextId = 1;

  constructor(readonly random: () => number = Math.random) {}

  newId(prefix: string): string {
    return `${prefix}${this.nextId++}`;
  }

  addPlayer(id: string, name: string, heroClass: HeroClass): PlayerSim {
    const used = new Set([...this.players.values()].map((p) => p.slot));
    let slot = 0;
    while (used.has(slot) && slot < SPAWN_SLOTS.length - 1) slot++;
    const maxHp = HEROES[heroClass].maxHp;
    const player: PlayerSim = {
      id,
      name,
      heroClass,
      slot,
      x: 0,
      y: 0,
      hp: maxHp,
      maxHp,
      connected: true,
      downed: false,
      reviveProgress: 0,
      facing: { x: 1, y: 0 },
      input: { dx: 0, dy: 0 },
      attackTimerMs: 0,
      invulnerableMs: 0,
    };
    this.placeAtSpawn(player);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  setInput(id: string, input: MoveMessage): void {
    const player = this.players.get(id);
    if (!player || !player.connected || player.downed) return;
    player.input = input;
  }

  setConnected(id: string, connected: boolean): void {
    const player = this.players.get(id);
    if (!player) return;
    player.connected = connected;
    if (!connected) player.input = { dx: 0, dy: 0 };
  }

  spawnEnemy(kind: EnemyKind, x: number, y: number): EnemySim | null {
    if (this.enemies.size >= MAX_ENEMIES) return null;
    const half = ENEMIES[kind].size / 2;
    const enemy: EnemySim = {
      id: this.newId("e"),
      kind,
      x: Math.min(MAP_WIDTH - half, Math.max(half, x)),
      y: Math.min(MAP_HEIGHT - half, Math.max(half, y)),
      hp: enemyHp(kind, activePlayers(this).length),
      contactCooldownMs: 0,
      ageMs: 0,
    };
    this.enemies.set(enemy.id, enemy);
    return enemy;
  }

  /** Avanza la partida `dtMs` milisegundos y devuelve lo que pasó. */
  step(dtMs: number): SimEvent[] {
    if (this.phase !== "playing") return [];
    const events: SimEvent[] = [];
    this.elapsedMs += dtMs;

    for (const player of this.players.values()) {
      player.invulnerableMs = Math.max(0, player.invulnerableMs - dtMs);
      if (!player.connected || player.downed) continue;
      const { dx, dy } = player.input;
      if (dx === 0 && dy === 0) continue;
      const next = stepPlayer(player, player.input, dtMs / 1000);
      player.x = next.x;
      player.y = next.y;
      const length = Math.hypot(dx, dy);
      player.facing = { x: dx / length, y: dy / length };
    }

    stepSpawner(this, dtMs);
    stepEnemyMovement(this, dtMs);
    stepProjectiles(this, dtMs, events);
    stepAttacks(this, dtMs, events);
    stepContactDamage(this, dtMs);
    stepRevive(this, dtMs, events);
    return events;
  }

  /** Vuelve a empezar la partida con los mismos jugadores. */
  restart(): void {
    this.phase = "playing";
    this.elapsedMs = 0;
    this.spawnTimerMs = 0;
    this.enemies.clear();
    this.projectiles.clear();
    for (const player of this.players.values()) {
      player.hp = player.maxHp;
      player.downed = false;
      player.reviveProgress = 0;
      player.invulnerableMs = 0;
      player.attackTimerMs = 0;
      player.input = { dx: 0, dy: 0 };
      player.facing = { x: 1, y: 0 };
      this.placeAtSpawn(player);
    }
  }

  private placeAtSpawn(player: PlayerSim): void {
    player.x = MAP_WIDTH / 2 + SPAWN_SLOTS[player.slot].x;
    player.y = MAP_HEIGHT / 2 + SPAWN_SLOTS[player.slot].y;
  }
}

/** Jugadores a los que se puede atacar y que pueden actuar: conectados y en pie. */
export function activePlayers(world: World): PlayerSim[] {
  const result: PlayerSim[] = [];
  for (const player of world.players.values()) {
    if (player.connected && !player.downed) result.push(player);
  }
  return result;
}
