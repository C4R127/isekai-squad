import * as Phaser from "phaser";
import { ENEMIES, PLAYER_SIZE, SLASH, type EnemyKind, type Vec2 } from "@isekai/shared";
import { label } from "../ui";
import { enemyColor } from "./colors";

/** Efectos que manda el servidor en el mensaje "fx". */
export type FxEvent =
  | { type: "slash"; x: number; y: number; angle: number }
  | { type: "hit"; x: number; y: number }
  | { type: "enemyDied"; x: number; y: number; kind: string }
  | { type: "downed"; id: string }
  | { type: "revived"; id: string };

const DEG = Math.PI / 180;

/** Muestra un efecto breve. `positionOf` dice dónde está dibujado un jugador. */
export function playFx(scene: Phaser.Scene, event: FxEvent, positionOf: (id: string) => Vec2 | null): void {
  switch (event.type) {
    case "slash": {
      const half = (SLASH.arcDegrees / 2) * DEG;
      const g = scene.add.graphics().setDepth(15);
      g.fillStyle(0xffffff, 0.55);
      g.slice(event.x, event.y, SLASH.radius, event.angle - half, event.angle + half, false);
      g.fillPath();
      scene.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
      break;
    }
    case "hit": {
      const flash = scene.add.rectangle(event.x, event.y, 16, 16, 0xffffff, 0.9).setDepth(16);
      scene.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: 100, onComplete: () => flash.destroy() });
      break;
    }
    case "enemyDied": {
      const size = ENEMIES[event.kind as EnemyKind]?.size ?? 16;
      const ghost = scene.add.rectangle(event.x, event.y, size, size, enemyColor(event.kind)).setDepth(6);
      scene.tweens.add({ targets: ghost, alpha: 0, scale: 0.2, duration: 200, onComplete: () => ghost.destroy() });
      break;
    }
    case "downed":
    case "revived": {
      const pos = positionOf(event.id);
      if (!pos) break;
      const text = event.type === "downed" ? "¡Cayó!" : "¡De vuelta!";
      const color = event.type === "downed" ? "#ff6b6b" : "#9bf6ff";
      const floating = label(scene, pos.x, pos.y - PLAYER_SIZE, text, color).setOrigin(0.5).setDepth(30);
      scene.tweens.add({ targets: floating, y: floating.y - 14, alpha: 0, duration: 900, onComplete: () => floating.destroy() });
      break;
    }
  }
}
