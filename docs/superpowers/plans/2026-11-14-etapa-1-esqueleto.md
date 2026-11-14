# Etapa 1 — Esqueleto: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dos jugadores abren el juego en el navegador, uno crea una sala, le pasa el link al otro, y ambos se ven moverse en el mismo mapa en tiempo real.

**Architecture:** Monorepo con npm workspaces: `shared/` (constantes y lógica de movimiento pura), `server/` (Colyseus autoritativo, simula a 20 ticks/s) y `client/` (Phaser 4 + Vite). El cliente envía solo su dirección; predice su propio movimiento con la misma función de `shared/` que usa el servidor e interpola a los demás.

**Tech Stack:** TypeScript 7, Node 24, Phaser 4.2, Colyseus 0.18 (`colyseus`, `@colyseus/sdk`, `@colyseus/schema` 5, `@colyseus/testing`), Vite 8, Vitest 5, tsx.

**Spec:** `docs/2026-11-14-isekai-squad-design.md` (secciones 5, 7, 8 y 11.1). Este plan cubre solo la etapa 1; cada etapa siguiente tendrá su propio plan.

## Global Constraints

- TypeScript en todo el proyecto; separación estricta `client/` · `server/` · `shared/`.
- Resolución base **480×270**, `pixelArt: true`, zoom entero calculado sobre **píxeles físicos** (CSS × `devicePixelRatio`).
- Mapa del Bosque: **3×3 pantallas = 1440×810**, con bordes que no se cruzan.
- Servidor autoritativo a **20 actualizaciones por segundo**; sala `LevelRoom` con capacidad **4**.
- El cliente envía **solo su dirección de movimiento**. Predicción para el personaje propio, interpolación para los demás.
- Desconexión: el lugar se guarda **30 s**; si no vuelve, el personaje desaparece.
- Link de invitación: `<url del juego>?sala=<roomId>`.
- Idioma de la interfaz: **español**. Nombres de código en inglés.
- Sin cuentas, sin instalar nada. El nombre se guarda en `localStorage`.
- Todo número de balance vive en `shared/` (en esta etapa: `PLAYER_SPEED`).
- Personajes sin arte todavía: rectángulos de color de **32×32**.

## Notas de API (las librerías cambiaron; no usar ejemplos antiguos)

- **Phaser 4:** `import * as Phaser from "phaser"` (el import por defecto ya no existe).
- **Colyseus 0.18, servidor:** `import { defineServer, defineRoom, Room, Client } from "colyseus"`. `defineServer({ rooms: { level: defineRoom(LevelRoom) }, express: (app) => {...} })` devuelve el servidor; `.listen(port)`. En la sala: `state = new LevelState()`, `maxClients = 4`, mensajes con `messages = { move: (client, payload) => {} }`, bucle con `this.setTimestep(cb)` / `setSimulationInterval(cb, ms)`. Ciclo de vida: `onJoin(client, options)`, `onDrop(client, code)` (desconexión no voluntaria → llamar `this.allowReconnection(client, 30)`), `onReconnect(client)`, `onLeave(client, code)` (salida definitiva → borrar al jugador). No existe `client.id`: usar `client.sessionId`.
- **Estado:** estilo constructor, sin decoradores: `import { schema, t, type SchemaType } from "@colyseus/schema"`; `const Player = schema({ x: t.number() }, "Player")`; mapas con `t.map(Player)`.
- **Cliente:** `import { Client } from "@colyseus/sdk"`; `client.create("level", opts)`, `client.joinById(roomId, opts)`, `room.send("move", {dx, dy})`, `room.onDrop(cb)`, `room.onReconnect(cb)`, `room.onLeave(cb)`. La reconexión automática viene activada.
- **Pruebas:** `import { boot, ColyseusTestServer } from "@colyseus/testing"`; `boot(appConfig)`, `colyseus.createRoom("level")`, `colyseus.connectTo(room, opts)`, `colyseus.sdk.joinById(...)`, `room.waitForNextPatch()`, `colyseus.cleanup()`, `colyseus.shutdown()`.
- Si una firma no coincide con estas notas, la fuente de verdad son los tipos en `node_modules/` y https://docs.colyseus.io.

