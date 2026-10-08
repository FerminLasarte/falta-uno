/**
 * Desarrollo: Vite sirve la ventana con recarga en caliente, Electron la abre.
 * El proceso principal se rebuildea y Electron se reinicia cuando cambia algo
 * de electron/.
 */
import { createServer } from "vite";
import { build as esbuild } from "esbuild";
import { definiciones } from "./commit.mjs";
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import electron from "electron";

const comun = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  sourcemap: true,
  external: ["electron", "steamworks.js"],
  define: definiciones(),
  logLevel: "warning",
};

async function construirPrincipal() {
  await esbuild({ ...comun, entryPoints: ["electron/main.ts"], outfile: "dist/electron/main.cjs" });
  await esbuild({
    ...comun,
    entryPoints: ["electron/preload.ts"],
    outfile: "dist/electron/preload.cjs",
  });
}

const servidor = await createServer({ configFile: "vite.config.ts", mode: "development" });
await servidor.listen();
const url = servidor.resolvedUrls?.local?.[0];
if (!url) throw new Error("Vite no expuso una URL local");
console.log(`\n  ventana servida en ${url}`);

await construirPrincipal();

let proceso = null;

function arrancarElectron() {
  proceso?.kill();
  proceso = spawn(electron, ["."], {
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
  });
  proceso.on("close", (codigo) => {
    if (codigo !== null && codigo !== 0 && proceso) {
      servidor.close().then(() => process.exit(codigo));
    }
  });
}

arrancarElectron();

watch("electron", { recursive: true }, async () => {
  console.log("  · cambió el proceso principal, reiniciando");
  await construirPrincipal();
  arrancarElectron();
});

process.on("SIGINT", async () => {
  proceso?.kill();
  await servidor.close();
  process.exit(0);
});
