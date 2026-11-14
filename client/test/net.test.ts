import { describe, expect, it } from "vitest";
import { resolveServerUrl } from "../src/net";

const loc = { protocol: "http:", hostname: "192.168.1.20" };

describe("resolveServerUrl", () => {
  it("sin variable usa el mismo equipo en el puerto 2567", () =>
    expect(resolveServerUrl(undefined, loc)).toBe("http://192.168.1.20:2567"));
  it("vacía o solo espacios cuenta como ausente", () => {
    expect(resolveServerUrl("", loc)).toBe("http://192.168.1.20:2567");
    expect(resolveServerUrl("   ", loc)).toBe("http://192.168.1.20:2567");
  });
  it("usa la variable y quita las barras finales", () =>
    expect(resolveServerUrl(" https://x.onrender.com// ", loc)).toBe("https://x.onrender.com"));
});
