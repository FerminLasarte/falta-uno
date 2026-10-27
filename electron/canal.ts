/** Contrato entre el proceso principal y la ventana. Lo comparten los dos lados. */
import type { EstadoSteam } from "./steam.js";
import type { Contenido } from "../src/datos/cargar.js";

export interface Versiones {
  readonly electron: string;
  readonly chrome: string;
  readonly node: string;
  readonly v8: string;
  readonly app: string;
  readonly plataforma: string;
  readonly arquitectura: string;
  readonly empaquetado: boolean;
  /** El commit con el que se construyó el build, con "+" si había cambios sin commitear. */
  readonly commit: string;
}

export interface ResultadoGuardado {
  readonly local: boolean;
  readonly nube: boolean;
}

/** Cómo terminó "Exportar partidas". */
export type ResultadoExportacion =
  | { readonly estado: "listo"; readonly cantidad: number; readonly archivo: string; readonly carpeta: string }
  | { readonly estado: "sin-partidas" }
  | { readonly estado: "cancelado" }
  | { readonly estado: "fallo" };

export interface ApiPuente {
  contenido(): Promise<Contenido>;
  versiones(): Promise<Versiones>;
  estadoSteam(): Promise<EstadoSteam>;
  activarLogro(id: string): Promise<boolean>;
  logroActivado(id: string): Promise<boolean>;
  limpiarLogro(id: string): Promise<boolean>;
  guardar(nombre: string, contenido: string): Promise<ResultadoGuardado>;
  /**
   * Lo mismo, pero bloquea hasta terminar. Solo para cuando se cierra la
   * ventana: ahí una llamada asincrónica puede no llegar nunca.
   */
  guardarYa(nombre: string, contenido: string): ResultadoGuardado;
  cargar(nombre: string): Promise<{ contenido: string | null; origen: string | null }>;
  /** Deja un viernes jugado en `partidas/`, solo en el disco. */
  archivar(nombre: string, contenido: string): Promise<boolean>;
  /** Lo mismo, bloqueando hasta terminar: para cuando se cierra la ventana. */
  archivarYa(nombre: string, contenido: string): boolean;
  archivosEnNube(): Promise<{ nombre: string; bytes: number }[]>;
  /** Junta los viernes de `partidas/` en un archivo, donde elija el tester con el diálogo del sistema. */
  exportarPartidas(): Promise<ResultadoExportacion>;
  /** Abre la carpeta de la última exportación con el archivo marcado. */
  mostrarExportacion(): Promise<void>;
  /** Cierra el juego. Lo que haya que guardar se guarda al cerrarse la ventana. */
  salir(): Promise<void>;
}

export const CANALES = {
  contenido: "contenido:cargar",
  versiones: "plataforma:versiones",
  estadoSteam: "steam:estado",
  activarLogro: "steam:logro:activar",
  logroActivado: "steam:logro:consultar",
  limpiarLogro: "steam:logro:limpiar",
  guardar: "guardado:escribir",
  guardarYa: "guardado:escribir-ya",
  cargar: "guardado:leer",
  archivar: "partidas:escribir",
  archivarYa: "partidas:escribir-ya",
  archivosEnNube: "guardado:listar",
  exportarPartidas: "partidas:exportar",
  mostrarExportacion: "partidas:mostrar",
  salir: "juego:salir",
} as const;