## Review Focus

1. **Mensajes `move` mal formados** (NaN, Infinity, texto, sin campos, vector enorme): el servidor los trata como dirección cero o los recorta a longitud 1; nunca se cae ni saca al jugador del mapa. → Task 1 (`normalizeInput`) y Task 2.
2. **Link a una sala que ya no existe, llena o con un `?sala=` raro**: el jugador ve un mensaje claro en español y un botón para crear una sala nueva; nunca una pantalla en blanco. → Task 3 (`readRoomId`) y Task 4.
3. **Nombres vacíos, larguísimos o solo espacios**: se recortan a 12 caracteres y, si quedan vacíos, se usa "Héroe". → Task 1 (`sanitizeName`) y Task 2.
4. **Quinto jugador**: se le rechaza y la sala de los otros cuatro sigue intacta. → Task 2.
5. **Pestaña en segundo plano o un cuadro muy largo**: al volver, el personaje no se teletransporta; `stepPlayer` limita `dt` a 0.1 s. → Task 1.

---

## Estructura de archivos

```
package.json                 # workspaces + scripts dev/test/typecheck
tsconfig.base.json
.gitignore
README.md
.claude/launch.json          # servidores de desarrollo para la vista previa
shared/
  package.json               # @isekai/shared, exporta ./src/index.ts (sin compilar)
  src/constants.ts           # tamaños, tick, velocidad
  src/movement.ts            # normalizeInput, stepPlayer
  src/player.ts              # HeroClass, JoinOptions, MoveMessage, sanitizeName
  src/index.ts               # reexporta todo
  test/movement.test.ts
  test/player.test.ts
server/
  package.json               # @isekai/server
  src/state.ts               # Player, LevelState
  src/rooms/LevelRoom.ts
  src/app.config.ts          # defineServer (export default)
  src/index.ts               # listen(PORT || 2567)
  test/LevelRoom.test.ts
client/
  package.json               # @isekai/client
  index.html
  vite.config.ts
  src/main.ts                # crea el Phaser.Game y gestiona el zoom
  src/screen.ts              # computeZoom
  src/invite.ts              # readRoomId, buildInviteUrl
  src/net.ts                 # serverUrl, connect (crear o unirse)
  src/profile.ts             # nombre en localStorage
  src/scenes/BootScene.ts    # conecta y muestra errores
  src/scenes/GameScene.ts    # mapa, jugadores, cámara, entrada
  test/screen.test.ts
  test/invite.test.ts
```

---

