# Etapa 3 — Combate base: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los jugadores eligen Guerrero o Maga, aparecen enemigos que los persiguen, los héroes atacan solos, pierden vida, caen, se reviven entre sí y, si caen todos, pierden y pueden volver a empezar.

**Architecture:** Toda la simulación de combate vive en una clase `World` del servidor, hecha de datos planos y sin dependencia de Colyseus, para poder probarla con un reloj y un azar controlados. `LevelRoom` solo traduce mensajes a llamadas de `World`, avanza un paso cada 50 ms, copia el resultado al estado sincronizado y retransmite los efectos visuales. El cliente dibuja lo que recibe con marcadores de colores e interpola.

**Tech Stack:** el de las etapas 1 y 2. Sin dependencias nuevas.

**Spec:** `docs/2026-11-14-isekai-squad-design.md` (sección 6: Clases, Enemigos, Reglas de la partida; sección 11.3).

## Global Constraints

- Ataques **automáticos**: el jugador solo se mueve.
- **Guerrero:** corte en arco frente a la dirección de movimiento, cada **0.8 s**; **+30 %** de vida máxima.
- **Maga:** orbe que busca al enemigo más cercano, cada **1 s**. (Su pasiva de recoger experiencia llega en la etapa 4.)
- **Slime:** lento, va directo al jugador más cercano. **Goblin:** velocidad media, aparece en grupos de **3 a 5**. **Murciélago:** rápido, en zigzag, poca vida.
- **Caer y revivir:** con 0 de vida el jugador **cae** (no muere). Un compañero lo revive quedándose **3 s** a su lado. Si caen todos, **se pierde**. Jugando solo, al caer se pierde.
- Como máximo **150 enemigos** vivos por sala.
- La cantidad y la vida de los enemigos **aumentan con el número de jugadores**.
- Todos los números de balance viven en `shared/src/balance.ts`.
- Servidor autoritativo a 20 pasos por segundo; el cliente sigue enviando solo su dirección.
- Marcadores de colores con los tamaños de la lista de arte: héroes 32×32, slime 16×16, goblin 24×24, murciélago 16×16, orbe 8×8.
- Interfaz en español. Sin oleadas, experiencia, mejoras ni jefe: son la etapa 4.

## Decisiones de este plan (cambiables)

- **Aparición de enemigos sin oleadas:** un generador continuo que acelera con el tiempo. Slimes desde el inicio, goblins desde los 30 s, murciélagos desde los 60 s. La etapa 4 lo sustituye por las 5 oleadas.
- **Al revivir:** el jugador vuelve con el 50 % de su vida y 2 s sin recibir daño.
- **Jugador desconectado:** mientras espera reconexión no lo atacan ni recibe daño, y no cuenta para decidir la derrota.
- **Reinicio:** tras la derrota, cualquier jugador puede pulsar "Jugar otra vez".
- **Elegir clase:** dos botones antes de entrar a la sala; se recuerda la última clase en el dispositivo.
- **Posiciones de enemigos y orbes** se sincronizan como enteros de 16 bits para gastar poco tráfico (unos 18 KB/s con 150 enemigos, en vez de unos 54 KB/s).

## Review Focus

1. **Un jugador se desconecta en pleno combate:** nadie lo ataca, no pierde vida y no bloquea ni provoca la derrota de los demás; si es el único jugador en pie conectado y los demás están caídos, la partida se pierde. → Task 4.
2. **El que revive se aleja, cae o se desconecta a mitad:** el progreso vuelve a 0; nadie queda "medio revivido". → Task 4.
3. **`restart` fuera de lugar** (durante la partida, repetido, con datos basura): se ignora. → Task 4 y Task 5.
4. **Presión máxima** (4 jugadores, mucho tiempo): nunca hay más de 150 enemigos y un paso de simulación sigue siendo rápido. → Task 2 y Task 5.
5. **Atacar sin objetivo:** la Maga no dispara si no hay enemigos; un orbe cuyo objetivo muere sigue recto y desaparece al acabar su tiempo o salir del mapa; el corte del Guerrero quieto usa su última dirección (derecha si nunca se movió). → Task 3.

