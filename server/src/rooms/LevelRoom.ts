import { Room, type Client } from "colyseus";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_PLAYERS,
  RECONNECT_SECONDS,
  TICK_MS,
  normalizeInput,
  sanitizeHeroClass,
  sanitizeName,
  stepPlayer,
  type MoveMessage,
} from "@isekai/shared";
import { LevelState, Player } from "../state";

/** Separación entre los puntos de aparición, alrededor del centro del mapa. */
const SPAWN_OFFSET = 40;
const SPAWN_SLOTS = [
  { x: -SPAWN_OFFSET, y: 0 },
  { x: SPAWN_OFFSET, y: 0 },
  { x: 0, y: -SPAWN_OFFSET },
  { x: 0, y: SPAWN_OFFSET },
];

export class LevelRoom extends Room<{ state: LevelState }> {
  maxClients = MAX_PLAYERS;
  state = new LevelState();

  /** Dirección actual de cada jugador. No se sincroniza: solo la usa el servidor. */
  private moves = new Map<string, MoveMessage>();
  /** Qué punto de aparición ocupa cada jugador. */
  private spawnSlots = new Map<string, number>();

  messages = {
    move: (client: Client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.connected) return;
      this.moves.set(client.sessionId, normalizeInput(payload));
    },
  };

  onCreate(): void {
    this.setTimestep(() => this.tick(), TICK_MS);
  }

  onJoin(client: Client, options: unknown): void {
    const opts = (typeof options === "object" && options !== null ? options : {}) as Record<string, unknown>;
    const slot = this.freeSlot();
    this.spawnSlots.set(client.sessionId, slot);

    const player = new Player();
    player.name = sanitizeName(opts.name);
    player.heroClass = sanitizeHeroClass(opts.heroClass);
    player.x = MAP_WIDTH / 2 + SPAWN_SLOTS[slot].x;
    player.y = MAP_HEIGHT / 2 + SPAWN_SLOTS[slot].y;
    player.connected = true;
    this.state.players.set(client.sessionId, player);
  }

  onDrop(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    this.moves.delete(client.sessionId);
    this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.moves.delete(client.sessionId);
    this.spawnSlots.delete(client.sessionId);
  }

  private freeSlot(): number {
    const used = new Set(this.spawnSlots.values());
    for (let i = 0; i < SPAWN_SLOTS.length; i++) if (!used.has(i)) return i;
    return 0;
  }

  private tick(): void {
    const dt = TICK_MS / 1000;
    this.moves.forEach((input, sessionId) => {
      if (input.dx === 0 && input.dy === 0) return;
      const player = this.state.players.get(sessionId);
      if (!player || !player.connected) return;
      const next = stepPlayer(player, input, dt);
      player.x = next.x;
      player.y = next.y;
    });
  }
}
