import {
  BAT_ZIGZAG,
  CONTACT_COOLDOWN_MS,
  ENEMIES,
  MAP_HEIGHT,
  MAP_WIDTH,
  PLAYER_SIZE,
  distance,
  nearest,
} from "@isekai/shared";
import { activePlayers, type EnemySim, type World } from "./world";

/** Los enemigos se solapan un poco antes de empujarse, para que la horda se vea compacta. */
const SEPARATION_FACTOR = 0.8;
const SEPARATION_STRENGTH = 0.5;
/** Fracción de la distancia de contacto a la que un enemigo deja de acercarse. */
const STOP_FACTOR = 0.75;

/** Cada enemigo persigue al jugador activo más cercano. */
export function stepEnemyMovement(world: World, dtMs: number): void {
  const players = activePlayers(world);
  if (players.length === 0) return;
  const dt = dtMs / 1000;

  for (const enemy of world.enemies.values()) {
    enemy.ageMs += dtMs;
    const target = nearest(enemy, players);
    if (!target) continue;
    const gap = distance(enemy, target);
    if (gap === 0) continue;

    let dirX = (target.x - enemy.x) / gap;
    let dirY = (target.y - enemy.y) / gap;
    if (enemy.kind === "murcielago") {
      // Zigzag: se suma un vaivén perpendicular a la dirección de avance.
      const sway = Math.sin((enemy.ageMs / BAT_ZIGZAG.periodMs) * Math.PI * 2) * BAT_ZIGZAG.lateral;
      const swayX = dirX - dirY * sway;
      const swayY = dirY + dirX * sway;
      const length = Math.hypot(swayX, swayY);
      dirX = swayX / length;
      dirY = swayY / length;
    }
    // Se detienen al tocar al jugador, en vez de meterse dentro de él: así lo rodean.
    const stopGap = ((ENEMIES[enemy.kind].size + PLAYER_SIZE) / 2) * STOP_FACTOR;
    const stride = Math.min(ENEMIES[enemy.kind].speed * dt, Math.max(0, gap - stopGap));
    enemy.x += dirX * stride;
    enemy.y += dirY * stride;
  }

  separate(world);

  for (const enemy of world.enemies.values()) {
    const half = ENEMIES[enemy.kind].size / 2;
    enemy.x = Math.min(MAP_WIDTH - half, Math.max(half, enemy.x));
    enemy.y = Math.min(MAP_HEIGHT - half, Math.max(half, enemy.y));
  }
}

/** Empuja suavemente a los enemigos que se pisan. Con 150 como máximo, comparar todos con todos es barato. */
function separate(world: World): void {
  const list: EnemySim[] = [...world.enemies.values()];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const sizeA = ENEMIES[a.kind].size;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const minGap = ((sizeA + ENEMIES[b.kind].size) / 2) * SEPARATION_FACTOR;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      if (Math.abs(dx) >= minGap || Math.abs(dy) >= minGap) continue;
      let gap = Math.hypot(dx, dy);
      if (gap >= minGap) continue;
      if (gap === 0) {
        // Exactamente en el mismo punto: se separan en una dirección cualquiera.
        const angle = world.random() * Math.PI * 2;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        gap = 1;
      }
      const push = ((minGap - gap) / 2) * SEPARATION_STRENGTH;
      const pushX = (dx / gap) * push;
      const pushY = (dy / gap) * push;
      a.x -= pushX;
      a.y -= pushY;
      b.x += pushX;
      b.y += pushY;
    }
  }
}

/** Un enemigo que toca a un jugador le quita vida, con una pausa entre golpes. */
export function stepContactDamage(world: World, dtMs: number): void {
  const players = activePlayers(world);
  for (const enemy of world.enemies.values()) {
    enemy.contactCooldownMs = Math.max(0, enemy.contactCooldownMs - dtMs);
    if (enemy.contactCooldownMs > 0) continue;
    const stats = ENEMIES[enemy.kind];
    const reach = (stats.size + PLAYER_SIZE) / 2;
    for (const player of players) {
      if (player.hp <= 0 || player.invulnerableMs > 0) continue;
      if (distance(enemy, player) >= reach) continue;
      player.hp = Math.max(0, player.hp - stats.damage);
      enemy.contactCooldownMs = CONTACT_COOLDOWN_MS;
      break;
    }
  }
}