---

## Estructura de archivos

```
shared/src/balance.ts              # todos los números de combate
shared/src/combat.ts               # tipos y geometría pura (ángulos, arco, distancia)
shared/test/combat.test.ts
server/src/sim/world.ts            # World: estado plano + step()
server/src/sim/spawner.ts          # cuándo y dónde aparecen enemigos
server/src/sim/enemies.ts          # movimiento, separación y daño por contacto
server/src/sim/attacks.ts          # corte, orbes
server/src/sim/revive.ts           # caer, revivir, derrota
server/test/sim/*.test.ts          # una por módulo
server/src/state.ts                # (modificar) Player +vida; Enemy; Projectile; phase
server/src/rooms/LevelRoom.ts      # (modificar) usa World
server/test/LevelRoom.test.ts      # (modificar)
client/src/profile.ts              # (modificar) última clase
client/src/scenes/BootScene.ts     # (modificar) elegir clase
client/src/scenes/GameScene.ts     # (modificar) orquesta
client/src/view/entities.ts        # vistas de jugadores, enemigos y orbes
client/src/view/fx.ts              # corte, golpe, muerte
client/src/view/hud.ts             # vida, compañeros, derrota
```

---

### Task 1: Balance y geometría compartidos

**Files:**
- Create: `shared/src/balance.ts`, `shared/src/combat.ts`, `shared/test/combat.test.ts`
- Modify: `shared/src/index.ts`

**Interfaces — Produces:**

```ts
// balance.ts
export type EnemyKind = "slime" | "goblin" | "murcielago";
export const BASE_HP = 100;
export const HEROES: Record<HeroClass, { maxHp: number; attackIntervalMs: number; damage: number }> = {
  guerrero: { maxHp: 130, attackIntervalMs: 800, damage: 12 },   // 130 = BASE_HP + 30 %
  maga:     { maxHp: 100, attackIntervalMs: 1000, damage: 10 },
};
export const SLASH = { radius: 44, arcDegrees: 120 };
export const ORB = { speed: 160, radius: 4, lifetimeMs: 2000, turnDegPerSec: 360 };
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; damage: number; size: number }> = {
  slime:      { hp: 20, speed: 30, damage: 8,  size: 16 },
  goblin:     { hp: 30, speed: 55, damage: 10, size: 24 },
  murcielago: { hp: 10, speed: 90, damage: 6,  size: 16 },
};
export const BAT_ZIGZAG = { periodMs: 600, lateral: 0.8 };
export const CONTACT_COOLDOWN_MS = 600;
export const REVIVE = { radius: 28, durationMs: 3000, hpFraction: 0.5, invulnerableMs: 2000 };
export const MAX_ENEMIES = 150;
export const SPAWN = {
  startIntervalMs: 1500, minIntervalMs: 400, rampSeconds: 180,
  minDistance: 220, maxDistance: 320,
  goblinGroup: [3, 5] as const,
  unlockSeconds: { slime: 0, goblin: 30, murcielago: 60 } as Record<EnemyKind, number>,
};
export const PLAYER_SCALING = { spawnRatePerExtraPlayer: 0.6, hpPerExtraPlayer: 0.25 };
export function enemyHp(kind: EnemyKind, players: number): number;      // redondeado, mínimo 1 jugador
export function spawnIntervalMs(elapsedMs: number, players: number): number;

// combat.ts
export function distance(a: Vec2, b: Vec2): number;
export function angleOf(v: Vec2): number;                               // radianes, atan2(y, x)
export function inArc(origin: Vec2, facingRad: number, target: Vec2, radius: number, arcDegrees: number): boolean;
export function nearest<T extends Vec2>(from: Vec2, items: Iterable<T>): T | null;
export function turnToward(currentRad: number, targetRad: number, maxStepRad: number): number;
```

- [ ] **Step 1: Pruebas que fallan** (`shared/test/combat.test.ts`)

