import { describe, expect, it } from "vitest";
import { computeZoom } from "../src/screen";

describe("computeZoom", () => {
  it.each([
    [1920, 1080, 1, 4], // monitor Full HD
    [1366, 768, 1, 2], // portátil
    [844, 390, 3, 4], // iPhone en horizontal: 2532×1170 físicos
    [800, 360, 2.625, 3], // Android gama media: 2100×945 físicos
    [300, 200, 1, 1], // ventana diminuta: nunca menos de 1
    [0, 0, 1, 1],
    [1920, 1080, NaN, 4], // dpr inválido se trata como 1
    [1920, 1080, 0, 4],
  ])("computeZoom(%d, %d, %d) = %d", (w, h, dpr, zoom) => {
    expect(computeZoom(w, h, dpr)).toBe(zoom);
  });
});
