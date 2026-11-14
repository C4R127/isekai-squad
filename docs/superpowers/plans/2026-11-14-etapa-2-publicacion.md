# Etapa 2 — Publicación temprana: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El juego de la etapa 1 queda publicado en internet, gratis: cualquiera abre un link de GitHub Pages y juega contra el servidor en Render, con una pantalla clara mientras el servidor despierta.

**Architecture:** El cliente se compila con GitHub Actions en cada push a `main` y se publica en GitHub Pages; la dirección del servidor entra en la compilación por la variable `VITE_SERVER_URL`. El servidor corre en Render (plan gratuito) descrito en un `render.yaml`. Antes de crear o unirse a una sala, el cliente "toca" `GET /health` y espera hasta 90 s a que responda.

**Tech Stack:** el de la etapa 1, más GitHub Actions, GitHub Pages y Render.

**Spec:** `docs/2026-11-14-isekai-squad-design.md` (secciones 3, 7 "Servidor dormido" y 11.2).

## Global Constraints

- Hosting **solo gratis**: cliente en GitHub Pages, servidor en Render plan gratuito.
- El servidor gratuito se apaga tras 15 min sin tráfico y tarda alrededor de 1 minuto en despertar; el juego debe **avisarlo con claridad**: "Despertando el portal mágico…".
- Pantalla de espera con animación **hasta 90 s**, mensaje claro y opción de **reintentar**.
- Link de invitación: `https://<usuario>.github.io/isekai-squad/?sala=<roomId>`.
- Nadie instala nada ni crea cuenta para jugar.
- Interfaz en español.
- Publicar (crear el repositorio, hacer push, crear el servicio en Render) son acciones hacia afuera: **se confirma con el usuario antes de cada una**. Las contraseñas y los inicios de sesión los hace el usuario.

## Lo que hay que saber antes de empezar

