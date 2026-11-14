import type { EnemyKind, HeroClass } from "@isekai/shared";

/** Colores de los marcadores, hasta que llegue el arte. */
export const HERO_COLORS: Record<HeroClass, number> = { guerrero: 0xd9534f, maga: 0x5b6ee1 };
export const ENEMY_COLORS: Record<EnemyKind, number> = { slime: 0x7bd389, goblin: 0xa3b18a, murcielago: 0x9d4edd };
export const DOWNED_COLOR = 0x777777;
export const ORB_COLOR = 0x9bf6ff;
export const HP_COLOR = 0x6fcf5f;
export const HP_BACK_COLOR = 0x3b1f1f;
export const REVIVE_COLOR = 0xffe066;

export function heroColor(heroClass: string): number {
  return HERO_COLORS[heroClass as HeroClass] ?? HERO_COLORS.guerrero;
}

export function enemyColor(kind: string): number {
  return ENEMY_COLORS[kind as EnemyKind] ?? ENEMY_COLORS.slime;
}
