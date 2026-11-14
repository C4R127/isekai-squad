import { sanitizeHeroClass, sanitizeName, type HeroClass } from "@isekai/shared";

const NAME_KEY = "isekai.nombre";
const CLASS_KEY = "isekai.clase";

// localStorage puede fallar (modo privado), así que nada de esto lanza.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: simplemente no se recuerda.
  }
}

/** Nombre guardado en este dispositivo. */
export function loadName(): string {
  return sanitizeName(read(NAME_KEY));
}

export function saveName(name: string): void {
  write(NAME_KEY, sanitizeName(name));
}

/** Última clase usada en este dispositivo. */
export function loadHeroClass(): HeroClass {
  return sanitizeHeroClass(read(CLASS_KEY));
}

export function saveHeroClass(heroClass: HeroClass): void {
  write(CLASS_KEY, sanitizeHeroClass(heroClass));
}
