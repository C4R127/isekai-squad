import { Room, type Client } from "colyseus";
import {
  ENEMY_KINDS,
  MAX_ENEMIES,
  MAX_PLAYERS,
  RECONNECT_SECONDS,
  TICK_MS,
  normalizeInput,
  sanitizeHeroClass,
  sanitizeName,
} from "@isekai/shared";
import { World } from "../sim/world";
import { Enemy, LevelState, Player, Projectile } from "../state";

/** Las herramientas de depuración no existen en el servidor publicado. */
const DEBUG = process.env.NODE_ENV !== "production";

/**
 * Sala de una partida. La simulación vive en `World`; la sala traduce los
 * mensajes de los clientes, hace avanzar el mundo 20 veces por segundo y
 * copia el resultado al estado que Colyseus sincroniza.
 */
export class LevelRoom extends Room<{ state: LevelState }> {
  maxClients = MAX_PLAYERS;
  state = new LevelState();
  readonly world = new World();

  messages = {
    move: (client: Client, payload: unknown) => {
      this.world.setInput(client.sessionId, normalizeInput(payload));
    },
    restart: () => {
      if (this.world.phase !== "defeat") return;
      this.world.restart();
      this.syncState();
    },
    "debug:fill": () => {
      if (!DEBUG) return;
      this.fillWithEnemies();
      this.syncState();
    },
  };

  onCreate(): void {
    this.state.phase = this.world.phase;
    this.setTimestep(() => this.tick(), TICK_MS);
  }

  onJoin(client: Client, options: unknown): void {
    const opts = (typeof options === "object" && options !== null ? options : {}) as Record<string, unknown>;
    this.world.addPlayer(client.sessionId, sanitizeName(opts.name), sanitizeHeroClass(opts.heroClass));
    this.syncState();
  }

  onDrop(client: Client): void {
    this.world.setConnected(client.sessionId, false);
    this.syncState();
    this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect(client: Client): void {
    this.world.setConnected(client.sessionId, true);
    this.syncState();
  }

  onLeave(client: Client): void {
    this.world.removePlayer(client.sessionId);
    this.syncState();
  }

  private tick(): void {
    // Sin nadie conectado, la partida espera.
    let anyoneConnected = false;
    for (const player of this.world.players.values()) anyoneConnected ||= player.connected;
    if (!anyoneConnected) return;

    const events = this.world.step(TICK_MS);
    this.syncState();
    if (events.length > 0) this.broadcast("fx", events);
  }

  /** Copia el mundo al estado sincronizado. Solo se escribe lo que cambió. */
  private syncState(): void {
    const { world, state } = this;
    if (state.phase !== world.phase) state.phase = world.phase;

    for (const sim of world.players.values()) {
      let player = state.players.get(sim.id);
      if (!player) {
        player = new Player();
        player.name = sim.name;
        player.heroClass = sim.heroClass;
        state.players.set(sim.id, player);
      }
      if (player.x !== sim.x) player.x = sim.x;
      if (player.y !== sim.y) player.y = sim.y;
      if (player.connected !== sim.connected) player.connected = sim.connected;
      if (player.hp !== sim.hp) player.hp = sim.hp;
      if (player.maxHp !== sim.maxHp) player.maxHp = sim.maxHp;
      if (player.downed !== sim.downed) player.downed = sim.downed;
      const progress = Math.round(sim.reviveProgress * 100) / 100;
      if (player.reviveProgress !== progress) player.reviveProgress = progress;
    }
    state.players.forEach((_player, id) => {
      if (!world.players.has(id)) state.players.delete(id);
    });

    for (const sim of world.enemies.values()) {
      let enemy = state.enemies.get(sim.id);
      if (!enemy) {
        enemy = new Enemy();
        enemy.kind = sim.kind;
        state.enemies.set(sim.id, enemy);
      }
      const x = Math.round(sim.x);
      const y = Math.round(sim.y);
      const hp = Math.round(sim.hp);
      if (enemy.x !== x) enemy.x = x;
      if (enemy.y !== y) enemy.y = y;
      if (enemy.hp !== hp) enemy.hp = hp;
    }
    state.enemies.forEach((_enemy, id) => {
      if (!world.enemies.has(id)) state.enemies.delete(id);
    });

    for (const sim of world.projectiles.values()) {
      let projectile = state.projectiles.get(sim.id);
      if (!projectile) {
        projectile = new Projectile();
        state.projectiles.set(sim.id, projectile);
      }
      const x = Math.round(sim.x);
      const y = Math.round(sim.y);
      if (projectile.x !== x) projectile.x = x;
      if (projectile.y !== y) projectile.y = y;
    }
    state.projectiles.forEach((_projectile, id) => {
      if (!world.projectiles.has(id)) state.projectiles.delete(id);
    });
  }

  /** Depuración: llena la sala hasta el máximo de enemigos, alrededor de los jugadores. */
  private fillWithEnemies(): void {
    const players = [...this.world.players.values()];
    if (players.length === 0) return;
    while (this.world.enemies.size < MAX_ENEMIES) {
      const anchor = players[Math.floor(Math.random() * players.length)];
      const angle = Math.random() * Math.PI * 2;
      const reach = 150 + Math.random() * 250;
      const kind = ENEMY_KINDS[Math.floor(Math.random() * ENEMY_KINDS.length)];
      this.world.spawnEnemy(kind, anchor.x + Math.cos(angle) * reach, anchor.y + Math.sin(angle) * reach);
    }
  }
}
