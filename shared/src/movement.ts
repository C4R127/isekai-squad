import { MAP_HEIGHT, MAP_WIDTH, MAX_STEP_SECONDS, PLAYER_SIZE, PLAYER_SPEED } from "./constants";

export type Vec2 = { x: number; y: number };
export type MoveMessage = { dx: number; dy: number };

/**
 * Convierte cualquier cosa que llegue por la red en una dirección segura:
 * longitud máxima 1, y dirección cero si el dato no es válido.
 */
export function normalizeInput(raw: unknown): MoveMessage {
  if (typeof raw !== "object" || raw === null) return { dx: 0, dy: 0 };
  const { dx, dy } = raw as Record<string, unknown>;
  if (typeof dx !== "number" || typeof dy !== "number") return { dx: 0, dy: 0 };
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { dx: 0, dy: 0 };
  const length = Math.hypot(dx, dy);
  if (length <= 1) return { dx, dy };
  return { dx: dx / length, dy: dy / length };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Avanza a un jugador. La usan el servidor (autoridad) y el cliente
 * (predicción), así que ambos calculan exactamente lo mismo.
 */
export function stepPlayer(pos: Vec2, input: MoveMessage, dtSeconds: number): Vec2 {
  const dt = Number.isFinite(dtSeconds) ? clamp(dtSeconds, 0, MAX_STEP_SECONDS) : 0;
  const half = PLAYER_SIZE / 2;
  return {
    x: clamp(pos.x + input.dx * PLAYER_SPEED * dt, half, MAP_WIDTH - half),
    y: clamp(pos.y + input.dy * PLAYER_SPEED * dt, half, MAP_HEIGHT - half),
  };
}
