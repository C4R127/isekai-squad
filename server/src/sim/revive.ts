import { REVIVE, distance } from "@isekai/shared";
import { activePlayers, type SimEvent, type World } from "./world";

/** Caer, revivir y decidir la derrota. */
export function stepRevive(world: World, dtMs: number, events: SimEvent[]): void {
  // Caer: con 0 de vida el jugador queda en el suelo, no muere.
  for (const player of world.players.values()) {
    if (player.downed || player.hp > 0) continue;
    player.hp = 0;
    player.downed = true;
    player.reviveProgress = 0;
    player.input = { dx: 0, dy: 0 };
    events.push({ type: "downed", id: player.id });
  }

  // Revivir: un compañero en pie tiene que quedarse al lado sin interrupción.
  const standing = activePlayers(world);
  for (const player of world.players.values()) {
    if (!player.downed) continue;
    const helped = standing.some((other) => distance(other, player) <= REVIVE.radius);
    if (!helped) {
      player.reviveProgress = 0;
      continue;
    }
    player.reviveProgress += dtMs / REVIVE.durationMs;
    if (player.reviveProgress < 1 - 1e-9) continue;
    player.downed = false;
    player.reviveProgress = 0;
    player.hp = Math.round(player.maxHp * REVIVE.hpFraction);
    player.invulnerableMs = REVIVE.invulnerableMs;
    player.attackTimerMs = 0;
    events.push({ type: "revived", id: player.id });
  }

  // Derrota: alguien cayó y no queda nadie en pie y conectado para levantarlo.
  let anyDowned = false;
  for (const player of world.players.values()) anyDowned ||= player.downed;
  if (anyDowned && activePlayers(world).length === 0) world.phase = "defeat";
}
