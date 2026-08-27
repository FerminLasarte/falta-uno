import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
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
