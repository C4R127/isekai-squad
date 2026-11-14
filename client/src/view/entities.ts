import * as Phaser from "phaser";
import { ENEMIES, ORB, PLAYER_SIZE, stepPlayer, type EnemyKind, type MoveMessage, type Vec2 } from "@isekai/shared";
import { interpolate, reconcile } from "../motion";
import { label } from "../ui";
import { DOWNED_COLOR, HP_BACK_COLOR, HP_COLOR, ORB_COLOR, REVIVE_COLOR, enemyColor, heroColor } from "./colors";

/** Lo que el servidor sincroniza de cada cosa. */
export type PlayerData = {
  name: string;
  heroClass: string;
  x: number;
  y: number;
  connected: boolean;
  hp: number;
  maxHp: number;
  downed: boolean;
  reviveProgress: number;
};
export type EnemyData = { kind: string; x: number; y: number; hp: number };
export type ProjectileData = { x: number; y: number };

/** Colección sincronizada por Colyseus (MapSchema), vista solo en lo que se usa aquí. */
export type Synced<T> = { forEach(callback: (value: T, id: string) => void): void; size: number };

const BAR_WIDTH = 24;
const BAR_HEIGHT = 3;

type PlayerView = {
  body: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  barBack: Phaser.GameObjects.Rectangle;
  bar: Phaser.GameObjects.Rectangle;
  help: Phaser.GameObjects.Text;
  pos: Vec2;
};

/** Dibuja a los jugadores: el propio con predicción, los demás interpolados. */
export class PlayerViews {
  private views = new Map<string, PlayerView>();

  constructor(
    private scene: Phaser.Scene,
    private myId: string,
  ) {}

  position(id: string): Vec2 | null {
    return this.views.get(id)?.pos ?? null;
  }

  sync(players: Synced<PlayerData>, input: MoveMessage, delta: number): void {
    const seen = new Set<string>();
    players.forEach((data, id) => {
      seen.add(id);
      const isMe = id === this.myId;
      const view = this.views.get(id) ?? this.create(id, data, isMe);

      if (isMe && !data.downed) {
        // Predicción: me muevo al instante y me corrijo hacia lo que diga el servidor.
        view.pos = reconcile(stepPlayer(view.pos, input, delta / 1000), data, delta);
      } else {
        view.pos = interpolate(view.pos, data, delta);
      }
      this.draw(view, data);
    });

    this.views.forEach((view, id) => {
      if (seen.has(id)) return;
      for (const part of [view.body, view.name, view.barBack, view.bar, view.help]) part.destroy();
      this.views.delete(id);
    });
  }

  private create(id: string, data: PlayerData, isMe: boolean): PlayerView {
    const scene = this.scene;
    const body = scene.add.rectangle(data.x, data.y, PLAYER_SIZE, PLAYER_SIZE, heroColor(data.heroClass)).setDepth(isMe ? 11 : 10);
    if (isMe) body.setStrokeStyle(2, 0xffffff);
    const view: PlayerView = {
      body,
      name: label(scene, data.x, data.y, data.name).setOrigin(0.5, 1).setDepth(20),
      barBack: scene.add.rectangle(data.x, data.y, BAR_WIDTH + 2, BAR_HEIGHT + 2, 0x000000).setDepth(20),
      bar: scene.add.rectangle(data.x, data.y, BAR_WIDTH, BAR_HEIGHT, HP_COLOR).setOrigin(0, 0.5).setDepth(21),
      help: label(scene, data.x, data.y, "¡Revíveme!", "#ffe066").setOrigin(0.5, 0).setDepth(20).setVisible(false),
      pos: { x: data.x, y: data.y },
    };
    this.views.set(id, view);
    if (isMe) scene.cameras.main.startFollow(body, true);
    return view;
  }

  private draw(view: PlayerView, data: PlayerData): void {
    const { x, y } = view.pos;
    const alpha = data.connected ? 1 : 0.4;
    const top = y - PLAYER_SIZE / 2;

    view.body
      .setPosition(x, y)
      .setAlpha(alpha)
      .setFillStyle(data.downed ? DOWNED_COLOR : heroColor(data.heroClass))
      .setAngle(data.downed ? 90 : 0)
      .setScale(data.downed ? 0.8 : 1);
    view.name.setPosition(x, top - 7).setAlpha(alpha);
    if (view.name.text !== data.name) view.name.setText(data.name);

    // Barra sobre la cabeza: vida normalmente, progreso de reanimación si está caído.
    const fraction = data.downed ? data.reviveProgress : data.maxHp > 0 ? data.hp / data.maxHp : 0;
    view.barBack.setPosition(x, top - 4).setAlpha(alpha).setFillStyle(data.downed ? 0x000000 : HP_BACK_COLOR);
    view.bar
      .setPosition(x - BAR_WIDTH / 2, top - 4)
      .setAlpha(alpha)
      .setFillStyle(data.downed ? REVIVE_COLOR : HP_COLOR)
      .setDisplaySize(Math.max(0.001, BAR_WIDTH * Phaser.Math.Clamp(fraction, 0, 1)), BAR_HEIGHT);
    view.help.setPosition(x, y + PLAYER_SIZE / 2).setVisible(data.downed);
  }
}

type MobView = { shape: Phaser.GameObjects.Shape; pos: Vec2 };

/** Dibuja enemigos y orbes: marcadores que siguen con suavidad la posición del servidor. */
export class MobViews<T extends Vec2> {
  private views = new Map<string, MobView>();

  constructor(private create: (data: T) => Phaser.GameObjects.Shape) {}

  sync(items: Synced<T>, delta: number): void {
    const seen = new Set<string>();
    items.forEach((data, id) => {
      seen.add(id);
      let view = this.views.get(id);
      if (!view) {
        view = { shape: this.create(data), pos: { x: data.x, y: data.y } };
        this.views.set(id, view);
      }
      view.pos = interpolate(view.pos, data, delta);
      view.shape.setPosition(view.pos.x, view.pos.y);
    });
    this.views.forEach((view, id) => {
      if (seen.has(id)) return;
      view.shape.destroy();
      this.views.delete(id);
    });
  }
}

export function createEnemyViews(scene: Phaser.Scene): MobViews<EnemyData> {
  return new MobViews<EnemyData>((data) => {
    const size = ENEMIES[data.kind as EnemyKind]?.size ?? 16;
    return scene.add.rectangle(data.x, data.y, size, size, enemyColor(data.kind)).setStrokeStyle(1, 0x1b2a1b).setDepth(5);
  });
}

export function createProjectileViews(scene: Phaser.Scene): MobViews<ProjectileData> {
  return new MobViews<ProjectileData>((data) => scene.add.circle(data.x, data.y, ORB.radius, ORB_COLOR).setDepth(12));
}