### Task 1: Workspace y lógica compartida

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`
- Create: `shared/package.json`, `shared/tsconfig.json`, `shared/src/{constants,movement,player,index}.ts`
- Test: `shared/test/movement.test.ts`, `shared/test/player.test.ts`

**Interfaces:**
- Produces (todo exportado desde `@isekai/shared`):
  - Constantes: `GAME_WIDTH = 480`, `GAME_HEIGHT = 270`, `MAP_WIDTH = 1440`, `MAP_HEIGHT = 810`, `TICK_RATE = 20`, `TICK_MS = 50`, `MAX_PLAYERS = 4`, `RECONNECT_SECONDS = 30`, `PLAYER_SIZE = 32`, `PLAYER_SPEED = 80` (px/s), `MAX_STEP_SECONDS = 0.1`, `NAME_MAX_LENGTH = 12`, `DEFAULT_NAME = "Héroe"`, `ROOM_NAME = "level"`.
  - `type Vec2 = { x: number; y: number }`
  - `type MoveMessage = { dx: number; dy: number }`
  - `type HeroClass = "guerrero" | "maga"`; `type JoinOptions = { name: string; heroClass: HeroClass }`
  - `normalizeInput(raw: unknown): MoveMessage`
  - `stepPlayer(pos: Vec2, input: MoveMessage, dtSeconds: number): Vec2`
  - `sanitizeName(raw: unknown): string`
  - `sanitizeHeroClass(raw: unknown): HeroClass` (por defecto `"guerrero"`)

- [ ] **Step 1: Crear el workspace**

`package.json` raíz: `"private": true`, `"type": "module"`, `"workspaces": ["shared", "server", "client"]`, scripts `test` (`vitest run`), `typecheck` (`tsc --noEmit` en cada workspace), `dev:server`, `dev:client`. Dependencias de desarrollo en la raíz: `typescript@^7`, `vitest@^5`. `tsconfig.base.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `noEmit`, `skipLibCheck`. `.gitignore`: `node_modules`, `dist`, `.env*`. `shared/package.json`: nombre `@isekai/shared`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`. Ejecutar `npm install`.

- [ ] **Step 2: Escribir las pruebas que fallan**

`shared/test/movement.test.ts`:

```ts
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
});
```

`shared/test/player.test.ts`:

```ts
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
```

- [ ] **Step 3: Ejecutar y comprobar que fallan**

Run: `npx vitest run shared`
Expected: FAIL (no existe `../src/index`).

- [ ] **Step 4: Implementar `constants.ts`, `movement.ts`, `player.ts` e `index.ts`**

`sanitizeName` cuenta caracteres con `Array.from` (por los emojis) y colapsa cualquier espacio en blanco seguido en un solo espacio. `stepPlayer` no modifica `pos`; devuelve un objeto nuevo, limitado a `[PLAYER_SIZE/2, MAP - PLAYER_SIZE/2]`.

- [ ] **Step 5: Ejecutar y comprobar que pasan**

Run: `npx vitest run shared` → PASS. Run: `npm run typecheck` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(shared): workspace, constantes y lógica de movimiento"
```

---

### Task 2: Servidor — `LevelRoom`

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/src/{state,app.config,index}.ts`, `server/src/rooms/LevelRoom.ts`
- Test: `server/test/LevelRoom.test.ts`

**Interfaces:**
- Consumes: todo lo de Task 1.
- Produces:
  - `Player` (schema): `name: string`, `heroClass: string`, `x: number`, `y: number`, `connected: boolean`.
  - `LevelState` (schema): `players: map<Player>` con clave `sessionId`.
  - Sala registrada con el nombre `ROOM_NAME` (`"level"`); acepta `JoinOptions`; mensaje `"move"` con `MoveMessage`.
  - `GET /health` → `200 "ok"`.
  - `server/src/app.config.ts` exporta por defecto el resultado de `defineServer`.
  - Puerto: `process.env.PORT` o `2567`.

- [ ] **Step 1: Dependencias**

`server/package.json`: nombre `@isekai/server`, `"type": "module"`, dependencias `colyseus@^0.18.12`, `@colyseus/schema@^5.0.48`, `@isekai/shared@*`, `tsx@^4`; desarrollo `@colyseus/testing@^0.18.6`, `@colyseus/sdk@^0.18.10`. Scripts: `dev` = `tsx watch src/index.ts`, `start` = `tsx src/index.ts`. `npm install`.

- [ ] **Step 2: Escribir las pruebas que fallan**

`server/test/LevelRoom.test.ts`, con `boot(appConfig)` en `beforeAll`, `cleanup()` en `beforeEach` y `shutdown()` en `afterAll`. Un ayudante `ticks(room, n)` espera `n` pasos de simulación (`room.waitForNextTimestep()`).

```ts
it("al entrar aparece un jugador dentro del mapa con el nombre limpio", async () => {
  const room = await colyseus.createRoom(ROOM_NAME);
  const c = await colyseus.connectTo(room, { name: "  Kira  ", heroClass: "maga" });
  await room.waitForNextPatch();
  const p = room.state.players.get(c.sessionId)!;
  expect(p.name).toBe("Kira");
  expect(p.heroClass).toBe("maga");
  expect(p.connected).toBe(true);
  expect(p.x).toBeGreaterThanOrEqual(PLAYER_SIZE / 2);
  expect(p.x).toBeLessThanOrEqual(MAP_WIDTH - PLAYER_SIZE / 2);
  expect(p.y).toBeGreaterThanOrEqual(PLAYER_SIZE / 2);
  expect(p.y).toBeLessThanOrEqual(MAP_HEIGHT - PLAYER_SIZE / 2);
});

