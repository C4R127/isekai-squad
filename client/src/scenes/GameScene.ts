import * as Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { MAP_HEIGHT, MAP_WIDTH, type MoveMessage } from "@isekai/shared";
import { buildInviteUrl } from "../invite";
import { inputFromKeys, sameInput } from "../motion";
import {
  PlayerViews,
  createEnemyViews,
  createProjectileViews,
  type EnemyData,
  type MobViews,
  type PlayerData,
  type ProjectileData,
  type Synced,
} from "../view/entities";
import { playFx, type FxEvent } from "../view/fx";
import { Hud } from "../view/hud";

const TILE = 16;
/** Código con el que el servidor confirma una salida voluntaria. */
const CLOSE_CONSENTED = 4000;
const STILL: MoveMessage = { dx: 0, dy: 0 };

type GameState = {
  players: Synced<PlayerData> & { get(id: string): PlayerData | undefined };
  enemies: Synced<EnemyData>;
  projectiles: Synced<ProjectileData>;
  phase: string;
};

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private keys!: Record<"W" | "A" | "S" | "D" | "UP" | "LEFT" | "DOWN" | "RIGHT", Phaser.Input.Keyboard.Key>;
  private lastSent: MoveMessage = STILL;
  private players!: PlayerViews;
  private enemies!: MobViews<EnemyData>;
  private projectiles!: MobViews<ProjectileData>;
  private hud!: Hud;

  constructor() {
    super("Game");
  }

  init(data: { room: Room }): void {
    this.room = data.room;
    this.lastSent = STILL;
  }

  create(): void {
    this.drawMap();
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT).setRoundPixels(true);
    const keyboard = this.input.keyboard!;
    this.keys = keyboard.addKeys("W,A,S,D,UP,LEFT,DOWN,RIGHT") as typeof this.keys;

    this.players = new PlayerViews(this, this.room.sessionId);
    this.enemies = createEnemyViews(this);
    this.projectiles = createProjectileViews(this);
    this.hud = new Hud(
      this,
      this.room.sessionId,
      () => this.room.send("restart"),
      (copyButton) => void this.copyInvite(copyButton),
    );

    keyboard.on("keydown-ENTER", () => {
      if (this.hud.isDefeatShown()) this.room.send("restart");
    });
    if (import.meta.env.DEV) {
      // Depuración: F9 llena la sala de enemigos para medir el rendimiento.
      keyboard.on("keydown-F9", () => this.room.send("debug:fill"));
    }

    this.room.onMessage("fx", (events: FxEvent[]) => {
      if (!Array.isArray(events)) return;
      for (const event of events) playFx(this, event, (id) => this.players.position(id));
    });

    // Al cambiar de pestaña o de ventana el personaje se detiene, en vez de seguir caminando solo.
    this.game.events.on(Phaser.Core.Events.BLUR, this.stopMoving, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.stopMoving, this);
    });

    this.room.onDrop(() => this.hud.showBanner("Reconectando…"));
    this.room.onReconnect(() => {
      this.hud.hideBanner();
      // El servidor olvidó la dirección al caerse la conexión: se reenvía.
      this.lastSent = STILL;
    });
    this.room.onLeave((code: number) => {
      if (code === CLOSE_CONSENTED) return;
      this.hud.showBanner("Se perdió la conexión.", { text: "Volver a entrar", onClick: () => location.reload() });
    });
  }

  update(_time: number, delta: number): void {
    const state = this.room.state as GameState | undefined;
    if (!state?.players) return;

    const me = state.players.get(this.room.sessionId);
    const canMove = state.phase === "playing" && !!me && !me.downed;
    const input = canMove
      ? inputFromKeys({
          left: this.keys.A.isDown || this.keys.LEFT.isDown,
          right: this.keys.D.isDown || this.keys.RIGHT.isDown,
          up: this.keys.W.isDown || this.keys.UP.isDown,
          down: this.keys.S.isDown || this.keys.DOWN.isDown,
        })
      : STILL;
    if (!sameInput(input, this.lastSent)) {
      this.room.send("move", input);
      this.lastSent = input;
    }

    this.players.sync(state.players, input, delta);
    if (state.enemies) this.enemies.sync(state.enemies, delta);
    if (state.projectiles) this.projectiles.sync(state.projectiles, delta);
    this.hud.update(state.players, state.phase);
  }

  private stopMoving(): void {
    this.input.keyboard?.resetKeys();
    if (sameInput(this.lastSent, STILL)) return;
    this.lastSent = STILL;
    try {
      this.room.send("move", STILL);
    } catch {
      // Sin conexión: el servidor ya detuvo al personaje al caerse.
    }
  }

  private drawMap(): void {
    const g = this.add.graphics();
    g.fillStyle(0x2d4a2b).fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    g.lineStyle(1, 0x35573a, 1);
    for (let x = 0; x <= MAP_WIDTH; x += TILE) g.lineBetween(x, 0, x, MAP_HEIGHT);
    for (let y = 0; y <= MAP_HEIGHT; y += TILE) g.lineBetween(0, y, MAP_WIDTH, y);
    g.lineStyle(4, 0x14261a, 1).strokeRect(2, 2, MAP_WIDTH - 4, MAP_HEIGHT - 4);
  }

  private async copyInvite(copyButton: Phaser.GameObjects.Text): Promise<void> {
    const url = buildInviteUrl(location.href, this.room.roomId);
    try {
      await navigator.clipboard.writeText(url);
      copyButton.setText("¡Link copiado!");
      this.time.delayedCall(2000, () => copyButton.setText("Copiar link"));
    } catch {
      // Sin portapapeles (pasa en HTTP por wifi): se muestra para copiarlo a mano.
      window.prompt("Copia este link y envíalo a tus amigos:", url);
    }
  }
}
