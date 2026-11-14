import { describe, expect, it } from "vitest";
import { inputFromKeys, interpolate, reconcile, sameInput, SNAP_DISTANCE } from "../src/motion";

const none = { left: false, right: false, up: false, down: false };

describe("inputFromKeys", () => {
  it("sin teclas no hay movimiento", () => expect(inputFromKeys(none)).toEqual({ dx: 0, dy: 0 }));
  it("derecha", () => expect(inputFromKeys({ ...none, right: true })).toEqual({ dx: 1, dy: 0 }));
  it("arriba es y negativa", () => expect(inputFromKeys({ ...none, up: true })).toEqual({ dx: 0, dy: -1 }));
  it("teclas opuestas se anulan", () =>
    expect(inputFromKeys({ left: true, right: true, up: true, down: true })).toEqual({ dx: 0, dy: 0 }));
  it("en diagonal no se va más rápido", () => {
    const i = inputFromKeys({ ...none, right: true, down: true });
    expect(Math.hypot(i.dx, i.dy)).toBeCloseTo(1);
    expect(i.dx).toBeCloseTo(Math.SQRT1_2);
    expect(i.dy).toBeCloseTo(Math.SQRT1_2);
  });
});

describe("sameInput", () => {
  it("compara direcciones", () => {
    expect(sameInput({ dx: 1, dy: 0 }, { dx: 1, dy: 0 })).toBe(true);
    expect(sameInput({ dx: 1, dy: 0 }, { dx: 0, dy: 0 })).toBe(false);
  });
});

describe("reconcile (personaje propio)", () => {
  it("salta a la posición del servidor si está muy lejos", () => {
    const server = { x: 100 + SNAP_DISTANCE + 1, y: 100 };
    expect(reconcile({ x: 100, y: 100 }, server, 16)).toEqual(server);
  });
  it("se acerca poco a poco si está cerca", () => {
    const r = reconcile({ x: 100, y: 100 }, { x: 110, y: 100 }, 16.67);
    expect(r.x).toBeGreaterThan(100.5);
    expect(r.x).toBeLessThan(102);
    expect(r.y).toBe(100);
  });
  it("no se mueve si ya coincide", () =>
    expect(reconcile({ x: 50, y: 60 }, { x: 50, y: 60 }, 16)).toEqual({ x: 50, y: 60 }));
  it("con un cuadro larguísimo llega al servidor sin pasarse", () => {
    const r = reconcile({ x: 100, y: 100 }, { x: 110, y: 100 }, 60000);
    expect(r.x).toBeGreaterThan(109.9);
    expect(r.x).toBeLessThanOrEqual(110);
  });
});

describe("interpolate (los demás jugadores)", () => {
  it("avanza hacia el objetivo sin pasarse", () => {
    const r = interpolate({ x: 0, y: 0 }, { x: 40, y: 0 }, 16.67);
    expect(r.x).toBeGreaterThan(4);
    expect(r.x).toBeLessThan(20);
  });
  it("con delta 0, negativo o no finito no se mueve", () => {
    expect(interpolate({ x: 0, y: 0 }, { x: 40, y: 0 }, 0)).toEqual({ x: 0, y: 0 });
    expect(interpolate({ x: 0, y: 0 }, { x: 40, y: 0 }, -5)).toEqual({ x: 0, y: 0 });
    expect(interpolate({ x: 0, y: 0 }, { x: 40, y: 0 }, NaN)).toEqual({ x: 0, y: 0 });
  });
  it("salta si el objetivo está muy lejos (reaparición)", () => {
    const target = { x: SNAP_DISTANCE * 3, y: 0 };
    expect(interpolate({ x: 0, y: 0 }, target, 16)).toEqual(target);
  });
});