it("opciones vacías o basura dan nombre Héroe y clase guerrero", async () => {
  const room = await colyseus.createRoom(ROOM_NAME);
  const c = await colyseus.connectTo(room, { name: 123, heroClass: "ninja" } as any);
  const p = room.state.players.get(c.sessionId)!;
  expect(p.name).toBe("Héroe");
  expect(p.heroClass).toBe("guerrero");
});

it("move desplaza al jugador a PLAYER_SPEED", async () => {
  const room = await colyseus.createRoom(ROOM_NAME);
  const c = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
  const p = room.state.players.get(c.sessionId)!;
  const x0 = p.x, y0 = p.y;
  c.send("move", { dx: 1, dy: 0 });
  await room.waitForMessage("move");
  await ticks(room, 4);
  expect(p.x - x0).toBeGreaterThanOrEqual(PLAYER_SPEED * TICK_MS / 1000 * 3);
  expect(p.x - x0).toBeLessThanOrEqual(PLAYER_SPEED * TICK_MS / 1000 * 5);
  expect(p.y).toBe(y0);
});

it.each([null, "x", { dx: NaN, dy: 1 }, { dx: "1" }, [], 9e99])("move con %j no mueve ni rompe la sala", async (payload) => {
  const room = await colyseus.createRoom(ROOM_NAME);
  const c = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
  const p = room.state.players.get(c.sessionId)!;
  const x0 = p.x, y0 = p.y;
  c.send("move", payload as any);
  await room.waitForMessage("move");
  await ticks(room, 3);
  expect({ x: p.x, y: p.y }).toEqual({ x: x0, y: y0 });
});

it("un vector enorme no supera la velocidad máxima", async () => {
  // move {dx: 1000, dy: 0}; tras 4 ticks el avance es ≤ PLAYER_SPEED * TICK_MS/1000 * 5
});

it("el quinto jugador es rechazado y los otros cuatro siguen", async () => {
  const room = await colyseus.createRoom(ROOM_NAME);
  for (let i = 0; i < 4; i++) await colyseus.connectTo(room, { name: `J${i}`, heroClass: "guerrero" });
  await expect(colyseus.sdk.joinById(room.roomId, { name: "J5", heroClass: "maga" })).rejects.toBeTruthy();
  expect(room.state.players.size).toBe(4);
});

it("una caída de conexión conserva al jugador y al reconectar recupera su lugar", async () => {
  const room = await colyseus.createRoom(ROOM_NAME);
  const c = await colyseus.connectTo(room, { name: "A", heroClass: "guerrero" });
  const id = c.sessionId, token = c.reconnectionToken;
  c.send("move", { dx: 1, dy: 0 });
  await room.waitForMessage("move");
  c.reconnection.enabled = false;        // la prueba reconecta a mano
  await c.leave(false);                  // simula una caída
  await ticks(room, 3);
  const p = room.state.players.get(id)!;
  expect(p.connected).toBe(false);
  const xDropped = p.x;
  await ticks(room, 3);
  expect(p.x).toBe(xDropped);            // un jugador caído no sigue caminando
  const c2 = await colyseus.sdk.reconnect(token);
  await ticks(room, 1);
  expect(c2.sessionId).toBe(id);
  expect(room.state.players.get(id)!.connected).toBe(true);
  expect(room.state.players.size).toBe(1);
});

