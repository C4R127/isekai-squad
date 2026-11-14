import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadHeroClass, saveHeroClass } from "../src/profile";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("última clase usada", () => {
  const original = (globalThis as { localStorage?: unknown }).localStorage;
  const setStorage = (value: unknown) =>
    Object.defineProperty(globalThis, "localStorage", { value, configurable: true, writable: true });

  beforeEach(() => setStorage(fakeStorage()));
  afterEach(() => setStorage(original));

  it("sin nada guardado es guerrero", () => expect(loadHeroClass()).toBe("guerrero"));

  it("recuerda la clase elegida", () => {
    saveHeroClass("maga");
    expect(loadHeroClass()).toBe("maga");
  });

  it("un valor guardado inválido cuenta como guerrero", () => {
    setStorage(fakeStorage({ "isekai.clase": "ninja" }));
    expect(loadHeroClass()).toBe("guerrero");
  });

  it("si el almacenamiento falla, no se rompe", () => {
    setStorage({
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(loadHeroClass()).toBe("guerrero");
    expect(() => saveHeroClass("maga")).not.toThrow();
  });
});
