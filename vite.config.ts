import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [svelte()],
  root: "src/app",
  base: "./",
  build: {
    outDir: resolve(process.cwd(), "dist/renderer"),
    emptyOutDir: true,
    target: "chrome130",
    // El juego no se sirve por HTTP: se abre con file://. Nada de code splitting.
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  server: { port: 5273, strictPort: true },
  clearScreen: false,
});