```ts
it("el Guerrero tiene 30 % más vida que la base", () => expect(HEROES.guerrero.maxHp).toBe(BASE_HP * 1.3));
it("la vida de los enemigos crece con los jugadores", () => {
  expect(enemyHp("slime", 1)).toBe(20);
  expect(enemyHp("slime", 4)).toBe(35);          // 20 × (1 + 0.25 × 3)
  expect(enemyHp("slime", 0)).toBe(20);
});
it("aparecen más rápido con el tiempo y con más jugadores, sin bajar del mínimo", () => {
  expect(spawnIntervalMs(0, 1)).toBe(1500);
  expect(spawnIntervalMs(90_000, 1)).toBe(950);  // mitad de la rampa
  expect(spawnIntervalMs(180_000, 1)).toBe(400);
  expect(spawnIntervalMs(999_000, 1)).toBe(400);
  expect(spawnIntervalMs(0, 4)).toBeCloseTo(1500 / 2.8);
  expect(spawnIntervalMs(999_000, 4)).toBeCloseTo(400 / 2.8);
});
it("inArc: dentro del radio y del ángulo", () => {
  const o = { x: 0, y: 0 };
  expect(inArc(o, 0, { x: 30, y: 0 }, 44, 120)).toBe(true);
  expect(inArc(o, 0, { x: 45, y: 0 }, 44, 120)).toBe(false);    // fuera de radio
  expect(inArc(o, 0, { x: 15, y: 25 }, 44, 120)).toBe(true);    // ~59°
  expect(inArc(o, 0, { x: 10, y: 25 }, 44, 120)).toBe(false);   // ~68°
  expect(inArc(o, 0, { x: -30, y: 0 }, 44, 120)).toBe(false);   // detrás
  expect(inArc(o, Math.PI, { x: -30, y: 1 }, 44, 120)).toBe(true); // cruza el salto de ±π
  expect(inArc(o, 0, o, 44, 120)).toBe(true);                   // encima
});
it("nearest: el más cercano, o null si no hay", () => {
  expect(nearest({ x: 0, y: 0 }, [{ x: 9, y: 0 }, { x: 3, y: 0 }])).toEqual({ x: 3, y: 0 });
  expect(nearest({ x: 0, y: 0 }, [])).toBeNull();
});
it("turnToward: gira por el lado corto sin pasarse", () => {
  expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
  expect(turnToward(0, 0.1, 0.25)).toBeCloseTo(0.1);
  expect(turnToward(3, -3, 0.25)).toBeCloseTo(3.25);            // por el lado corto, cruzando π
});
```

- [ ] **Step 2:** Run: `npx vitest run shared` → FAIL.
- [ ] **Step 3:** Implementar. `spawnIntervalMs` = interpolación lineal de `startIntervalMs` a `minIntervalMs` a lo largo de `rampSeconds`, dividida entre `1 + 0.6 × (jugadores − 1)`.
- [ ] **Step 4:** Run: `npx vitest run shared` → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat(shared): balance y geometría de combate`

---

### Task 2: Simulación — mundo, generador y enemigos

**Files:**
- Create: `server/src/sim/world.ts`, `server/src/sim/spawner.ts`, `server/src/sim/enemies.ts`
- Test: `server/test/sim/world.test.ts`, `server/test/sim/spawner.test.ts`, `server/test/sim/enemies.test.ts`

**Interfaces — Produces:**

```ts
export type PlayerSim = {
  id: string; name: string; heroClass: HeroClass;
  x: number; y: number; hp: number; maxHp: number;
  connected: boolean; downed: boolean; reviveProgress: number;   // 0..1
  facing: Vec2;                 // última dirección no nula, unitaria; inicial {x: 1, y: 0}
  input: MoveMessage; attackTimerMs: number; invulnerableMs: number;
};
export type EnemySim = { id: string; kind: EnemyKind; x: number; y: number; hp: number; contactCooldownMs: number; ageMs: number };
export type ProjectileSim = { id: string; ownerId: string; x: number; y: number; angle: number; damage: number; lifeMs: number };
export type SimEvent =
  | { type: "slash"; x: number; y: number; angle: number }
  | { type: "hit"; x: number; y: number }
  | { type: "enemyDied"; x: number; y: number; kind: EnemyKind }
  | { type: "downed"; id: string }
  | { type: "revived"; id: string };

