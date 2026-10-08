/**
 * Guardado. Steam Cloud cuando está disponible, disco local siempre.
 * Se escribe en los dos lados a propósito: el archivo local es la copia que
 * sobrevive a un Steam caído, y la nube es la que viaja entre máquinas.
 *
 * Cada copia lleva un sello que sube con cada guardado. Al cargar gana la de
 * sello más alto, esté donde esté: si una escritura a la nube falló, la copia
 * vieja de la nube no pisa la nueva del disco, y la partida que viene de otra
 * máquina sí pisa la local.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { nube } from "./steam.js";

export interface DestinoGuardado {
  readonly local: boolean;
  readonly nube: boolean;
}

export interface Copia {
  readonly sello: number;
  readonly datos: string;
}

let carpeta = ".";
/** El último sello conocido de cada archivo, para no releer el disco en cada guardado. */
const sellos = new Map<string, number>();

export function configurarCarpeta(ruta: string): void {
  carpeta = ruta;
  sellos.clear();
}

function rutaLocal(nombre: string): string {
  return join(carpeta, "saves", nombre);
}

/** Lee una copia. Si está rota, no existe: el juego arranca de cero antes que romperse. */
export function leerCopia(texto: string | null): Copia | null {
  if (texto === null) return null;
  try {
    const { sello, datos } = JSON.parse(texto) as Record<string, unknown>;
    if (!Number.isInteger(sello) || typeof datos !== "string") return null;
    return { sello: sello as number, datos };
  } catch {
    return null;
  }
}

/** La más nueva de las dos. Con el mismo sello son la misma partida: da lo mismo cuál. */
export function masNueva(a: Copia | null, b: Copia | null): Copia | null {
  if (!a) return b;
  if (!b) return a;
  return b.sello > a.sello ? b : a;
}

function leerLocal(nombre: string): string | null {
  try {
    const ruta = rutaLocal(nombre);
    return existsSync(ruta) ? readFileSync(ruta, "utf8") : null;
  } catch {
    return null;
  }
}

function copias(nombre: string): { nube: Copia | null; local: Copia | null } {
  return { nube: leerCopia(nube.leer(nombre)), local: leerCopia(leerLocal(nombre)) };
}

export function guardar(nombre: string, datos: string): DestinoGuardado {
  let anterior = sellos.get(nombre);
  if (anterior === undefined) {
    const { nube: enNube, local } = copias(nombre);
    anterior = masNueva(enNube, local)?.sello ?? 0;
  }
  const sello = anterior + 1;
  sellos.set(nombre, sello);
  const texto = JSON.stringify({ sello, datos } satisfies Copia);

  return { local: escribirEntero(rutaLocal(nombre), texto), nube: nube.escribir(nombre, texto) };
}

/**
 * Se escribe al lado y se renombra: un corte de luz a mitad de camino deja la
 * copia anterior entera, nunca un archivo por la mitad.
 */
function escribirEntero(ruta: string, texto: string): boolean {
  try {
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(`${ruta}.tmp`, texto, "utf8");
    renameSync(`${ruta}.tmp`, ruta);
    return true;
  } catch {
    return false;
  }
}

/**
 * Un viernes jugado, en su propio archivo dentro de `partidas/`. Solo en el
 * disco: es para analizar cómo jugó alguien, no para seguir jugando en otra
 * máquina, y no tiene por qué gastar la cuota de Steam Cloud.
 */
export function archivar(nombre: string, datos: string): boolean {
  // El nombre lo arma la ventana: que no pueda salirse de la carpeta.
  if (basename(nombre) !== nombre || !nombre.endsWith(".json")) return false;
  return escribirEntero(join(carpeta, "partidas", nombre), datos);
}

export function cargar(nombre: string): { contenido: string | null; origen: "nube" | "local" | null } {
  const { nube: enNube, local } = copias(nombre);
  const elegida = masNueva(enNube, local);
  if (!elegida) return { contenido: null, origen: null };
  sellos.set(nombre, elegida.sello);
  return { contenido: elegida.datos, origen: elegida === enNube ? "nube" : "local" };
}
