# Isekai Squad — Documento de diseño (v1)

> Fecha: 2026-11-14 · Estado: **aprobado** (con tres ajustes: publicación temprana, zoom por píxeles físicos y aviso de girar el teléfono)
> Las decisiones marcadas **[decisión del usuario]** las tomaste tú. Las marcadas **[propuesta]** las propuse yo y las puedes cambiar.

---

## 1. Qué es y por qué

**Isekai Squad** es un juego web de acción cooperativa en pixel art con estilo anime. Un grupo de amigos muere de forma absurda (atropellados por "Truck-kun") y reencarna en un mundo de fantasía. Allí sobreviven **hordas de enemigos** nivel tras nivel, hasta llegar al Rey Demonio.

**Por qué existe:** es un proyecto **por diversión, para jugarlo con amigos** **[decisión del usuario]**. El éxito se mide así: tú y hasta 3 amigos abren un link desde PC o celular, juegan una partida fluida, se ríen y quieren jugar otra.

## 2. Objetivos, no-objetivos y anti-objetivos

### Objetivos (v1)
- Cooperativo en línea en tiempo real, **hasta 4 jugadores** **[decisión del usuario]**.
- Entrar a la partida con un **link de invitación** **[decisión del usuario]**.
- Se puede jugar **solo o en grupo** **[decisión del usuario]**.
- Funciona en **PC (teclado) y celular (pantalla táctil)** **[decisión del usuario]**.
- **Aventura con niveles** que se desbloquean **[decisión del usuario]**; en la v1 hay un solo nivel completo.
- **Progreso individual** por jugador **[decisión del usuario]**.
- Arte pixel art hecho por ti **[decisión del usuario]**, fácil de reemplazar sin tocar código.

### No-objetivos (fuera de la v1)
- Cuentas de usuario, login o sincronizar el progreso entre dispositivos.
- Emparejar con desconocidos, salas públicas o chat.
- Modo versus (PvP), tienda o monedas.
- Música (se deja preparado el lugar para efectos de sonido).
- Las zonas 2, 3 y 4 (desierto, mazmorra, castillo): se diseñan aparte después de la v1.

### Anti-objetivos (aunque "funcione", sería un fracaso si…)
- Va **lento o con tirones** cuando 4 amigos juegan, sobre todo en celular.
- Obliga a **instalar algo o crear una cuenta** para jugar.
- Cambiar un sprite **requiere modificar código**.
- Una desconexión breve de un amigo **arruina la partida** de todos.

## 3. Restricciones
- Plataforma: navegador moderno (Chrome, Safari y Firefox recientes, en escritorio y móvil).
- Hosting **solo gratis** **[decisión del usuario]**:
  - Cliente (el juego): **GitHub Pages**, sitio estático gratis **[propuesta]**.
  - Servidor: **Render, plan gratuito** **[propuesta]**. Se apaga tras 15 min sin tráfico y tarda alrededor de 1 minuto en despertar. El juego tiene que **avisarlo con claridad** ("Despertando el portal mágico…").
- Código en un **repositorio de GitHub** **[decisión del usuario]**.
- Primera versión **mínima** **[decisión del usuario]**: 1 zona, 2 clases, 3 enemigos y 1 jefe.

## 4. Enfoques considerados

| Enfoque | Cómo funciona | Ventajas | Desventajas |
|---|---|---|---|
| **A) Servidor autoritativo con Colyseus** ✅ | Un servidor Node simula la partida y envía el estado a todos | Fluido en celulares sencillos, permite reconectarse, jugar solo es una sala de 1 | Hay que mantener un servidor y el hosting gratis se duerme |
| B) P2P (WebRTC/PeerJS) | El navegador del anfitrión hace de servidor | Gratis, sin servidor | Si el anfitrión se va, se acaba la partida; un celular anfitrión no aguanta las hordas; falla en algunas redes |
| C) Un jugador primero, multijugador después | — | Resultados visibles más pronto | Obliga a reescribir casi todo; contradice la razón del proyecto |

