import { ENEMIES, HEROES, MAP_HEIGHT, MAP_WIDTH, ORB, SLASH, angleOf, distance, inArc, nearest, turnToward } from "@isekai/shared";
import { activePlayers, type EnemySim, type PlayerSim, type SimEvent, type World } from "./world";

function damageEnemy(world: World, enemy: EnemySim, amount: number, events: SimEvent[]): void {
  enemy.hp -= amount;
  events.push({ type: "hit", x: enemy.x, y: enemy.y });
  if (enemy.hp > 0) return;
  world.enemies.delete(enemy.id);
  events.push({ type: "enemyDied", x: enemy.x, y: enemy.y, kind: enemy.kind });
}

/** Ataques automáticos: cada jugador en pie ataca solo cuando le toca. */
export function stepAttacks(world: World, dtMs: number, events: SimEvent[]): void {
  for (const player of activePlayers(world)) {
    const stats = HEROES[player.heroClass];
    player.attackTimerMs = Math.min(player.attackTimerMs + dtMs, stats.attackIntervalMs);
    if (player.attackTimerMs < stats.attackIntervalMs) continue;

    if (player.heroClass === "guerrero") {
      player.attackTimerMs = 0;
      slash(world, player, stats.damage, events);
    } else if (world.enemies.size > 0) {
      // La Maga espera con el ataque listo hasta que haya a quién disparar.
      player.attackTimerMs = 0;
      castOrb(world, player, stats.damage);
    }
  }
}

/** Corte del Guerrero: daña a todos los enemigos del arco que tiene delante. */
function slash(world: World, player: PlayerSim, damage: number, events: SimEvent[]): void {
  const angle = angleOf(player.facing);
  events.push({ type: "slash", x: player.x, y: player.y, angle });
  for (const enemy of [...world.enemies.values()]) {
    const reach = SLASH.radius + ENEMIES[enemy.kind].size / 2;
    if (inArc(player, angle, enemy, reach, SLASH.arcDegrees)) damageEnemy(world, enemy, damage, events);
  }
}

/** Orbe de la Maga: nace en ella apuntando al enemigo más cercano. */
function castOrb(world: World, player: PlayerSim, damage: number): void {
  const target = nearest(player, world.enemies.values());
  if (!target) return;
  const id = world.newId("o");
  world.projectiles.set(id, {
    id,
    ownerId: player.id,
    x: player.x,
    y: player.y,
    angle: Math.atan2(target.y - player.y, target.x - player.x),
    damage,
    lifeMs: ORB.lifetimeMs,
  });
}

/** Mueve los orbes: giran hacia el enemigo más cercano y golpean al primero que tocan. */
export function stepProjectiles(world: World, dtMs: number, events: SimEvent[]): void {
  const dt = dtMs / 1000;
  const maxTurn = ORB.turnDegPerSec * (Math.PI / 180) * dt;

  for (const orb of [...world.projectiles.values()]) {
    orb.lifeMs -= dtMs;
    if (orb.lifeMs <= 0) {
      world.projectiles.delete(orb.id);
      continue;
    }

    const target = nearest(orb, world.enemies.values());
    if (target) {
      const wanted = Math.atan2(target.y - orb.y, target.x - orb.x);
      orb.angle = turnToward(orb.angle, wanted, maxTurn);
    }
    orb.x += Math.cos(orb.angle) * ORB.speed * dt;
    orb.y += Math.sin(orb.angle) * ORB.speed * dt;

    if (orb.x < 0 || orb.x > MAP_WIDTH || orb.y < 0 || orb.y > MAP_HEIGHT) {
      world.projectiles.delete(orb.id);
      continue;
    }

    for (const enemy of world.enemies.values()) {
      if (distance(orb, enemy) >= ORB.radius + ENEMIES[enemy.kind].size / 2) continue;
      damageEnemy(world, enemy, orb.damage, events);
      world.projectiles.delete(orb.id);
      break;
    }
  }
}
