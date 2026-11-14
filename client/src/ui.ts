import * as Phaser from "phaser";

export const FONT = "monospace";

/** Texto de interfaz con el estilo común del juego. */
export function label(scene: Phaser.Scene, x: number, y: number, text: string, color = "#ffffff"): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: "8px",
    color,
    align: "center",
    wordWrap: { width: 300 },
    // El texto se dibuja a mayor resolución para que se lea bien al ampliar.
    resolution: 4,
  });
}

/** Botón de texto con fondo; llama a onClick al pulsarlo. */
export function button(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Text {
  const b = label(scene, x, y, text)
    .setPadding(6, 4, 6, 4)
    .setBackgroundColor("#3a5a40")
    .setInteractive({ useHandCursor: true });
  b.on("pointerover", () => b.setBackgroundColor("#588157"));
  b.on("pointerout", () => b.setBackgroundColor("#3a5a40"));
  b.on("pointerdown", onClick);
  return b;
}
