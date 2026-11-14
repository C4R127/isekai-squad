import { ENEMY_KINDS, MAP_HEIGHT, MAP_WIDTH, SPAWN, distance, spawnIntervalMs, type EnemyKind, type Vec2 } from "@isekai/shared";
import { activePlayers, type PlayerSim, type World } from "./world";

const SPAWN_ATTEMPTS = 8;
/** Cuánto se reparten los goblins de un grupo alrededor del punto elegido. */
const GROUP_SPREAD = 11;

/** Hace aparecer enemigos cada cierto tiempo, cada vez más seguido. */
export function stepSpawner(world: World, dtMs: number): void {
  const players = activePlayers(world);
  if (players.length === 0) return;

  world.spawnTimerMs += dtMs;
  for (;;) {
    const interval = spawnIntervalMs(world.elapsedMs, players.length);
    if (world.spawnTimerMs < interval) return;
    world.spawnTimerMs -= interval;
    spawnOnce(world, players);
  }
}

function spawnOnce(world: World, players: PlayerSim[]): void {
  const point = pickPoint(world, players);
  if (!point) return;

  const seconds = world.elapsedMs / 1000;
  const unlocked = ENEMY_KINDS.filter((kind) => seconds >= SPAWN.unlockSeconds[kind]);
  const kind: EnemyKind = unlocked[Math.floor(world.random() * unlocked.length)] ?? "slime";

  if (kind !== "goblin") {
    world.spawnEnemy(kind, point.x, point.y);
    return;
  }
  const [min, max] = SPAWN.goblinGroup;
  const count = min + Math.floor(world.random() * (max - min + 1));
  for (let i = 0; i < count; i++) {
    const offsetX = (world.random() * 2 - 1) * GROUP_SPREAD;
    const offsetY = (world.random() * 2 - 1) * GROUP_SPREAD;
    world.spawnEnemy(kind, point.x + offsetX, point.y + offsetY);
  }
}

/** Un punto del mapa alrededor de un jugador, pero lejos de todos. */
function pickPoint(world: World, players: PlayerSim[]): Vec2 | null {
  const margin = GROUP_SPREAD + 16;
  for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
    const anchor = players[Math.floor(world.random() * players.length)] ?? players[0];
    const angle = world.random() * Math.PI * 2;
    const reach = SPAWN.minDistance + world.random() * (SPAWN.maxDistance - SPAWN.minDistance);
    const point = {
      x: Math.min(MAP_WIDTH - margin, Math.max(margin, anchor.x + Math.cos(angle) * reach)),
      y: Math.min(MAP_HEIGHT - margin, Math.max(margin, anchor.y + Math.sin(angle) * reach)),
    };
    if (players.every((p) => distance(p, point) >= SPAWN.safeDistance)) return point;
  }
  return null;
}