it("salir a propósito borra al jugador", async () => {
  // connectTo, await c.leave(), esperar un tick → players.size === 0
});

it("GET /health responde ok", async () => {
  const res = await colyseus.http.get("/health");
  expect(res.data).toBe("ok");
});
```

- [ ] **Step 3: Ejecutar y comprobar que fallan**

Run: `npx vitest run server` → FAIL (no existe `app.config`).

- [ ] **Step 4: Implementar `state.ts`, `LevelRoom.ts`, `app.config.ts`, `index.ts`**

Decisiones que las pruebas no fijan:
- La dirección de cada jugador se guarda en un `Map<sessionId, MoveMessage>` privado de la sala; **no** va en el estado sincronizado.
- Paso de simulación fijo de `TICK_MS`: en cada paso, para cada jugador conectado, `stepPlayer(pos, input, TICK_MS / 1000)`.
- Punto de aparición: centro del mapa más un desplazamiento por orden de llegada (`±40 px`), para que no nazcan encimados.
- `onDrop`: `connected = false`, dirección a cero, `allowReconnection(client, RECONNECT_SECONDS)`. `onReconnect`: `connected = true`. `onLeave`: borrar del estado y del mapa de direcciones.
- `maxClients = MAX_PLAYERS`.

- [ ] **Step 5: Ejecutar y comprobar que pasan**

Run: `npx vitest run server` → PASS. Run: `npm run typecheck` → sin errores. Run: `npm run dev:server` y, en otra terminal, `curl http://localhost:2567/health` → `ok`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(server): LevelRoom autoritativa con movimiento y reconexión"
```

---

### Task 3: Cliente — pantalla, link y conexión

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/index.html`, `client/vite.config.ts`
- Create: `client/src/{main,screen,invite,net,profile}.ts`, `client/src/scenes/BootScene.ts`
- Test: `client/test/screen.test.ts`, `client/test/invite.test.ts`

**Interfaces:**
- Consumes: constantes y tipos de Task 1; sala `"level"` y `/health` de Task 2.
- Produces:
  - `computeZoom(cssWidth: number, cssHeight: number, dpr: number): number` — zoom entero ≥ 1 en píxeles físicos.
  - `readRoomId(search: string): string | null`
  - `buildInviteUrl(href: string, roomId: string): string`
  - `serverUrl(): string` — `import.meta.env.VITE_SERVER_URL`; si no está definida, `http://<hostname de la página>:2567` (así un celular en la misma wifi llega al servidor de la PC).
  - `connect(roomId: string | null, opts: JoinOptions): Promise<Room>` — `joinById` si hay `roomId`, `create` si no.
  - `loadName(): string`, `saveName(name: string): void` — clave de `localStorage`: `isekai.nombre`.
  - `BootScene` (clave `"Boot"`) arranca `"Game"` con `{ room }`.

- [ ] **Step 1: Dependencias y Vite**

`client/package.json`: nombre `@isekai/client`, dependencias `phaser@^4.2.1`, `@colyseus/sdk@^0.18.10`, `@isekai/shared@*`; desarrollo `vite@^8`. Scripts `dev` = `vite --host`, `build` = `vite build`. `vite.config.ts`: `base: "./"` (para que funcione en una subcarpeta de GitHub Pages) y puerto `5173`. `index.html`: fondo negro, `<div id="game">` centrado con flexbox, `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`, `lang="es"`, título "Isekai Squad".

- [ ] **Step 2: Escribir las pruebas que fallan**

`client/test/screen.test.ts`:

```ts
it.each([
  [1920, 1080, 1, 4],   // monitor Full HD
  [1366, 768, 1, 2],    // portátil
  [844, 390, 3, 4],     // iPhone en horizontal: 2532×1170 físicos
  [800, 360, 2.625, 3], // Android gama media: 2100×945 físicos
  [300, 200, 1, 1],     // ventana diminuta: nunca menos de 1
  [0, 0, 1, 1],
  [1920, 1080, NaN, 4], // dpr inválido se trata como 1
])("computeZoom(%d, %d, %d) = %d", (w, h, dpr, zoom) => expect(computeZoom(w, h, dpr)).toBe(zoom));
```

