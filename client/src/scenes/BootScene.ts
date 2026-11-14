import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@isekai/shared";
import { buildInviteUrl, readRoomId } from "../invite";
import { connect } from "../net";
import { loadName } from "../profile";
import { button, label } from "../ui";

/** Conecta con el servidor (crea una sala o entra a la del link) y muestra los errores. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    void this.enter(readRoomId(location.search));
  }

  private async enter(roomId: string | null): Promise<void> {
    this.children.removeAll(true);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    label(this, cx, cy, "Conectando…").setOrigin(0.5);

    try {
      const room = await connect(roomId, { name: loadName(), heroClass: "guerrero" });
      history.replaceState(null, "", buildInviteUrl(location.href, room.roomId));
      this.scene.start("Game", { room });
    } catch (error) {
      console.warn("No se pudo conectar:", error);
      this.children.removeAll(true);
      if (roomId !== null) {
        label(this, cx, cy - 20, "No se pudo entrar a la sala.\nPuede que ya no exista o que esté llena.").setOrigin(0.5);
        button(this, cx, cy + 20, "Crear sala nueva", () => {
          history.replaceState(null, "", location.pathname);
          void this.enter(null);
        }).setOrigin(0.5);
      } else {
        label(this, cx, cy - 20, "No se pudo conectar con el servidor.").setOrigin(0.5);
        button(this, cx, cy + 20, "Reintentar", () => void this.enter(null)).setOrigin(0.5);
      }
    }
  }
}
