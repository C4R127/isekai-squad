import { Client, type Room } from "@colyseus/sdk";
import { ROOM_NAME, type JoinOptions } from "@isekai/shared";

const DEV_SERVER_PORT = 2567;

/**
 * Dirección del servidor. En producción viene de VITE_SERVER_URL; en desarrollo
 * se usa el mismo equipo que sirve la página, para que un celular en la misma
 * wifi llegue al servidor de la PC.
 */
export function serverUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (fromEnv) return fromEnv;
  return `${location.protocol}//${location.hostname}:${DEV_SERVER_PORT}`;
}

/** Se une a la sala del link, o crea una nueva si no hay link. */
export function connect(roomId: string | null, opts: JoinOptions): Promise<Room> {
  const client = new Client(serverUrl());
  return roomId === null ? client.create(ROOM_NAME, opts) : client.joinById(roomId, opts);
}