`client/test/invite.test.ts`:

```ts
it("lee el id de la sala", () => expect(readRoomId("?sala=AbC123xyz")).toBe("AbC123xyz"));
it.each(["", "?sala=", "?otra=1", "?sala=%20%20", "?sala=<script>", "?sala=" + "a".repeat(200)])(
  "devuelve null para %j", (s) => expect(readRoomId(s)).toBeNull());
it("construye el link conservando la ruta y quitando lo demás", () =>
  expect(buildInviteUrl("https://x.github.io/isekai-squad/?sala=vieja&z=1#h", "NUEVA")).toBe("https://x.github.io/isekai-squad/?sala=NUEVA"));
it("ida y vuelta", () => expect(readRoomId(new URL(buildInviteUrl("http://localhost:5173/", "r-1_A")).search)).toBe("r-1_A"));
```

`readRoomId` solo acepta `^[A-Za-z0-9_-]{1,32}$`.

- [ ] **Step 3: Ejecutar y comprobar que fallan**

Run: `npx vitest run client` → FAIL.

- [ ] **Step 4: Implementar `screen.ts`, `invite.ts`, `profile.ts`, `net.ts`**

`profile.ts` envuelve `localStorage` en `try/catch` (en modo privado puede fallar) y pasa todo por `sanitizeName`.

- [ ] **Step 5: Implementar `main.ts` y `BootScene.ts`**

- `main.ts`: `new Phaser.Game({ type: Phaser.AUTO, parent: "game", width: GAME_WIDTH, height: GAME_HEIGHT, pixelArt: true, backgroundColor: "#1b2a1b", scale: { mode: Phaser.Scale.NONE }, scene: [BootScene, GameScene] })`. Al iniciar y en cada `resize`/`orientationchange` de la ventana: `game.scale.setZoom(computeZoom(innerWidth, innerHeight, devicePixelRatio) / devicePixelRatio)`.
- `BootScene`: muestra "Conectando…", llama a `connect(readRoomId(location.search), { name: loadName(), heroClass: "guerrero" })`. Si funciona: actualiza la barra de direcciones con `history.replaceState` al link de invitación y arranca `"Game"`. Si falla al unirse por link: muestra "No se pudo entrar a la sala. Puede que ya no exista o que esté llena." y un botón "Crear sala nueva" (que quita `?sala=` y vuelve a intentar con `create`). Si falla al crear: "No se pudo conectar con el servidor." y un botón "Reintentar".

- [ ] **Step 6: Ejecutar y comprobar que pasan**

