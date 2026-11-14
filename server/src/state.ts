import { schema, t, type SchemaType } from "@colyseus/schema";

/** Un jugador tal como lo ven todos los clientes. */
export const Player = schema(
  {
    name: t.string(),
    heroClass: t.string(),
    x: t.number(),
    y: t.number(),
    connected: t.boolean(),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

/** Estado sincronizado de una partida. La clave de `players` es el sessionId. */
export const LevelState = schema(
  {
    players: t.map(Player),
  },
  "LevelState",
);
export type LevelState = SchemaType<typeof LevelState>;
