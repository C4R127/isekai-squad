import { describe, it, expect } from "vitest";
import { sanitizeName, sanitizeHeroClass } from "../src/index";

describe("sanitizeName", () => {
  it("quita espacios de los extremos", () => expect(sanitizeName("  Kira  ")).toBe("Kira"));
  it("recorta a 12 caracteres", () => expect(sanitizeName("a".repeat(50))).toBe("a".repeat(12)));
  it("no parte un emoji por la mitad", () => expect(sanitizeName("😀".repeat(20))).toBe("😀".repeat(12)));
  it.each(["", "    ", null, undefined, 42, {}])("usa Héroe para %j", (raw) => expect(sanitizeName(raw)).toBe("Héroe"));
  it("sustituye saltos de línea y tabulaciones por espacios", () => expect(sanitizeName("A\n\tB")).toBe("A B"));
});

describe("sanitizeHeroClass", () => {
  it("acepta maga", () => expect(sanitizeHeroClass("maga")).toBe("maga"));
  it.each(["ninja", "", null, 3])("usa guerrero para %j", (raw) => expect(sanitizeHeroClass(raw)).toBe("guerrero"));
});