- GitHub Pages en una cuenta gratuita exige que el repositorio sea **público**: el código y el historial de commits (con el nombre y el correo configurados en git) quedan a la vista.
- La herramienta `gh` no está instalada: el repositorio se crea desde la web de GitHub y el push se hace con `git` (se abrirá el inicio de sesión de GitHub en el navegador).
- Al ejecutar, verificar en la documentación actual: los campos de `render.yaml` (https://render.com/docs/blueprint-spec), las condiciones del plan gratuito de Render y las versiones vigentes de las acciones de GitHub Pages.

## Review Focus

1. **El servidor no despierta en 90 s** (Render caído, sin internet): mensaje "El portal no responde." y botón "Reintentar" que vuelve a empezar la espera. → Task 2.
2. **El servidor contesta, pero con error** (502/503 de Render mientras arranca): no cuenta como despierto; se sigue esperando. → Task 2.
3. **Una petición que se queda colgada sin respuesta**: cada intento se corta a los 10 s y se reintenta; la espera total nunca pasa de 90 s. → Task 2.
4. **`VITE_SERVER_URL` vacía o con `/` al final**: vacía hace fallar la publicación (nunca se publica un cliente apuntando a un servidor inexistente); con `/` final se normaliza. → Task 2 y Task 3.
5. **El servidor se reinició y el link apunta a una sala que ya no existe**: tras la espera, el mensaje de la etapa 1 ("No se pudo entrar a la sala…") con "Crear sala nueva". → Task 4 (verificación).

---

## Estructura de archivos

```
render.yaml                         # servicio web gratuito en Render
.github/workflows/pages.yml         # pruebas + compilación + publicación en Pages
server/src/app.config.ts            # (modificar) CORS en /health
server/test/LevelRoom.test.ts       # (modificar) prueba de CORS
client/src/wake.ts                  # waitForServer, pingHealth
client/src/net.ts                   # (modificar) resolveServerUrl
client/src/scenes/BootScene.ts      # (modificar) pantalla "Despertando el portal mágico…"
client/test/wake.test.ts
client/test/net.test.ts
README.md                           # (modificar) sección "Publicación"
```

---

### Task 1: Servidor listo para Render

**Files:**
- Modify: `server/src/app.config.ts`, `server/test/LevelRoom.test.ts`, `package.json` (campo `engines`)
- Create: `render.yaml`

**Interfaces:**
- Produces: `GET /health` → `200 "ok"` con cabecera `Access-Control-Allow-Origin: *` (el cliente lo consulta desde otro dominio).

- [ ] **Step 1: Prueba que falla**

En `server/test/LevelRoom.test.ts`:

```ts
it("GET /health permite consultas desde otro dominio", async () => {
  const res = await colyseus.http.get("/health");
  expect(res.headers["access-control-allow-origin"]).toBe("*");
});
```

- [ ] **Step 2:** Run: `npx vitest run server` → FAIL (cabecera `undefined`).
- [ ] **Step 3:** Añadir la cabecera en la ruta `/health`.
- [ ] **Step 4:** Run: `npx vitest run server` → PASS.
- [ ] **Step 5: `render.yaml` y versión de Node**

`package.json` raíz: `"engines": { "node": ">=22" }`. `render.yaml`:

```yaml
services:
  - type: web
    name: isekai-squad-server
    runtime: node
    plan: free
    buildCommand: npm ci
    startCommand: npm run start -w server
    healthCheckPath: /health
    envVars:
      - key: NODE_VERSION
        value: 24
```

El servidor ya lee `process.env.PORT`, que Render define.

- [ ] **Step 6:** Simular el arranque de Render en local: `PORT=3999 npm run start -w server` y `curl -i http://localhost:3999/health` → `200`, `ok` y la cabecera CORS. Detener el proceso.
- [ ] **Step 7: Commit** — `feat(server): CORS en /health y configuración de Render`

---

### Task 2: Cliente — espera a que el servidor despierte

**Files:**
- Create: `client/src/wake.ts`, `client/test/wake.test.ts`, `client/test/net.test.ts`
- Modify: `client/src/net.ts`, `client/src/scenes/BootScene.ts`

**Interfaces:**
- Consumes: `GET /health` (Task 1).
- Produces:
  - `resolveServerUrl(envValue: string | undefined, loc: { protocol: string; hostname: string }): string` — `serverUrl()` pasa a llamarla.
  - `WAKE_TIMEOUT_MS = 90_000`, `WAKE_RETRY_MS = 3_000`, `PING_TIMEOUT_MS = 10_000`, `WAKE_NOTICE_MS = 1_500`.
  - `type WakeDeps = { ping: () => Promise<boolean>; sleep: (ms: number) => Promise<void>; now: () => number }`
  - `waitForServer(deps: WakeDeps, onWaiting?: (elapsedMs: number) => void): Promise<boolean>` — `true` en cuanto un `ping` devuelve `true`; `false` si pasan `WAKE_TIMEOUT_MS`. Un `ping` que lanza o devuelve `false` cuenta como "sigue dormido". Llama a `onWaiting` antes de cada espera.
  - `pingHealth(baseUrl: string, fetchFn?: typeof fetch): Promise<boolean>` — `true` solo si la respuesta es `ok` (2xx); corta a los `PING_TIMEOUT_MS`; nunca lanza.

- [ ] **Step 1: Pruebas que fallan**

`client/test/net.test.ts`:

```ts
const loc = { protocol: "http:", hostname: "192.168.1.20" };
it("sin variable usa el mismo equipo en el puerto 2567", () =>
  expect(resolveServerUrl(undefined, loc)).toBe("http://192.168.1.20:2567"));
it("vacía o solo espacios cuenta como ausente", () => {
  expect(resolveServerUrl("", loc)).toBe("http://192.168.1.20:2567");
  expect(resolveServerUrl("   ", loc)).toBe("http://192.168.1.20:2567");
});
it("usa la variable y quita las barras finales", () =>
  expect(resolveServerUrl(" https://x.onrender.com// ", loc)).toBe("https://x.onrender.com"));
```

`client/test/wake.test.ts` (reloj falso: `sleep` suma al reloj, nada espera de verdad):

```ts
function fakeDeps(results: Array<boolean | Error>) {
  let t = 0, calls = 0;
  const deps: WakeDeps = {
    now: () => t,
    sleep: async (ms) => { t += ms; },
    ping: async () => {
      const r = results[Math.min(calls++, results.length - 1)];
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { deps, calls: () => calls, time: () => t };
}

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
});
it("se rinde a los 90 s", async () => {
  const f = fakeDeps([false]);
  expect(await waitForServer(f.deps)).toBe(false);
  expect(f.time()).toBeGreaterThanOrEqual(WAKE_TIMEOUT_MS);
  expect(f.time()).toBeLessThan(WAKE_TIMEOUT_MS + WAKE_RETRY_MS);
});
it("los intentos lentos también cuentan para los 90 s", async () => {
  // ping que tarda 10 s (suma al reloj) y devuelve false: se rinde con ~9 intentos, no 30
});
it("avisa del tiempo transcurrido antes de cada espera", async () => {
  const f = fakeDeps([false, false, true]);
  const seen: number[] = [];
  await waitForServer(f.deps, (ms) => seen.push(ms));
  expect(seen).toEqual([0, WAKE_RETRY_MS]);
});

describe("pingHealth", () => {
  it("true con 200", async () =>
    expect(await pingHealth("https://x", async () => new Response("ok"))).toBe(true));
  it.each([404, 502, 503])("false con %d", async (status) =>
    expect(await pingHealth("https://x", async () => new Response("", { status }))).toBe(false));
  it("false si la red falla", async () =>
    expect(await pingHealth("https://x", async () => { throw new TypeError("fetch"); })).toBe(false));
  it("consulta /health con límite de tiempo", async () => {
    let url = "", signal: AbortSignal | undefined;
    await pingHealth("https://x", async (u, init) => { url = String(u); signal = init?.signal ?? undefined; return new Response("ok"); });
    expect(url).toBe("https://x/health");
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});
```

- [ ] **Step 2:** Run: `npx vitest run client` → FAIL (no existen `wake` ni `resolveServerUrl`).
- [ ] **Step 3:** Implementar `wake.ts` y `resolveServerUrl` en `net.ts`. `pingHealth` usa `AbortSignal.timeout(PING_TIMEOUT_MS)` y `cache: "no-store"`.
- [ ] **Step 4:** Run: `npx vitest run client` → PASS. `npm run typecheck` → sin errores.
- [ ] **Step 5: Pantalla de espera en `BootScene`**

Antes de `connect(...)`, llamar a `waitForServer` con `pingHealth(serverUrl())`, `sleep` real y `performance.now`.
- Mientras tanto se muestra "Conectando…". Si la espera supera `WAKE_NOTICE_MS` (el servidor estaba dormido), cambia a:
  - título "Despertando el portal mágico…",
  - debajo, "El servidor gratuito se duerme cuando nadie juega. Suele tardar cerca de un minuto.",
  - una animación sencilla (un círculo de 8 puntos que gira, hecho con `Graphics` y un tween),
  - una barra de progreso de 0 a 90 s con los segundos transcurridos.
- Si devuelve `false`: "El portal no responde. Revisa tu conexión e inténtalo de nuevo." y el botón "Reintentar", que repite la espera conservando el `?sala=`.
- Si devuelve `true`: sigue el flujo de la etapa 1 (crear o unirse, con sus mensajes de error).

- [ ] **Step 6: Verificación en el navegador (vista previa)**

1. Con `isekai-client` encendido y `isekai-server` **apagado**, abrir `http://localhost:5173/`. Esperado: a los ~1.5 s aparece "Despertando el portal mágico…", la animación gira y la barra avanza.
2. Encender `isekai-server`. Esperado: en menos de 4 s entra a la partida, sin recargar.
3. Apagar el servidor y recargar; para no esperar 90 s, comprobar en la consola de la página que la barra avanza y, con el reloj real, que a los 90 s aparece "El portal no responde." y "Reintentar". Encender el servidor y pulsar "Reintentar" → entra.
4. Captura del paso 1 como prueba.

- [ ] **Step 7: Commit** — `feat(client): pantalla de espera mientras el servidor despierta`

---

### Task 3: Publicación automática en GitHub Pages

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: variable del repositorio `VITE_SERVER_URL` (se define en Task 4).
- Produces: un flujo "Publicar" que en cada push a `main` (y a mano con `workflow_dispatch`) ejecuta pruebas, compila y publica `client/dist`.

- [ ] **Step 1: Escribir el flujo**

Un trabajo `build`: checkout, Node 24 con caché de npm, `npm ci`, `npm test`, `npm run typecheck`, un paso que **falla con un mensaje claro si `vars.VITE_SERVER_URL` está vacía**, `npm run build -w client` con `VITE_SERVER_URL: ${{ vars.VITE_SERVER_URL }}`, y subida de `client/dist` como artefacto de Pages. Un trabajo `deploy` que depende de `build` y publica. Permisos: `contents: read`, `pages: write`, `id-token: write`. `concurrency: pages`. Usar las versiones mayores vigentes de `actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact` y `actions/deploy-pages`.

- [ ] **Step 2: Comprobar en local lo que hará el flujo**

Run: `VITE_SERVER_URL=https://ejemplo.onrender.com npm run build -w client`, luego buscar en `client/dist/assets/*.js` la cadena `ejemplo.onrender.com` → aparece. Comprobar que `client/dist/index.html` referencia los archivos con rutas relativas (`./assets/...`), necesarias porque el sitio vive en `/isekai-squad/`.

- [ ] **Step 3: README** — sección "Publicación": cómo funciona (push a `main` → Pages), dónde se cambia la dirección del servidor (variable `VITE_SERVER_URL` en GitHub), y que el servidor gratuito se duerme tras 15 min.
- [ ] **Step 4: Commit** — `ci: publicación en GitHub Pages`

---

### Task 4: Publicar de verdad (con el usuario)

Cada paso marcado **[usuario]** lo hace el usuario en su navegador; los demás los hace quien ejecuta el plan, **pidiendo confirmación antes de cada push**.

- [ ] **Step 1 [usuario]:** crear en github.com un repositorio **público y vacío** llamado `isekai-squad` (sin README ni licencia) y decir su usuario.
- [ ] **Step 2:** `git remote add origin https://github.com/<usuario>/isekai-squad.git` y, tras confirmar, `git push -u origin main`. Si pide iniciar sesión, lo hace el usuario.
- [ ] **Step 3 [usuario]:** en render.com, entrar con GitHub → **New → Blueprint** → elegir el repositorio → aceptar el servicio `isekai-squad-server` (plan Free). Esperar a que diga "Live" y copiar su dirección `https://….onrender.com`.
- [ ] **Step 4:** comprobar el servidor: `curl -i https://….onrender.com/health` → `200 ok` con la cabecera CORS.
- [ ] **Step 5 [usuario]:** en GitHub → Settings → Pages → Source: **GitHub Actions**. Luego Settings → Secrets and variables → Actions → pestaña **Variables** → nueva variable `VITE_SERVER_URL` con la dirección de Render.
- [ ] **Step 6 [usuario]:** Actions → "Publicar" → **Run workflow**. Esperado: termina en verde.
- [ ] **Step 7: Verificación en el sitio público**

1. Abrir `https://<usuario>.github.io/isekai-squad/`. Esperado: entra a una sala (si Render estaba dormido, antes se ve "Despertando el portal mágico…"). Sin errores en la consola; la conexión usa `wss://`.
2. Abrir el link `?sala=` en una segunda pestaña → "Jugadores: 2/4" y el movimiento se ve en ambas.
3. **[usuario]** abrir el link en el celular con datos móviles (no wifi) → entra y ve al jugador de la PC moverse.
4. **[usuario, opcional]** esperar 20 min sin jugar y volver a abrir: se ve la pantalla de espera y termina entrando. Abrir un link viejo `?sala=` → "No se pudo entrar a la sala…" y "Crear sala nueva".

- [ ] **Step 8:** anotar la dirección pública en el README y hacer commit y push (tras confirmar).

---

## Fuera de esta etapa

Combate (etapa 3), progresión, joystick y aviso de girar el teléfono, mapa del mundo y sala de espera, y arte.
