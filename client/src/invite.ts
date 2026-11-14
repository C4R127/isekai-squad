const ROOM_PARAM = "sala";
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/** Lee el id de la sala de `?sala=...`. Devuelve null si falta o no tiene forma de id. */
export function readRoomId(search: string): string | null {
  const value = new URLSearchParams(search).get(ROOM_PARAM);
  return value !== null && ROOM_ID_PATTERN.test(value) ? value : null;
}

/** Link de invitación: la misma página, solo con `?sala=<id>`. */
export function buildInviteUrl(href: string, roomId: string): string {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(ROOM_PARAM, roomId);
  return url.toString();
}
