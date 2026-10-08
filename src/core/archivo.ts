/**
 * El archivo de viernes jugados. El guardado tiene un solo viernes, el que está
 * en curso, y lo pisa al pasar de fecha; acá queda cada uno en su archivo, con
 * lo que hace falta para reproducirlo tal cual y para saber qué miraba quien lo
 * jugó. Es lo que se le pide a un tester: lo que hizo, no lo que se acuerda.
 *
 * Los archivos viven solo en el disco, nunca en Steam Cloud.
 */
import type { Apodos } from "./apodos.js";
import { MODO_POR_DEFECTO, type Modo } from "./modo.js";
import { esApodos, esModo, esObjeto, esTexto, esViernes, type ViernesGuardado } from "./registro.js";
import { PERFILES, type PerfilId } from "./tipos.js";

export const FORMATO_ARCHIVO = 1;

/**
 * Lo que la vista mostraba desde ese momento: "grupo", "chats", "contacto:carlos".
 * `ms` es el tiempo real jugado y `paso` cuántos pasos había en el registro: con
 * los dos se intercala con lo que hizo.
 */
export interface MarcaVista {
  readonly ms: number;
  readonly paso: number;
  readonly pantalla: string;
}

/** Con qué build se jugó: para saber a qué versión del juego corresponde lo que pasó. */
export interface Build {
  readonly version: string;
  readonly commit: string;
  readonly plataforma: string;
}

export interface ViernesArchivado {
  readonly formato: typeof FORMATO_ARCHIVO;
  readonly build: Build;
  readonly campana: { readonly semilla: string; readonly perfil: PerfilId; readonly modo: Modo; readonly apodos?: Apodos };
  readonly viernes: ViernesGuardado;
  readonly marcas: readonly MarcaVista[];
  /** Hora de la máquina al empezar y al guardar por última vez, en ISO. Solo para ordenar sesiones. */
  readonly empezado: string;
  readonly actualizado: string;
  /** Llegó a las 21:00 o se quedó sin moral. Si no, se dejó a medias. */
  readonly terminado: boolean;
}

/** Un archivo por viernes: la semilla de la campaña y la fecha. Volver a guardarlo lo pisa. */
export function nombreDeArchivo(semillaCampana: string, fecha: number): string {
  const limpia = semillaCampana.replace(/[^\w-]/g, "_").slice(0, 60) || "sin-semilla";
  return `${limpia}-fecha-${fecha}.json`;
}

const esEnteroNoNegativo = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;

export function esMarca(x: unknown): x is MarcaVista {
  return esObjeto(x) && esEnteroNoNegativo(x["ms"]) && esEnteroNoNegativo(x["paso"]) && esTexto(x["pantalla"]);
}

function esBuild(x: unknown): x is Build {
  return esObjeto(x) && esTexto(x["version"]) && esTexto(x["commit"]) && esTexto(x["plataforma"]);
}

/** Lee un viernes archivado. Si está roto o es de otro formato, null. */
export function leerArchivado(texto: string): ViernesArchivado | null {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!esObjeto(crudo) || crudo["formato"] !== FORMATO_ARCHIVO) return null;
  const { build, campana, viernes, marcas, empezado, actualizado, terminado } = crudo;
  if (!esBuild(build) || !esViernes(viernes) || !esTexto(empezado) || !esTexto(actualizado)) return null;
  if (typeof terminado !== "boolean" || !Array.isArray(marcas) || !marcas.every(esMarca)) return null;
  if (!esObjeto(campana) || !esTexto(campana["semilla"])) return null;
  const { perfil, modo, apodos } = campana;
  if (!(PERFILES as readonly unknown[]).includes(perfil)) return null;
  if ((modo !== undefined && !esModo(modo)) || (apodos !== undefined && !esApodos(apodos))) return null;
  return {
    formato: FORMATO_ARCHIVO,
    build,
    campana: {
      semilla: campana["semilla"],
      perfil: perfil as PerfilId,
      modo: modo ?? MODO_POR_DEFECTO,
      ...(apodos ? { apodos } : {}),
    },
    viernes,
    marcas,
    empezado,
    actualizado,
    terminado,
  };
}
