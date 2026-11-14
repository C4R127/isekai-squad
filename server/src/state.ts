import { schema, t, type SchemaType } from "@colyseus/schema";

/** Un jugador tal como lo ven todos los clientes. */
export const Player = schema(
  {
    name: t.string(),
    heroClass: t.string(),
    x: t.number(),
    y: t.number(),
    connected: t.boolean(),
    hp: t.int16(),
    maxHp: t.int16(),
    downed: t.boolean(),
    /** Avance de la reanimación, de 0 a 1. */
    reviveProgress: t.float32(),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

/** Un enemigo. Las posiciones viajan como enteros para gastar poco tráfico. */
export const Enemy = schema(
  {
    kind: t.string(),
    x: t.int16(),
    y: t.int16(),
    hp: t.int16(),
  },
  "Enemy",
);
export type Enemy = SchemaType<typeof Enemy>;

/** Un orbe en vuelo. */
export const Projectile = schema(
  {
    x: t.int16(),
    y: t.int16(),
  },
  "Projectile",
);
export type Projectile = SchemaType<typeof Projectile>;

/** Estado sincronizado de una partida. La clave de `players` es el sessionId. */
export const LevelState = schema(
  {
    players: t.map(Player),
    enemies: t.map(Enemy),
    projectiles: t.map(Projectile),
    /** "playing" o "defeat". */
    phase: t.string(),
  },
  "LevelState",
);
export type LevelState = SchemaType<typeof LevelState>;
