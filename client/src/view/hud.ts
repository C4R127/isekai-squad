import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS } from "@isekai/shared";
import { button, label } from "../ui";
import { HP_BACK_COLOR, HP_COLOR } from "./colors";
import type { PlayerData, Synced } from "./entities";

const BAR_WIDTH = 80;
const BAR_HEIGHT = 6;
const DEPTH = 1000;

/** Interfaz fija en pantalla: vida propia, compañeros, avisos y derrota. */
export class Hud {
  private bar: Phaser.GameObjects.Rectangle;
  private hpText: Phaser.GameObjects.Text;
  private countText: Phaser.GameObjects.Text;
  private mates: Phaser.GameObjects.Text;
  private banner: Phaser.GameObjects.Text | null = null;
  private bannerButton: Phaser.GameObjects.Text | null = null;
  private defeat: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private scene: Phaser.Scene,
    private myId: string,
    private onRestart: () => void,
    onCopyLink: (copyButton: Phaser.GameObjects.Text) => void,
  ) {
    scene.add.rectangle(4, 4, BAR_WIDTH + 2, BAR_HEIGHT + 2, 0x000000).setOrigin(0).setScrollFactor(0).setDepth(DEPTH);
    scene.add.rectangle(5, 5, BAR_WIDTH, BAR_HEIGHT, HP_BACK_COLOR).setOrigin(0).setScrollFactor(0).setDepth(DEPTH);
    this.bar = scene.add.rectangle(5, 5, BAR_WIDTH, BAR_HEIGHT, HP_COLOR).setOrigin(0).setScrollFactor(0).setDepth(DEPTH);
    this.hpText = this.fixed(label(scene, BAR_WIDTH + 10, 3, ""));
    this.countText = this.fixed(label(scene, 4, 15, ""));
    this.mates = this.fixed(label(scene, 4, 26, "", "#cccccc")).setAlign("left");
    const copy = this.fixed(button(scene, GAME_WIDTH - 4, 4, "Copiar link", () => onCopyLink(copy)).setOrigin(1, 0));
  }

  private fixed<T extends Phaser.GameObjects.Text>(object: T): T {
    return object.setScrollFactor(0).setDepth(DEPTH);
  }

  update(players: Synced<PlayerData>, phase: string): void {
    const lines: string[] = [];
    players.forEach((data, id) => {
      if (id === this.myId) {
        const fraction = data.maxHp > 0 ? Phaser.Math.Clamp(data.hp / data.maxHp, 0, 1) : 0;
        this.bar.setDisplaySize(Math.max(0.001, BAR_WIDTH * fraction), BAR_HEIGHT);
        this.hpText.setText(`${Math.max(0, data.hp)} / ${data.maxHp}`);
      } else {
        const status = !data.connected ? "desconectado" : data.downed ? "caído" : `${Math.max(0, data.hp)} / ${data.maxHp}`;
        lines.push(`${data.name}: ${status}`);
      }
    });
    this.countText.setText(`Jugadores: ${players.size}/${MAX_PLAYERS}`);
    const text = lines.join("\n");
    if (this.mates.text !== text) this.mates.setText(text);

    if (phase === "defeat" && this.defeat.length === 0) this.showDefeat();
    if (phase !== "defeat" && this.defeat.length > 0) this.hideDefeat();
  }

  isDefeatShown(): boolean {
    return this.defeat.length > 0;
  }

  private showDefeat(): void {
    const scene = this.scene;
    const veil = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH + 10);
    const title = label(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, "Derrota", "#ff6b6b")
      .setOrigin(0.5)
      .setFontSize("16px")
      .setScrollFactor(0)
      .setDepth(DEPTH + 11);
    const hint = label(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 8, "Todo el equipo cayó.", "#cccccc")
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 11);
    const again = button(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, "Jugar otra vez (Enter)", this.onRestart)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 11);
    this.defeat = [veil, title, hint, again];
  }

  private hideDefeat(): void {
    for (const object of this.defeat) object.destroy();
    this.defeat = [];
  }

  /** Aviso centrado (conexión). Con `action`, añade un botón debajo. */
  showBanner(text: string, action?: { text: string; onClick: () => void }): void {
    this.hideBanner();
    this.banner = label(this.scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, text)
      .setOrigin(0.5)
      .setPadding(8, 6, 8, 6)
      .setBackgroundColor("#000000")
      .setScrollFactor(0)
      .setDepth(DEPTH + 20);
    if (action) {
      this.bannerButton = button(this.scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, action.text, action.onClick)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH + 20);
    }
  }

  hideBanner(): void {
    this.banner?.destroy();
    this.bannerButton?.destroy();
    this.banner = null;
    this.bannerButton = null;
  }
}
