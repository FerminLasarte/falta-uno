/**
 * Build del juego. Dos mundos distintos con reglas distintas:
 *   · proceso principal y preload → CommonJS con esbuild (módulos nativos)
 *   · ventana → Vite (el bundler que va a usar Svelte en la Fase 3)
 */
import { build as esbuild } from "esbuild";
import { definiciones } from "./commit.mjs";
import { build as vite } from "vite";
import { rm } from "node:fs/promises";

const modo = process.argv[2] ?? "produccion";
const desarrollo = modo === "desarrollo";

await rm("dist", { recursive: true, force: true });

const comun = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  sourcemap: desarrollo,
  minify: !desarrollo,
  // Electron lo provee el runtime; steamworks.js trae binarios nativos que no
  // se pueden bundlear: van sueltos en node_modules y se desempaquetan del asar.
  external: ["electron", "steamworks.js"],
  define: definiciones(),
  logLevel: "info",
};

await esbuild({ ...comun, entryPoints: ["electron/main.ts"], outfile: "dist/electron/main.cjs" });
await esbuild({
  ...comun,
  entryPoints: ["electron/preload.ts"],
  outfile: "dist/electron/preload.cjs",
});

if (!desarrollo) {
  await vite({ configFile: "vite.config.ts", mode: "production" });
}

console.log(`\n✓ build ${modo} en dist/\n`);
