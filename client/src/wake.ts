/** Tiempo máximo que se espera a que el servidor despierte. */
export const WAKE_TIMEOUT_MS = 90_000;
/** Pausa entre un intento y el siguiente. */
export const WAKE_RETRY_MS = 3_000;
/** Cada intento se corta si no hay respuesta en este tiempo. */
export const PING_TIMEOUT_MS = 10_000;
/** Si el servidor tarda más que esto, se muestra la pantalla de "despertando". */
export const WAKE_NOTICE_MS = 1_500;

export type WakeDeps = {
  /** true si el servidor respondió bien. Si lanza, cuenta como "sigue dormido". */
  ping: () => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

/**
 * Espera a que el servidor responda. El hosting gratuito lo duerme cuando
 * nadie juega y tarda cerca de un minuto en volver.
 * Devuelve false si pasan WAKE_TIMEOUT_MS sin respuesta.
 */
export async function waitForServer(deps: WakeDeps, onWaiting?: (elapsedMs: number) => void): Promise<boolean> {
  const start = deps.now();
  for (;;) {
    let awake = false;
    try {
      awake = await deps.ping();
    } catch {
      awake = false;
    }
    if (awake) return true;

    const elapsed = deps.now() - start;
    if (elapsed >= WAKE_TIMEOUT_MS) return false;
    onWaiting?.(elapsed);
    await deps.sleep(WAKE_RETRY_MS);
  }
}

/** Toca GET /health. Nunca lanza: cualquier fallo devuelve false. */
export async function pingHealth(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchFn(`${baseUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
