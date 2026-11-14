import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@isekai/shared";
import { label } from "../ui";

/** Provisional: la partida compartida llega en la tarea 4. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super("Game");
  }

  create(): void {
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, "Conectado").setOrigin(0.5);
  }
}
