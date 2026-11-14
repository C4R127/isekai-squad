import * as Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_PLAYERS,
  PLAYER_SIZE,
  stepPlayer,
  type MoveMessage,
  type Vec2,
} from "@isekai/shared";
import { buildInviteUrl } from "../invite";
import { inputFromKeys, interpolate, reconcile, sameInput } from "../motion";
import { button, label } from "../ui";

/** Lo que el servidor sincroniza de cada jugador. */
type PlayerData = { name: string; heroClass: string; x: number; y: number; connected: boolean };
type PlayerView = { body: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; pos: Vec2 };

const HERO_COLORS: Record<string, number> = { guerrero: 0xd9534f, maga: 0x5b6ee1 };
const TILE = 16;
/** Código con el que el servidor confirma una salida voluntaria. */
const CLOSE_CONSENTED = 4000;

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private views = new Map<string, PlayerView>();
  private keys!: Record<"W" | "A" | "S" | "D" | "UP" | "LEFT" | "DOWN" | "RIGHT", Phaser.Input.Keyboard.Key>;
  private lastSent: MoveMessage = { dx: 0, dy: 0 };
  private countText!: Phaser.GameObjects.Text;
  private banner: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("Game");
  }

  init(data: { room: Room }): void {
    this.room = data.room;
    this.views = new Map();
    this.lastSent = { dx: 0, dy: 0 };
    this.banner = null;
  }

  create(): void {
    this.drawMap();
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT).setRoundPixels(true);
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,LEFT,DOWN,RIGHT") as typeof this.keys;
    this.createHud();

    // Al cambiar de pestaña o de ventana el personaje se detiene, en vez de seguir caminando solo.
    this.game.events.on(Phaser.Core.Events.BLUR, this.stopMoving, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.stopMoving, this);
    });

    this.room.onDrop(() => this.showBanner("Reconectando…"));
    this.room.onReconnect(() => {
      this.hideBanner();
      // El servidor olvidó la dirección al caerse la conexión: se reenvía.
      this.lastSent = { dx: 0, dy: 0 };
    });
    this.room.onLeave((code: number) => {
      if (code === CLOSE_CONSENTED) return;
      this.showBanner("Se perdió la conexión.");
      button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, "Volver a entrar", () => location.reload())
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1001);
    });
  }

  update(_time: number, delta: number): void {
    const players = this.room.state?.players as
      | { forEach(cb: (p: PlayerData, id: string) => void): void; size: number }
      | undefined;
    if (!players) return;

    const input = inputFromKeys({
      left: this.keys.A.isDown || this.keys.LEFT.isDown,
      right: this.keys.D.isDown || this.keys.RIGHT.isDown,
      up: this.keys.W.isDown || this.keys.UP.isDown,
      down: this.keys.S.isDown || this.keys.DOWN.isDown,
    });
    if (!sameInput(input, this.lastSent)) {
      this.room.send("move", input);
      this.lastSent = input;
    }

    const seen = new Set<string>();
    players.forEach((data, id) => {
      seen.add(id);
      const isMe = id === this.room.sessionId;
      const view = this.views.get(id) ?? this.createView(id, data, isMe);

      if (isMe) {
        // Predicción: me muevo al instante y me corrijo hacia lo que diga el servidor.
        const predicted = stepPlayer(view.pos, input, delta / 1000);
        view.pos = reconcile(predicted, data, delta);
      } else {
        view.pos = interpolate(view.pos, data, delta);
      }

      view.body.setPosition(view.pos.x, view.pos.y).setAlpha(data.connected ? 1 : 0.4);
      view.name.setPosition(view.pos.x, view.pos.y - PLAYER_SIZE / 2 - 2).setAlpha(data.connected ? 1 : 0.4);
      if (view.name.text !== data.name) view.name.setText(data.name);
    });

    this.views.forEach((view, id) => {
      if (seen.has(id)) return;
      view.body.destroy();
      view.name.destroy();
      this.views.delete(id);
    });

    this.countText.setText(`Jugadores: ${players.size}/${MAX_PLAYERS}`);
  }

  private stopMoving(): void {
    this.input.keyboard?.resetKeys();
    if (sameInput(this.lastSent, { dx: 0, dy: 0 })) return;
    this.lastSent = { dx: 0, dy: 0 };
    try {
      this.room.send("move", this.lastSent);
    } catch {
      // Sin conexión: el servidor ya detuvo al personaje al caerse.
    }
  }

  private createView(id: string, data: PlayerData, isMe: boolean): PlayerView {
    const body = this.add
      .rectangle(data.x, data.y, PLAYER_SIZE, PLAYER_SIZE, HERO_COLORS[data.heroClass] ?? HERO_COLORS.guerrero)
      .setDepth(isMe ? 11 : 10);
    if (isMe) body.setStrokeStyle(2, 0xffffff);
    const name = label(this, data.x, data.y, data.name).setOrigin(0.5, 1).setDepth(20);
    const view: PlayerView = { body, name, pos: { x: data.x, y: data.y } };
    this.views.set(id, view);
    if (isMe) this.cameras.main.startFollow(body, true);
    return view;
  }

  private drawMap(): void {
    const g = this.add.graphics();
    g.fillStyle(0x2d4a2b).fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    g.lineStyle(1, 0x35573a, 1);
    for (let x = 0; x <= MAP_WIDTH; x += TILE) g.lineBetween(x, 0, x, MAP_HEIGHT);
    for (let y = 0; y <= MAP_HEIGHT; y += TILE) g.lineBetween(0, y, MAP_WIDTH, y);
    g.lineStyle(4, 0x14261a, 1).strokeRect(2, 2, MAP_WIDTH - 4, MAP_HEIGHT - 4);
  }

  private createHud(): void {
    this.countText = label(this, 4, 4, "").setScrollFactor(0).setDepth(1000);
    const copy = button(this, GAME_WIDTH - 4, 4, "Copiar link", () => void this.copyInvite(copy))
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);
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

  private showBanner(text: string): void {
    this.hideBanner();
    this.banner = label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, text)
      .setOrigin(0.5)
      .setPadding(8, 6, 8, 6)
      .setBackgroundColor("#000000")
      .setScrollFactor(0)
      .setDepth(1001);
  }

  private hideBanner(): void {
    this.banner?.destroy();
    this.banner = null;
  }
}
