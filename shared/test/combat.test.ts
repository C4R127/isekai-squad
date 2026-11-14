import { describe, expect, it } from "vitest";
import { BASE_HP, HEROES, angleOf, distance, enemyHp, inArc, nearest, spawnIntervalMs, turnToward } from "../src/index";

describe("balance", () => {
  it("el Guerrero tiene 30 % más vida que la base", () => expect(HEROES.guerrero.maxHp).toBe(BASE_HP * 1.3));

  it("la vida de los enemigos crece con los jugadores", () => {
    expect(enemyHp("slime", 1)).toBe(20);
    expect(enemyHp("slime", 4)).toBe(35); // 20 × (1 + 0.25 × 3)
    expect(enemyHp("slime", 0)).toBe(20);
  });

  it("aparecen más rápido con el tiempo y con más jugadores, sin bajar del mínimo", () => {
    expect(spawnIntervalMs(0, 1)).toBe(1500);
    expect(spawnIntervalMs(90_000, 1)).toBe(950); // mitad de la rampa
    expect(spawnIntervalMs(180_000, 1)).toBe(400);
    expect(spawnIntervalMs(999_000, 1)).toBe(400);
    expect(spawnIntervalMs(0, 4)).toBeCloseTo(1500 / 2.8);
    expect(spawnIntervalMs(999_000, 4)).toBeCloseTo(400 / 2.8);
  });
});

describe("geometría", () => {
  it("distance y angleOf", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(angleOf({ x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
  });

  it("inArc: dentro del radio y del ángulo", () => {
    const o = { x: 0, y: 0 };
    expect(inArc(o, 0, { x: 30, y: 0 }, 44, 120)).toBe(true);
    expect(inArc(o, 0, { x: 45, y: 0 }, 44, 120)).toBe(false); // fuera de radio
    expect(inArc(o, 0, { x: 15, y: 25 }, 44, 120)).toBe(true); // ~59°
    expect(inArc(o, 0, { x: 10, y: 25 }, 44, 120)).toBe(false); // ~68°
    expect(inArc(o, 0, { x: -30, y: 0 }, 44, 120)).toBe(false); // detrás
    expect(inArc(o, Math.PI, { x: -30, y: 1 }, 44, 120)).toBe(true); // cruza el salto de ±π
    expect(inArc(o, 0, o, 44, 120)).toBe(true); // encima
  });

  it("nearest: el más cercano, o null si no hay", () => {
    expect(nearest({ x: 0, y: 0 }, [{ x: 9, y: 0 }, { x: 3, y: 0 }])).toEqual({ x: 3, y: 0 });
    expect(nearest({ x: 0, y: 0 }, [])).toBeNull();
  });

  it("turnToward: gira por el lado corto sin pasarse", () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(turnToward(0, 0.1, 0.25)).toBeCloseTo(0.1);
    expect(turnToward(3, -3, 0.25)).toBeCloseTo(3.25); // por el lado corto, cruzando π
  });
});
