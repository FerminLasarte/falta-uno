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
}

export interface ResultadoGuardado {
  readonly local: boolean;
  readonly nube: boolean;
}

export interface ApiPuente {
  contenido(): Promise<Contenido>;
  versiones(): Promise<Versiones>;
  estadoSteam(): Promise<EstadoSteam>;
  activarLogro(id: string): Promise<boolean>;
  logroActivado(id: string): Promise<boolean>;
  limpiarLogro(id: string): Promise<boolean>;
  guardar(nombre: string, contenido: string): Promise<ResultadoGuardado>;
  cargar(nombre: string): Promise<{ contenido: string | null; origen: string | null }>;
  archivosEnNube(): Promise<{ nombre: string; bytes: number }[]>;
}

export const CANALES = {
  contenido: "contenido:cargar",
  versiones: "plataforma:versiones",
  estadoSteam: "steam:estado",
  activarLogro: "steam:logro:activar",
  logroActivado: "steam:logro:consultar",
  limpiarLogro: "steam:logro:limpiar",
  guardar: "guardado:escribir",
  cargar: "guardado:leer",
  archivosEnNube: "guardado:listar",
} as const;
