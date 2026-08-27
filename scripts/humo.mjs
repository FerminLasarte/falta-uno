/**
 * Smoke test de plataforma: levanta el juego de verdad, espera a que la ventana
 * cargue y lo cierra. Es lo que corre en CI y lo primero que se corre en una
 * máquina nueva. Falla si la ventana no carga o si el renderer tira errores.
 */
import { spawn } from "node:child_process";
import electron from "electron";

const ESPERA_MS = 25_000;

const proceso = spawn(electron, ["."], {
  env: { ...process.env, FALTA_UNO_SIN_STEAM: process.env.FALTA_UNO_SIN_STEAM ?? "" },
});

let salida = "";
let resuelto = false;

const listo = new Promise((resolve) => {
  const mirar = (trozo) => {
    const texto = trozo.toString();
    salida += texto;
    process.stdout.write(texto);
    if (texto.includes("[ventana] cargada") && !resuelto) {
      resuelto = true;
      resolve("cargó");
    }
    if (/\[ventana\] no cargó|\[preload\] falló|se murió el renderer/.test(texto) && !resuelto) {
      resuelto = true;
      resolve("falló");
    }
  };
  proceso.stdout.on("data", mirar);
  proceso.stderr.on("data", mirar);
});

const vencimiento = new Promise((resolve) => setTimeout(() => resolve("timeout"), ESPERA_MS));
const resultado = await Promise.race([listo, vencimiento]);

proceso.kill();

const errores = salida
  .split("\n")
  .filter((l) => l.startsWith("[renderer]") || l.startsWith("[preload]"));

if (resultado === "cargó" && errores.length === 0) {
  console.log("\n✓ la ventana cargó sin errores de renderer\n");
  process.exit(0);
}

console.error(`\n✗ smoke test falló (${resultado})`);
for (const error of errores) console.error(`  ${error}`);
console.error("");
process.exit(1);