**Elegido: A** **[decisión del usuario]**. Las hordas en celular y jugar con amigos que pueden desconectarse son justo los puntos débiles de B.

## 5. Tecnología **[propuesta]**
- **Lenguaje:** TypeScript en todo el proyecto.
- **Cliente:** Phaser 4 (versión estable actual, 4.x) con Vite. *Nota: antes mencioné Phaser 3, pero Phaser 4 ya salió como versión estable en abril de 2026, así que conviene empezar con esa.*
- **Servidor:** Colyseus (última versión estable) con Node LTS.
- **Código compartido:** paquete `shared/` con tipos, constantes y datos de balance (vida, daño, oleadas), que usan tanto el cliente como el servidor.
- **Pruebas:** Vitest para la lógica compartida y la del servidor.

### Estructura del repositorio
```
isekai-squad/
├─ client/            # Phaser + Vite (lo que se publica en GitHub Pages)
│  ├─ public/assets/  # ← AQUÍ VA TU ARTE (ver sección 9)
│  └─ src/scenes/     # Boot, Menu, Lobby, Mapa, Partida, Resultados
├─ server/            # Colyseus (lo que se publica en Render)
│  └─ src/rooms/      # LevelRoom
├─ shared/            # tipos, constantes, datos de balance (JSON/TS)
└─ docs/              # este documento y la guía de arte
```

## 6. Cómo se juega (v1)

### Flujo de pantallas
```
[Inicio] → [Nombre + elegir clase] → [Mapa del mundo] → [Sala de espera] → [Partida] → [Resultados] → [Mapa]
                                                         ↑ link de invitación
```
1. **Inicio:** "Jugar" o "Unirse" (si entraste con un link, va directo a la sala).
2. **Nombre y clase:** el nombre se guarda en el dispositivo.
3. **Mapa del mundo:** se ve la zona Bosque (y las demás bloqueadas, como adelanto).
4. **Sala de espera:** el creador de la sala ve el botón "Copiar link de invitación". Cada jugador elige su clase y marca "Listo". La partida empieza cuando el creador pulsa "Comenzar" (se puede empezar solo).
5. **Partida:** sobrevivir 5 oleadas y luego derrotar al jefe.
6. **Resultados:** muestra quién hizo más daño, cuántos enemigos derrotó cada uno y cuántas veces revivió a otros. Luego se guarda el progreso.

### Controles
- **PC:** WASD o flechas para moverse; teclas 1, 2 y 3 para elegir mejora.
- **Celular:** joystick virtual en la mitad izquierda de la pantalla; tocar las cartas para elegir mejora. Se juega con el teléfono **en horizontal** **[propuesta]**. Como el iPhone no permite forzar la orientación ni la pantalla completa, si el teléfono está en vertical se muestra un aviso de "Gira tu teléfono" que tapa el juego.
- Los ataques son **automáticos** (como en Vampire Survivors). El jugador solo se mueve y elige mejoras, lo que hace el juego cómodo en celular **[propuesta]**.

### Clases (v1: 2 clases) **[propuesta]**
| Clase | Rol | Ataque automático | Habilidad pasiva |
|---|---|---|---|
| **Guerrero** | Cuerpo a cuerpo, resistente | Corte en arco frente a la dirección de movimiento, cada 0.8 s | +30 % de vida máxima |
| **Maga** | A distancia, frágil | Orbe que busca al enemigo más cercano, cada 1 s | Recoge experiencia desde más lejos |

Las clases **Arquera** y **Sanadora** quedan para después de la v1.

### Enemigos (zona Bosque) **[propuesta]**
| Enemigo | Comportamiento | Aparece |
|---|---|---|
| **Slime** | Lento, va directo al jugador más cercano | Desde la oleada 1 |
| **Goblin** | Velocidad media; aparece en grupos de 3 a 5 | Desde la oleada 2 |
| **Murciélago** | Rápido, se mueve en zigzag y tiene poca vida | Desde la oleada 3 |
| **Jefe: Rey Slime** | Grande; salta a la posición de un jugador (con una sombra de aviso de 1 s) y al morir se divide en slimes | Después de la oleada 5 |

