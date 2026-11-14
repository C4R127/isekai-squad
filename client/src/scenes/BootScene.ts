import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@isekai/shared";
import { buildInviteUrl, readRoomId } from "../invite";
import { connect, serverUrl } from "../net";
import { loadName } from "../profile";
import { button, label } from "../ui";
import { pingHealth, waitForServer, WAKE_NOTICE_MS, WAKE_TIMEOUT_MS } from "../wake";

const CX = GAME_WIDTH / 2;
const CY = GAME_HEIGHT / 2;
const BAR_WIDTH = 160;
const BAR_HEIGHT = 6;

/** Despierta al servidor, conecta (crea una sala o entra a la del link) y muestra los errores. */
export class BootScene extends Phaser.Scene {
  /** Momento en que empezó la espera; null si no se está mostrando la pantalla de "despertando". */
  private wakingSince: number | null = null;
  private bar: Phaser.GameObjects.Rectangle | null = null;
  private seconds: Phaser.GameObjects.Text | null = null;
  private noticeTimer: number | undefined;

  constructor() {
    super("Boot");
  }

  create(): void {
    void this.enter(readRoomId(location.search));
  }

  update(): void {
    if (this.wakingSince === null || !this.bar || !this.seconds) return;
    const elapsed = Math.min(performance.now() - this.wakingSince, WAKE_TIMEOUT_MS);
    this.bar.width = Math.max(1, BAR_WIDTH * (elapsed / WAKE_TIMEOUT_MS));
    this.seconds.setText(`${Math.floor(elapsed / 1000)} s`);
  }

  private clear(): void {
    this.wakingSince = null;
    this.bar = null;
    this.seconds = null;
    window.clearTimeout(this.noticeTimer);
    this.tweens.killAll();
    this.children.removeAll(true);
  }

  private async enter(roomId: string | null): Promise<void> {
    this.clear();
    label(this, CX, CY, "Conectando…").setOrigin(0.5);

    // Si el servidor no contesta enseguida es que estaba dormido: se avisa.
    const start = performance.now();
    // Se usa el reloj real y no el del juego, que se frena si la pestaña está en segundo plano.
    this.noticeTimer = window.setTimeout(() => this.showWaking(start), WAKE_NOTICE_MS);
    const awake = await waitForServer({
      ping: () => pingHealth(serverUrl()),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => performance.now(),
    });
    this.clear();

    if (!awake) {
      label(this, CX, CY - 20, "El portal no responde.\nRevisa tu conexión e inténtalo de nuevo.").setOrigin(0.5);
      button(this, CX, CY + 20, "Reintentar", () => void this.enter(roomId)).setOrigin(0.5);
      return;
    }

    label(this, CX, CY, "Conectando…").setOrigin(0.5);
    try {
      const room = await connect(roomId, { name: loadName(), heroClass: "guerrero" });
      history.replaceState(null, "", buildInviteUrl(location.href, room.roomId));
      this.scene.start("Game", { room });
    } catch (error) {
      console.warn("No se pudo conectar:", error);
      this.clear();
      if (roomId !== null) {
        label(this, CX, CY - 20, "No se pudo entrar a la sala.\nPuede que ya no exista o que esté llena.").setOrigin(0.5);
        button(this, CX, CY + 20, "Crear sala nueva", () => {
          history.replaceState(null, "", location.pathname);
          void this.enter(null);
        }).setOrigin(0.5);
      } else {
        label(this, CX, CY - 20, "No se pudo conectar con el servidor.").setOrigin(0.5);
        button(this, CX, CY + 20, "Reintentar", () => void this.enter(null)).setOrigin(0.5);
      }
    }
  }

  /** Pantalla de espera: el servidor gratuito se duerme cuando nadie juega. */
  private showWaking(start: number): void {
    this.children.removeAll(true);

    // Portal: ocho puntos en círculo que giran.
    const portal = this.add.container(CX, CY - 52);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      portal.add(this.add.circle(Math.cos(angle) * 14, Math.sin(angle) * 14, 2 + (i % 2), 0x9bf6ff, 0.4 + i * 0.075));
    }
    this.tweens.add({ targets: portal, angle: 360, duration: 2400, repeat: -1 });

    label(this, CX, CY - 18, "Despertando el portal mágico…", "#9bf6ff").setOrigin(0.5);
    label(this, CX, CY + 4, "El servidor gratuito se duerme cuando nadie juega.\nSuele tardar cerca de un minuto.", "#cccccc").setOrigin(0.5);

    this.add.rectangle(CX, CY + 34, BAR_WIDTH + 2, BAR_HEIGHT + 2, 0x000000).setStrokeStyle(1, 0x9bf6ff);
    this.bar = this.add.rectangle(CX - BAR_WIDTH / 2, CY + 34, 1, BAR_HEIGHT, 0x9bf6ff).setOrigin(0, 0.5);
    this.seconds = label(this, CX, CY + 46, "0 s", "#cccccc").setOrigin(0.5);
    this.wakingSince = start;
  }
}