export class World {
  phase: "playing" | "defeat";
  elapsedMs: number;
  readonly players: Map<string, PlayerSim>;
  readonly enemies: Map<string, EnemySim>;
  readonly projectiles: Map<string, ProjectileSim>;
  constructor(random?: () => number);                 // por defecto Math.random
  addPlayer(id: string, name: string, heroClass: HeroClass): PlayerSim;   // vida completa, punto de aparición de la etapa 1
  removePlayer(id: string): void;
  setInput(id: string, input: MoveMessage): void;     // se ignora si está caído o desconectado
  setConnected(id: string, connected: boolean): void; // al desconectar, input a cero
  spawnEnemy(kind: EnemyKind, x: number, y: number): EnemySim | null;     // null si ya hay MAX_ENEMIES
  step(dtMs: number): SimEvent[];                     // no hace nada si phase === "defeat"
  restart(): void;                                    // Task 4
}
/** Jugadores a los que se puede atacar: conectados y en pie. */
export function activePlayers(world: World): PlayerSim[];
```

Orden dentro de `step`: mover jugadores (con `stepPlayer`) → generador → mover enemigos → ataques (Task 3) → orbes (Task 3) → daño por contacto → revivir y derrota (Task 4).

- [ ] **Step 1: Pruebas que fallan**

`world.test.ts`:
- `addPlayer` da 130 de vida al guerrero y 100 a la maga; `facing` es `{x:1,y:0}`.
- Tras `setInput(id, {dx:0, dy:-1})` y `step(50)`, `y` baja 4 px (80 px/s) y `facing` es `{x:0,y:-1}`; con input cero `facing` no cambia.
- Un jugador desconectado no se mueve aunque tuviera input.
- `spawnEnemy` devuelve `null` cuando ya hay 150, y `enemies.size` sigue en 150.
- Con `phase = "defeat"`, `step(50)` devuelve `[]` y no cambia `elapsedMs`.

`spawner.test.ts` (azar fijo, por ejemplo `() => 0.5`):
- Sin jugadores activos no aparece nada tras 10 s de pasos.
- Con 1 jugador, tras 1500 ms aparece exactamente 1 enemigo, y es un slime.
- Antes de los 30 s nunca aparece un goblin; antes de los 60 s, nunca un murciélago (300 pasos de 100 ms con azar variado).
- Cuando sale un goblin, salen entre 3 y 5 juntos (a menos de 40 px entre sí).
- Todo enemigo aparece dentro del mapa y a 200 px o más de cualquier jugador activo.
- 4 jugadores, 10 minutos simulados sin que nadie ataque: `enemies.size` nunca supera 150.
- La vida inicial usa `enemyHp(kind, jugadores activos)`.

`enemies.test.ts`:
- Un slime a 100 px a la derecha del jugador se acerca 1.5 px en un paso de 50 ms (30 px/s).
- Con dos jugadores, persigue al más cercano; ignora a uno caído o desconectado aunque esté más cerca.
- Sin jugadores activos, los enemigos se quedan quietos.
- Un murciélago avanza hacia el jugador pero su trayectoria no es recta: en 1.2 s, la desviación lateral máxima respecto a la línea recta supera 5 px, y aun así termina más cerca.
- Dos slimes en el mismo punto se separan: tras 10 pasos su distancia es > 4 px.
- Contacto: un slime tocando al jugador (distancia < (16 + 32) / 2) le quita 8 de vida una vez, y no vuelve a quitar hasta pasados 600 ms.
- Un jugador con `invulnerableMs > 0` no recibe daño.
- Los enemigos no salen del mapa.

- [ ] **Step 2:** Run: `npx vitest run server/test/sim` → FAIL.
- [ ] **Step 3:** Implementar. Punto de aparición: elegir un jugador activo al azar, un ángulo al azar y una distancia entre `minDistance` y `maxDistance`; recortar al mapa; si queda a menos de 200 px de algún jugador activo, reintentar hasta 8 veces y, si no se logra, no generar en este paso. Tipo de enemigo: al azar entre los desbloqueados. Separación: empuje suave entre pares que se solapan (un bucle doble basta: 150² comparaciones por paso es poco). Zigzag del murciélago: a la dirección hacia el jugador se le suma una componente perpendicular `sin(2π · ageMs / periodMs) · lateral`, y se normaliza.
- [ ] **Step 4:** Run: `npx vitest run server/test/sim` → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat(server): mundo de simulación, generador y enemigos`

