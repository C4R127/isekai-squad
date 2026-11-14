import { DEFAULT_NAME, NAME_MAX_LENGTH } from "./constants";

export type HeroClass = "guerrero" | "maga";
export type JoinOptions = { name: string; heroClass: HeroClass };

/** Limpia un nombre de jugador: sin espacios raros, máximo 12 caracteres. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NAME;
  const collapsed = raw.replace(/\s+/g, " ").trim();
  // Array.from cuenta caracteres completos, así no se parte un emoji.
  const name = Array.from(collapsed).slice(0, NAME_MAX_LENGTH).join("").trim();
  return name === "" ? DEFAULT_NAME : name;
}

export function sanitizeHeroClass(raw: unknown): HeroClass {
  return raw === "maga" ? "maga" : "guerrero";
}
