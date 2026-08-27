/**
 * Guardado. Steam Cloud cuando está disponible, disco local siempre.
 * Se escribe en los dos lados a propósito: el archivo local es la copia que
 * sobrevive a un Steam caído, y la nube es la que viaja entre máquinas.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { nube } from "./steam.js";

export interface DestinoGuardado {
  readonly local: boolean;
  readonly nube: boolean;
}

let carpeta = ".";

export function configurarCarpeta(ruta: string): void {
  carpeta = ruta;
}

function rutaLocal(nombre: string): string {
  return join(carpeta, "saves", nombre);
}

export function guardar(nombre: string, contenido: string): DestinoGuardado {
  let local = false;
  try {
    const ruta = rutaLocal(nombre);
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, contenido, "utf8");
    local = true;
  } catch {
    local = false;
  }
  return { local, nube: nube.escribir(nombre, contenido) };
}

/** La nube gana cuando existe: es la que trae la partida de la otra máquina. */
export function cargar(nombre: string): { contenido: string | null; origen: "nube" | "local" | null } {
  const enNube = nube.leer(nombre);
  if (enNube !== null) return { contenido: enNube, origen: "nube" };

  try {
    const ruta = rutaLocal(nombre);
    if (existsSync(ruta)) return { contenido: readFileSync(ruta, "utf8"), origen: "local" };
  } catch {
    /* si el disco falla, se devuelve vacío y el juego arranca de cero */
  }
  return { contenido: null, origen: null };
}
