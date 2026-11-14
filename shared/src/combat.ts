import type { Vec2 } from "./movement";

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Ángulo de un vector, en radianes. */
export function angleOf(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

/** Diferencia entre dos ángulos por el lado corto, entre -π y π. */
function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** ¿Está `target` dentro del sector circular que nace en `origin` mirando hacia `facingRad`? */
export function inArc(origin: Vec2, facingRad: number, target: Vec2, radius: number, arcDegrees: number): boolean {
  const d = distance(origin, target);
  if (d > radius) return false;
  if (d === 0) return true;
  const toTarget = Math.atan2(target.y - origin.y, target.x - origin.x);
  return Math.abs(angleDelta(facingRad, toTarget)) <= (arcDegrees / 2) * (Math.PI / 180);
}

export function nearest<T extends Vec2>(from: Vec2, items: Iterable<T>): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const item of items) {
    const d = distance(from, item);
    if (d < bestDistance) {
      best = item;
      bestDistance = d;
    }
  }
  return best;
}

/** Gira `currentRad` hacia `targetRad` por el lado corto, como máximo `maxStepRad`. */
export function turnToward(currentRad: number, targetRad: number, maxStepRad: number): number {
  const d = angleDelta(currentRad, targetRad);
  if (Math.abs(d) <= maxStepRad) return currentRad + d;
  return currentRad + Math.sign(d) * maxStepRad;
}
