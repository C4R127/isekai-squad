import { describe, expect, it } from "vitest";
import { pingHealth, waitForServer, WAKE_RETRY_MS, WAKE_TIMEOUT_MS, type WakeDeps } from "../src/wake";

/** Reloj falso: `sleep` suma al reloj y nada espera de verdad. */
function fakeDeps(results: Array<boolean | Error>, pingCostMs = 0) {
  let t = 0;
  let calls = 0;
  const deps: WakeDeps = {
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    ping: async () => {
      t += pingCostMs;
      const r = results[Math.min(calls++, results.length - 1)];
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { deps, calls: () => calls, time: () => t };
}

describe("waitForServer", () => {
  it("servidor despierto: responde al primer intento sin esperar", async () => {
    const f = fakeDeps([true]);
    expect(await waitForServer(f.deps)).toBe(true);
    expect(f.calls()).toBe(1);
    expect(f.time()).toBe(0);
  });

  it("servidor dormido: reintenta cada 3 s hasta que responde", async () => {
    const f = fakeDeps([false, false, false, true]);
    expect(await waitForServer(f.deps)).toBe(true);
    expect(f.calls()).toBe(4);
    expect(f.time()).toBe(3 * WAKE_RETRY_MS);
  });

  it("un intento que lanza cuenta como dormido", async () => {
    const f = fakeDeps([new Error("red"), true]);
    expect(await waitForServer(f.deps)).toBe(true);
    expect(f.calls()).toBe(2);
  });

  it("se rinde a los 90 s", async () => {
    const f = fakeDeps([false]);
    expect(await waitForServer(f.deps)).toBe(false);
    expect(f.time()).toBeGreaterThanOrEqual(WAKE_TIMEOUT_MS);
    expect(f.time()).toBeLessThan(WAKE_TIMEOUT_MS + WAKE_RETRY_MS);
  });

  it("los intentos lentos también cuentan para los 90 s", async () => {
    const f = fakeDeps([false], 10_000);
    expect(await waitForServer(f.deps)).toBe(false);
    expect(f.calls()).toBeLessThanOrEqual(9);
    expect(f.time()).toBeLessThan(WAKE_TIMEOUT_MS + 13_000);
  });

  it("avisa del tiempo transcurrido antes de cada espera", async () => {
    const f = fakeDeps([false, false, true]);
    const seen: number[] = [];
    await waitForServer(f.deps, (ms) => seen.push(ms));
    expect(seen).toEqual([0, WAKE_RETRY_MS]);
  });
});

describe("pingHealth", () => {
  it("true con 200", async () => expect(await pingHealth("https://x", async () => new Response("ok"))).toBe(true));

  it.each([404, 502, 503])("false con %d", async (status) =>
    expect(await pingHealth("https://x", async () => new Response("", { status }))).toBe(false),
  );

  it("false si la red falla", async () =>
    expect(
      await pingHealth("https://x", async () => {
        throw new TypeError("fetch");
      }),
    ).toBe(false));

  it("consulta /health con límite de tiempo", async () => {
    let url = "";
    let signal: AbortSignal | undefined;
    await pingHealth("https://x", async (u, init) => {
      url = String(u);
      signal = init?.signal ?? undefined;
      return new Response("ok");
    });
    expect(url).toBe("https://x/health");
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});
