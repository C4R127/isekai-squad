import { describe, it, expect } from "vitest";
import { normalizeInput, stepPlayer, MAP_WIDTH, MAP_HEIGHT, PLAYER_SIZE, PLAYER_SPEED } from "../src/index";

describe("normalizeInput", () => {
  it("deja pasar una dirección unitaria", () => {
    expect(normalizeInput({ dx: 1, dy: 0 })).toEqual({ dx: 1, dy: 0 });
  });
  it("recorta los vectores largos a longitud 1", () => {
    const n = normalizeInput({ dx: 3, dy: 4 });
    expect(n.dx).toBeCloseTo(0.6);
    expect(n.dy).toBeCloseTo(0.8);
  });
  it("conserva los vectores cortos (joystick a medias)", () => {
    expect(normalizeInput({ dx: 0.5, dy: 0 })).toEqual({ dx: 0.5, dy: 0 });
  });
  it.each([null, undefined, "hola", 7, {}, { dx: "1", dy: 0 }, { dx: NaN, dy: 1 }, { dx: Infinity, dy: 0 }, []])(
    "convierte %j en dirección cero",
    (raw) => expect(normalizeInput(raw)).toEqual({ dx: 0, dy: 0 }),
  );
});

describe("stepPlayer", () => {
  it("avanza velocidad × tiempo", () => {
    expect(stepPlayer({ x: 100, y: 100 }, { dx: 1, dy: 0 }, 0.05)).toEqual({ x: 100 + PLAYER_SPEED * 0.05, y: 100 });
  });
  it("no cruza los bordes del mapa", () => {
    const half = PLAYER_SIZE / 2;
    expect(stepPlayer({ x: half, y: half }, { dx: -1, dy: -1 }, 0.05)).toEqual({ x: half, y: half });
    const far = stepPlayer({ x: MAP_WIDTH - half, y: MAP_HEIGHT - half }, { dx: 1, dy: 1 }, 0.05);
    expect(far).toEqual({ x: MAP_WIDTH - half, y: MAP_HEIGHT - half });
  });
  it("limita dt a 0.1 s para que no haya teletransportes", () => {
    expect(stepPlayer({ x: 100, y: 100 }, { dx: 1, dy: 0 }, 30).x).toBeCloseTo(100 + PLAYER_SPEED * 0.1);
  });
  it("ignora dt negativo o no finito", () => {
    expect(stepPlayer({ x: 100, y: 100 }, { dx: 1, dy: 0 }, -1)).toEqual({ x: 100, y: 100 });
    expect(stepPlayer({ x: 100, y: 100 }, { dx: 1, dy: 0 }, NaN)).toEqual({ x: 100, y: 100 });
  });
  it("no modifica la posición que recibe", () => {
    const pos = { x: 100, y: 100 };
    stepPlayer(pos, { dx: 1, dy: 1 }, 0.05);
    expect(pos).toEqual({ x: 100, y: 100 });
  });
});