Run: `npx vitest run client` → PASS. Run: `npm run typecheck` → sin errores.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(client): arranque de Phaser, zoom por píxeles físicos y conexión por link"
```

---

### Task 4: Cliente — partida compartida y verificación de extremo a extremo

**Files:**
- Create: `client/src/scenes/GameScene.ts`, `.claude/launch.json`, `README.md`
- Modify: `package.json` (script `dev` que arranca ambos)

**Interfaces:**
- Consumes: `Room` con `state.players` (Task 2), `stepPlayer`/`normalizeInput` (Task 1), `buildInviteUrl` (Task 3).
- Produces: `GameScene` (clave `"Game"`), recibe `{ room }` en `init`.

- [ ] **Step 1: Implementar `GameScene`**

- **Mapa:** fondo de 1440×810 con una cuadrícula de 16 px dibujada con `Graphics` y un borde visible; límites de cámara iguales al mapa.
- **Jugadores:** en cada `update`, recorrer `room.state.players` y sincronizar un `Map<sessionId, vista>`: crear las vistas nuevas, destruir las que ya no están. Cada vista es un rectángulo de 32×32 (guerrero `#d9534f`, maga `#5b6ee1`; el propio con borde blanco) y el nombre encima en texto de 8 px. Un jugador con `connected === false` se dibuja con alfa 0.4.
- **Entrada:** WASD y flechas → vector `{dx, dy}` pasado por `normalizeInput`. Se envía `room.send("move", …)` solo cuando la dirección cambia.
- **Predicción (propio):** cada cuadro, `stepPlayer(posLocal, input, delta/1000)`. Corrección con la posición del servidor: si la distancia supera 48 px, saltar a ella; si no, acercarse un 10 % por cuadro.
- **Interpolación (los demás):** cada cuadro, acercar la vista a la posición del servidor con factor `1 - exp(-delta / 60)`.
- **Cámara:** sigue al jugador propio con `roundPixels`.
- **HUD (fijo a la cámara):** arriba a la izquierda, "Jugadores: N/4". Arriba a la derecha, botón "Copiar link" que copia `buildInviteUrl(location.href, room.roomId)` con `navigator.clipboard`; si el portapapeles no está disponible (pasa en HTTP por wifi), muestra el link en un `window.prompt` para copiarlo a mano. Tras copiar: "¡Link copiado!" durante 2 s.
- **Conexión:** `room.onDrop` → cartel "Reconectando…"; `room.onReconnect` → se quita; `room.onLeave` (no voluntario) → "Se perdió la conexión." con botón "Volver a entrar" (recarga la página).

- [ ] **Step 2: Scripts y vista previa**

Script raíz `dev` que arranca servidor y cliente a la vez (`npm run dev -w server` y `npm run dev -w client`; usar `concurrently` como dependencia de desarrollo). `.claude/launch.json` con dos configuraciones: `server` (puerto 2567) y `client` (puerto 5173).

- [ ] **Step 3: Verificación de extremo a extremo (con las herramientas de vista previa)**

1. Arrancar `server` y `client`. Abrir `http://localhost:5173/`.
2. Esperado: la URL cambia a `?sala=<id>`, se ve un rectángulo rojo con nombre y "Jugadores: 1/4". Sin errores en la consola.
3. Abrir esa misma URL en una segunda pestaña. Esperado: "Jugadores: 2/4" en ambas.
4. En la pestaña 2, mantener `D` 1 s. Esperado: en la pestaña 1, el segundo rectángulo se desplaza unos 80 px a la derecha, de forma suave.
5. Mantener `A` y `W` hasta la esquina. Esperado: el personaje se detiene en el borde y la cámara no muestra nada fuera del mapa.
6. Cerrar la pestaña 2. Esperado: en la pestaña 1 su rectángulo queda semitransparente y desaparece a los 30 s.
7. Abrir `http://localhost:5173/?sala=noexiste`. Esperado: el mensaje de sala no encontrada y el botón "Crear sala nueva", que funciona.
8. Cambiar la vista a celular en horizontal (812×375). Esperado: el juego ocupa casi toda la pantalla, con píxeles nítidos.
9. Capturas de los pasos 3 y 8 como prueba.

- [ ] **Step 4: README**

`README.md` en español: qué es, requisitos (Node 22 o superior), `npm install`, `npm run dev`, `npm test`, cómo probar desde el celular en la misma wifi (abrir `http://<ip de la PC>:5173`), y enlace al documento de diseño.

- [ ] **Step 5: Comprobación final y commit**

Run: `npm test` → todo PASS. Run: `npm run typecheck` → sin errores. Run: `npm run build -w client` → compila.

```bash
git add -A && git commit -m "feat(client): partida compartida con predicción, interpolación y link de invitación"
```

---

## Fuera de esta etapa (planes siguientes)

Publicación en GitHub Pages y Render con pantalla de "servidor despertando" (etapa 2), combate, progresión, joystick y aviso de girar el teléfono, mapa del mundo y sala de espera con "Listo/Comenzar", y arte.