### Reglas de la partida **[propuesta]**
- **Oleadas:** 5 oleadas de 60 a 90 s cada una, cada vez más intensas, más el jefe. En total son **unos 8 a 10 minutos**.
- **Escala según jugadores:** la cantidad y la vida de los enemigos aumentan con el número de jugadores. Las cifras exactas van en `shared/balance`.
- **Límite técnico:** como máximo unos 150 enemigos vivos al mismo tiempo por sala, para proteger el rendimiento.
- **Experiencia compartida:** los enemigos sueltan gemas, y cualquiera que recoja una suma experiencia para **todo el equipo**. Así se fomenta jugar juntos.
- **Subir de nivel:** al subir, **cada jugador** elige 1 de 3 mejoras. **No se pausa el juego**: las cartas aparecen en un panel y si no eliges en 10 s se elige una al azar.
- **Mejoras (v1):** +daño, +velocidad de ataque, +velocidad de movimiento, +vida máxima, +proyectil o área, curación instantánea. Cada una tiene 5 niveles.
- **Caer y revivir:** con 0 de vida, el jugador **cae** (no muere). Un compañero lo revive quedándose 3 s a su lado. Si caen todos, **se pierde la partida**. Jugando solo, al caer se pierde.
- **Victoria:** al derrotar al Rey Slime, el nivel cuenta como superado para **todos** los jugadores de la sala.

### Progreso individual
Se guarda en el **dispositivo de cada jugador** (localStorage) **[propuesta]**:
- nombre, última clase usada,
- zonas superadas y desbloqueadas,
- récords personales (más enemigos derrotados, partida más rápida).

**Regla para invitados:** un amigo puede entrar a tu sala aunque no haya desbloqueado esa zona. Si ganan, la zona queda superada también para él **[propuesta]**.

## 7. Multijugador (cómo funciona por dentro)
- **Sala:** una sala de Colyseus (`LevelRoom`) por partida, con capacidad para 4.
- **Link de invitación:** `https://<usuario>.github.io/isekai-squad/?sala=<roomId>`.
- **Servidor autoritativo:** el servidor simula enemigos, colisiones, daño, experiencia y oleadas a **20 actualizaciones por segundo** y sincroniza el estado con los clientes.
- **Cliente:** envía solo su **dirección de movimiento** y la mejora que elige. Usa **predicción** para su propio personaje (se mueve al instante) e **interpolación** para los demás y los enemigos (se ven suaves).
- **Desconexión:** se guarda el lugar del jugador durante **30 s** para que pueda reconectarse. Si no vuelve, su personaje desaparece.
- **Entrar a mitad de partida:** no se permite en la v1. El link solo funciona en la sala de espera; si la partida ya empezó, se muestra "La partida ya comenzó".
- **Servidor dormido:** antes de crear o unirse a una sala, el cliente "toca" el servidor y muestra una pantalla de espera con animación hasta 90 s, con un mensaje claro y la opción de reintentar.

## 8. Pantalla y estilo visual **[propuesta]**
- **Resolución base:** 480×270 píxeles (16:9), escalada a pantalla completa con **zoom entero** y `pixelArt: true`, para que los píxeles se vean nítidos. El zoom entero se calcula sobre los **píxeles físicos** de la pantalla (tamaño CSS × `devicePixelRatio`), no sobre los píxeles CSS; de lo contrario, en un teléfono en horizontal el juego quedaría diminuto.
- **Cámara:** sigue a tu personaje. El mapa del Bosque mide unas 3×3 pantallas, con bordes que no se pueden cruzar.
- **Interfaz (HUD):** vida propia, barra de experiencia del equipo, contador de oleada y temporizador, y la vida de los compañeros (con sus nombres sobre los personajes).
- **Idioma de la interfaz:** español.