---

### Task 3: Simulación — ataques automáticos

**Files:**
- Create: `server/src/sim/attacks.ts`, `server/test/sim/attacks.test.ts`
- Modify: `server/src/sim/world.ts` (llamar a los ataques en `step`)

**Interfaces — Produces:** `stepAttacks(world: World, dtMs: number, events: SimEvent[]): void` y `stepProjectiles(world: World, dtMs: number, events: SimEvent[]): void`. Un enemigo con `hp <= 0` se elimina de `world.enemies` y emite `enemyDied`.

- [ ] **Step 1: Pruebas que fallan**

- Guerrero mirando a la derecha con un slime (20 de vida) a 30 px delante: tras 800 ms de pasos hay un evento `slash` con `angle` 0 y la posición del guerrero, el slime queda con 8 de vida y hay un evento `hit`. A los 1600 ms el slime muere: sale de `enemies` y hay un `enemyDied` con `kind: "slime"`.
- El corte golpea a **todos** los enemigos dentro del arco (3 slimes delante: los 3 pierden 12) y a ninguno detrás.
- El guerrero ataca aunque no haya enemigos (evento `slash` cada 800 ms): es su animación.
- Guerrero que nunca se movió: corta hacia la derecha. Tras moverse hacia arriba y detenerse: corta hacia arriba.
- Maga con un slime a 100 px: a los 1000 ms existe 1 orbe, que nace en la maga apuntando al slime; el orbe avanza 8 px por paso de 50 ms (160 px/s); al tocarlo (distancia < 4 + 16/2) le quita 10, desaparece y emite `hit`.
- Maga sin enemigos: tras 5 s no hay ningún orbe.
- El orbe busca: si el objetivo más cercano se desplaza a un lado, el ángulo del orbe gira hacia él como máximo 18° por paso de 50 ms (360°/s).
- Orbe cuyo objetivo murió: sigue recto y desaparece a los 2000 ms de vida; también desaparece si sale del mapa.
- Un jugador caído o desconectado no ataca, y su temporizador no avanza.
- Un orbe solo daña a un enemigo (dos slimes pegados: solo uno pierde vida).

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run: `npx vitest run server` → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat(server): ataques automáticos de Guerrero y Maga`

---

### Task 4: Simulación — caer, revivir, derrota; e integración en la sala

**Files:**
- Create: `server/src/sim/revive.ts`, `server/test/sim/revive.test.ts`
- Modify: `server/src/sim/world.ts`, `server/src/state.ts`, `server/src/rooms/LevelRoom.ts`, `server/test/LevelRoom.test.ts`

**Interfaces — Produces:**

```ts
// state.ts (estilo schema(); enteros compactos donde se indica)
Player:     name, heroClass, x, y, connected            // como en la etapa 1
            + hp: t.int16(), maxHp: t.int16(), downed: t.boolean(), reviveProgress: t.float32()
