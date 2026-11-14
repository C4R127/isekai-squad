/** Resolución base del juego (16:9), en píxeles. */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

/** Mapa del Bosque: 3×3 pantallas. */
export const MAP_WIDTH = GAME_WIDTH * 3;
export const MAP_HEIGHT = GAME_HEIGHT * 3;

/** El servidor simula a 20 actualizaciones por segundo. */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

export const MAX_PLAYERS = 4;
export const RECONNECT_SECONDS = 30;

export const PLAYER_SIZE = 32;
/** Balance: velocidad de los personajes, en píxeles por segundo. */
export const PLAYER_SPEED = 80;
/** Paso de movimiento más largo permitido, para evitar teletransportes. */
export const MAX_STEP_SECONDS = 0.1;

export const NAME_MAX_LENGTH = 12;
export const DEFAULT_NAME = "Héroe";

export const ROOM_NAME = "level";
