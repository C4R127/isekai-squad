import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@isekai/shared";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { computeZoom } from "./screen";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: "#1b2a1b",
  scale: { mode: Phaser.Scale.NONE },
  scene: [BootScene, GameScene],
});

/** Ajusta el tamaño del lienzo al zoom entero más grande que cabe en la pantalla. */
function applyZoom(): void {
  const dpr = window.devicePixelRatio || 1;
  game.scale.setZoom(computeZoom(window.innerWidth, window.innerHeight, dpr) / dpr);
}

applyZoom();
window.addEventListener("resize", applyZoom);
window.addEventListener("orientationchange", applyZoom);