Enemy:      kind: t.string(), x: t.int16(), y: t.int16(), hp: t.int16()
Projectile: x: t.int16(), y: t.int16()
LevelState: players: map<Player>, enemies: map<Enemy>, projectiles: map<Projectile>, phase: t.string()  // "playing" | "defeat"
```

Mensajes cliente → servidor: `"move"` (igual), `"restart"` (sin datos; solo vale en `"defeat"`), `"debug:fill"` (solo si `process.env.NODE_ENV !== "production"`: rellena hasta 150 enemigos alrededor de los jugadores). Servidor → cliente: `"fx"` con `SimEvent[]`, solo cuando el paso produjo eventos.

- [ ] **Step 1: Pruebas que fallan** (`revive.test.ts`)

- Un jugador cuya vida llega a 0 queda `downed`, con `hp` 0, input a cero, y se emite `downed`. No sigue moviéndose ni atacando, y los enemigos dejan de perseguirlo.
- Solo: al caer, `phase` pasa a `"defeat"`.
- Dos jugadores, cae uno: `phase` sigue en `"playing"`.
- Revivir: el compañero en pie a 20 px durante 3000 ms → `downed` falso, vida = 50 % de la máxima (65 para un guerrero), `invulnerableMs` 2000, evento `revived`. `reviveProgress` vale 0.5 a los 1500 ms.
- Si el compañero se aleja a más de 28 px a los 2 s, `reviveProgress` vuelve a 0; al regresar hacen falta otros 3 s completos.
- Si el que revive cae o se desconecta a mitad, el progreso vuelve a 0.
- Un jugador caído no puede revivir a otro.
- Caen los dos: `"defeat"`.
- Dos jugadores, uno caído y el otro se desconecta: `"defeat"` (no queda nadie en pie conectado). Si el desconectado es el caído y el otro sigue en pie: `"playing"`.
- `restart()`: `phase` `"playing"`, `elapsedMs` 0, sin enemigos ni orbes, todos los jugadores en pie con vida completa en sus puntos de aparición.

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar `revive.ts` y completar `World.step` y `World.restart`. **Step 4:** Run: `npx vitest run server/test/sim` → PASS.

- [ ] **Step 5: Pruebas de la sala que fallan** (añadir a `server/test/LevelRoom.test.ts`; las de la etapa 1 deben seguir pasando)

- Al entrar, el estado del jugador trae `hp` y `maxHp` según su clase y `phase` es `"playing"`.
- Tras unos segundos aparece al menos un enemigo en `state.enemies` con `kind`, posición entera y `hp`.
- Un cliente Guerrero recibe mensajes `"fx"` que contienen un `slash`.
- `"restart"` durante `"playing"` no cambia nada (los enemigos siguen ahí).
- Forzando la derrota (poner en 0 la vida del único jugador desde la prueba y avanzar un paso): `phase` es `"defeat"`, deja de haber enemigos nuevos; tras `"restart"` vuelve a `"playing"` con vida completa y sin enemigos.
- `"debug:fill"` deja `state.enemies.size` en 150.
- **Rendimiento:** con 4 jugadores y 150 enemigos, 200 llamadas a `world.step(50)` tardan menos de 400 ms en total (2 ms por paso de media).

- [ ] **Step 6:** Run → FAIL. **Step 7:** Reescribir `LevelRoom` sobre `World`: `onJoin` → `addPlayer`; `move` → `setInput`; `onDrop`/`onReconnect` → `setConnected`; `onLeave` → `removePlayer`. En cada paso: `world.step(TICK_MS)`, copiar jugadores, enemigos y orbes al estado (crear, actualizar con `Math.round` en los campos enteros, borrar los que ya no existen) y `broadcast("fx", events)` si hay eventos. La sala no avanza la simulación si no hay ningún cliente conectado.
- [ ] **Step 8:** Run: `npm test` → todo PASS; `npm run typecheck`.
- [ ] **Step 9: Commit** — `feat(server): caer, revivir, derrota y sala sobre la simulación`

---

### Task 5: Cliente — elegir clase y ver el combate

**Files:**
- Create: `client/src/view/entities.ts`, `client/src/view/fx.ts`, `client/src/view/hud.ts`, `client/test/profile.test.ts`
- Modify: `client/src/profile.ts`, `client/src/scenes/BootScene.ts`, `client/src/scenes/GameScene.ts`

**Interfaces — Produces:** `loadHeroClass(): HeroClass`, `saveHeroClass(c: HeroClass): void` (clave `isekai.clase`, por defecto `"guerrero"`).

- [ ] **Step 1: Prueba que falla** (`client/test/profile.test.ts`, con un `localStorage` falso en `globalThis`)

- Sin nada guardado → `"guerrero"`. Tras `saveHeroClass("maga")` → `"maga"`. Un valor guardado inválido (`"ninja"`) → `"guerrero"`. Si `localStorage` lanza al leer o escribir, no se propaga el error.

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.

- [ ] **Step 5: Pantalla de clase en `BootScene`**

Después de comprobar que el servidor está despierto y antes de conectar: título "Elige tu clase" y dos tarjetas-botón, con la última usada resaltada:
- **Guerrero** (cuadro rojo): "Cuerpo a cuerpo y resistente. Corta en arco hacia donde camina."
- **Maga** (cuadro azul): "A distancia y frágil. Lanza orbes que buscan al enemigo."

Se elige con clic/toque o con las teclas 1 y 2. Al elegir: `saveHeroClass` y conectar con esa clase.

- [ ] **Step 6: `GameScene` y vistas**

- **Enemigos:** rectángulos del tamaño de `ENEMIES[kind].size` — slime verde `#7bd389`, goblin oliva `#a3b18a` con borde oscuro, murciélago morado `#9d4edd`. Se crean y destruyen siguiendo `state.enemies`, e interpolan su posición con `interpolate`.
- **Orbes:** círculo celeste de 8 px, interpolado.
- **Efectos** (mensaje `"fx"`): `slash` → un sector de 120° y radio 44 blanco semitransparente que se desvanece en 150 ms; `hit` → destello blanco de 16 px durante 100 ms; `enemyDied` → el cuadro se encoge y desvanece en 200 ms; `downed`/`revived` → un texto breve sobre el jugador ("¡Cayó!", "¡De vuelta!").
- **Jugadores:** barra de vida pequeña sobre cada uno. Caído: gris, girado 90° y con el texto "¡Revíveme!"; mientras lo reviven, una barra de progreso que se llena según `reviveProgress`. El jugador propio caído no puede moverse (no se predice movimiento).
- **HUD:** arriba a la izquierda, la vida propia como barra con números ("87 / 130") encima de "Jugadores: N/4"; debajo, una línea por compañero con nombre y vida.
- **Derrota** (`phase === "defeat"`): velo oscuro, "Derrota" y el botón "Jugar otra vez" (envía `"restart"`; también con la tecla Enter). Desaparece cuando `phase` vuelve a `"playing"`.
- **Depuración:** solo si `import.meta.env.DEV`, la tecla F9 envía `"debug:fill"`.

