# Isekai Squad

Juego web de acción cooperativa en pixel art: hasta 4 amigos reencarnan en un mundo de fantasía y sobreviven hordas de enemigos. Se juega desde el navegador, en PC o celular, entrando con un link de invitación.

**Jugar:** <https://c4r127.github.io/isekai-squad/> (si nadie ha jugado en un rato, el servidor tarda cerca de un minuto en despertar).

**Estado:** etapa 2 (publicado). Por ahora puedes crear una sala, compartir el link y moverte con tus amigos por el mapa. El diseño completo está en [docs/2026-11-14-isekai-squad-design.md](docs/2026-11-14-isekai-squad-design.md).

## Requisitos

- Node.js 22 o superior.

## Cómo ejecutarlo

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:5173>. Se crea una sala y la dirección cambia a `?sala=...`: ese es el link de invitación (también puedes pulsar **Copiar link**). Ábrelo en otra pestaña para ver a un segundo jugador.

**Controles:** WASD o las flechas.

## Probar desde el celular

Con el celular en la misma wifi que la PC, abre `http://<IP de tu PC>:5173` (Vite muestra esa dirección como "Network" al arrancar). Si no carga, revisa que el firewall de Windows permita los puertos 5173 y 2567.

## Pruebas

```bash
npm test
```

```bash
npm run typecheck
```

## Publicación

El juego se publica gratis en dos partes:

- **Cliente → GitHub Pages.** Cada cambio que llega a `main` ejecuta el flujo "Publicar" (`.github/workflows/pages.yml`): corre las pruebas, compila el cliente y lo publica. También se puede lanzar a mano desde la pestaña **Actions**.
- **Servidor → Render (plan gratuito)**, en `https://isekai-squad-server.onrender.com`. Está descrito en `render.yaml`; Render lo vuelve a desplegar con cada cambio en `main`.

El cliente sabe dónde está el servidor por la variable `VITE_SERVER_URL`, que se define en GitHub: **Settings → Secrets and variables → Actions → Variables**. Si falta, la publicación falla a propósito.

El servidor gratuito se duerme tras 15 minutos sin jugadores y tarda cerca de un minuto en despertar. Mientras tanto el juego muestra "Despertando el portal mágico…"; al despertar, las salas anteriores ya no existen.

## Estructura

| Carpeta | Qué contiene |
|---|---|
| `client/` | El juego (Phaser 4 + Vite). Es lo que se publicará en GitHub Pages. |
| `server/` | El servidor de partidas (Colyseus). Es lo que se publicará en Render. |
| `shared/` | Constantes, balance y lógica que usan tanto el cliente como el servidor. |
| `docs/` | Documento de diseño y planes de cada etapa. |

El número de balance de esta etapa (la velocidad de los personajes) está en `shared/src/constants.ts`.
