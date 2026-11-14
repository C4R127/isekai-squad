import { defineConfig } from "vite";

export default defineConfig({
  // Rutas relativas: el juego funciona igual en la raíz o en una subcarpeta de GitHub Pages.
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
  },
});