- [ ] **Step 7: Verificación en el navegador (vista previa, dos pestañas)**

1. Abrir el juego: aparece "Elige tu clase". Elegir Guerrero → entra con 130 de vida.
2. Esperar: llegan slimes que lo persiguen; cada 0.8 s se ve el corte; los slimes delante desaparecen con su efecto.
3. Quedarse quieto entre enemigos: la vida baja; al llegar a 0 aparece "Derrota". "Jugar otra vez" reinicia con vida completa y sin enemigos.
4. Segunda pestaña como Maga en la misma sala: se ven sus orbes ir hacia los enemigos, en ambas pestañas.
5. Dejar caer a uno y acercar al otro: la barra de revivir se llena en 3 s y el jugador vuelve con media vida.
6. Recargar: la pantalla de clase resalta la última elegida.
7. Pulsar F9 (150 enemigos) y medir los cuadros por segundo durante 5 s con `requestAnimationFrame` en la consola: 55 o más en PC. Anotar el valor real. (La medida en celular se hace en la etapa 5.)
8. Consola sin errores; capturas de los pasos 2, 4 y 5.

- [ ] **Step 8:** Run: `npm test`, `npm run typecheck`, `npm run build -w client` → todo bien.
- [ ] **Step 9: Commit** — `feat(client): elección de clase y combate en pantalla`

---

## Fuera de esta etapa

Experiencia, gemas, mejoras, las 5 oleadas, el Rey Slime y la victoria (etapa 4); joystick y medición en celular (etapa 5); sala de espera, mapa del mundo y resultados (etapa 6); sprites reales (etapa 7).
