import { sanitizeName } from "@isekai/shared";

const NAME_KEY = "isekai.nombre";

/** Nombre guardado en este dispositivo. localStorage puede fallar (modo privado), así que nunca lanza. */
export function loadName(): string {
  try {
    return sanitizeName(localStorage.getItem(NAME_KEY));
  } catch {
    return sanitizeName(null);
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, sanitizeName(name));
  } catch {
    // Sin almacenamiento: el nombre simplemente no se recuerda.
  }
}
