import { normalizeInput, type MoveMessage, type Vec2 } from "@isekai/shared";

/** A partir de esta distancia no se suaviza: la vista salta a la posición del servidor. */
export const SNAP_DISTANCE = 48;
/** Qué tan rápido se corrige el personaje propio hacia el servidor (ms). Equivale a ~10 % por cuadro a 60 FPS. */
const RECONCILE_MS = 160;
/** Qué tan rápido siguen los demás jugadores a su posición del servidor (ms). */
const INTERPOLATE_MS = 60;

export type Keys = { left: boolean; right: boolean; up: boolean; down: boolean };

export function inputFromKeys(keys: Keys): MoveMessage {
  return normalizeInput({
    dx: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
    dy: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
  });
}

export function sameInput(a: MoveMessage, b: MoveMessage): boolean {
  return a.dx === b.dx && a.dy === b.dy;
}

function approach(from: Vec2, to: Vec2, deltaMs: number, timeConstantMs: number): Vec2 {
  if (Math.hypot(to.x - from.x, to.y - from.y) > SNAP_DISTANCE) return { x: to.x, y: to.y };
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return { x: from.x, y: from.y };
  const k = 1 - Math.exp(-deltaMs / timeConstantMs);
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}

/** Corrige la posición predicha del personaje propio con la que manda el servidor. */
export function reconcile(local: Vec2, server: Vec2, deltaMs: number): Vec2 {
  return approach(local, server, deltaMs, RECONCILE_MS);
}

/** Mueve con suavidad la vista de otro jugador hacia su posición del servidor. */
export function interpolate(view: Vec2, target: Vec2, deltaMs: number): Vec2 {
  return approach(view, target, deltaMs, INTERPOLATE_MS);
}