## 9. Arte: lista de sprites y cómo integrarlos
Tú haces el arte **[decisión del usuario]**. Para no tener que esperarlo, el juego arranca con **marcadores temporales** (formas de colores del mismo tamaño). Cuando tienes un PNG listo, **lo pones en `client/public/assets/` con el nombre exacto y aparece en el juego sin tocar código** **[propuesta]**.

### Reglas de formato
- PNG con transparencia; tira horizontal de cuadros del mismo tamaño (spritesheet).
- Tamaño de los personajes: **32×32**. Enemigos: **16×16 a 32×32**. Jefe: **64×64**. Tiles: **16×16**.
- Un archivo `assets/manifest.json` dice, para cada sprite, el tamaño del cuadro y cuántos cuadros tiene cada animación. Si cambias la cantidad de cuadros, solo se edita ese JSON.
- Paleta: elige una de Lospec (sugerencia: una de 32 colores) y úsala en todo.

### Lista de la v1
| Archivo | Tamaño cuadro | Animaciones (cuadros) |
|---|---|---|
| `heroes/guerrero.png` | 32×32 | quieto (4), correr (6), caído (2) |
| `heroes/maga.png` | 32×32 | quieto (4), correr (6), caído (2) |
| `enemies/slime.png` | 16×16 | moverse (4), morir (4) |
| `enemies/goblin.png` | 24×24 | correr (6), morir (4) |
| `enemies/murcielago.png` | 16×16 | volar (4), morir (4) |
| `bosses/rey_slime.png` | 64×64 | quieto (4), preparar salto (3), salto (4), morir (6) |
| `fx/corte.png` | 48×32 | 4 |
| `fx/orbe.png` | 8×8 | 4 |
| `fx/gema_xp.png` | 8×8 | 4 (brillo) |
| `fx/golpe.png` | 16×16 | 3 |
| `tiles/bosque.png` | 16×16 | tileset: pasto, caminos, árboles, rocas, bordes |
| `ui/` | varios | corazones, barra de experiencia, 6 íconos de mejora (16×16), marco de cartas, botones, joystick |
| `portraits/guerrero.png`, `portraits/maga.png` | 64×64 | retrato para la selección de clase |

Se incluirá una **guía de arte** (`docs/guia-de-arte.md`) con estos detalles y un ejemplo de `manifest.json`.

## 10. Calidad y pruebas
- Pruebas automáticas de la lógica que no depende de la pantalla: daño, escalado de oleadas, experiencia, revivir, victoria y derrota, y guardado del progreso.
- Prueba del servidor: crear una sala, unir 4 clientes simulados, que alguien se desconecte y se reconecte, y llegar al fin de partida.
- **Prueba de rendimiento:** 4 jugadores y 150 enemigos deben ir a **60 FPS en PC** y a **unos 30 FPS o más en un celular de gama media**.
- Prueba manual antes de cada publicación: una partida completa de 2 jugadores, uno en PC y otro en celular.

## 11. Entregas por etapas **[propuesta]**
1. **Esqueleto:** repo, cliente y servidor conectados; 2 jugadores se mueven en la misma sala usando el link.
2. **Publicación temprana:** GitHub Pages y Render, pantalla de "servidor despertando". Se hace pronto para probar con amigos en celulares y redes reales desde el principio.
3. **Combate base:** enemigos, ataques automáticos, vida, caer y revivir.
4. **Progresión:** experiencia, mejoras, 5 oleadas, jefe, victoria y derrota.
5. **Celular:** joystick, escalado, interfaz táctil y aviso de girar el teléfono.
6. **Meta:** mapa del mundo, progreso guardado, pantalla de resultados.
7. **Arte:** integrar tus sprites a medida que los termines (se puede hacer en paralelo desde la etapa 3).

## 12. Lo que se deja a criterio de quien lo construya
- Números exactos de balance (vida, daño, velocidades), siempre que vivan en `shared/balance` y se puedan ajustar fácilmente.
- Diseño del mapa del Bosque con el tileset.
- Detalles de las animaciones de la interfaz y transiciones.
- Organización interna del código, siempre que se respete la separación client/server/shared.
