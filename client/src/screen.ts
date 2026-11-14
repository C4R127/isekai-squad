import { GAME_HEIGHT, GAME_WIDTH } from "@isekai/shared";

/**
 * Zoom entero más grande que cabe en la pantalla, medido en píxeles físicos
 * (tamaño CSS × devicePixelRatio). Así los píxeles del arte se ven nítidos
 * también en celulares, cuya pantalla tiene muchos más píxeles que su tamaño CSS.
 */
export function computeZoom(cssWidth: number, cssHeight: number, dpr: number): number {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const zoom = Math.floor(Math.min((cssWidth * ratio) / GAME_WIDTH, (cssHeight * ratio) / GAME_HEIGHT));
  return Number.isFinite(zoom) && zoom >= 1 ? zoom : 1;
}
