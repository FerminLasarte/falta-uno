import type { Efectos, TipoEvento } from "./tipos.js";

/** Un mensaje más mientras no la atiendas. Los segundos son reales y cuentan desde el anterior. */
export interface Insistencia {
  readonly texto: string;
  readonly segundos: number;
}

export interface DefinicionInterrupcion {
  readonly id: string;
  readonly de: string;
  readonly texto: string;
  /** Ventana en la que puede dispararse (minutos absolutos del día). */
  readonly minutoDesde: number;
  readonly minutoHasta: number;
  readonly probabilidad: number;
  /** Moral que se pierde por cada acción mientras siga sin atender. */
  readonly drenajePorAccion: number;
  /** Hasta cuánto drena antes de rendirse: Sofi arranca el capítulo sola. Sin tope, drena siempre. */
  readonly drenajeMaximo?: number;
  readonly costoAtender: number;
  readonly efectosAtender: Efectos;
  readonly registrarSiIgnorada: TipoEvento;
  /** Lo que vuelve a escribir si la dejás esperando. No cuesta nada: solo se apila. */
  readonly insistencias?: readonly Insistencia[];
}

export interface InterrupcionActiva {
  readonly definicion: DefinicionInterrupcion;
  readonly minutoLlegada: number;
  /** Moral total drenada mientras estuvo pendiente. Alimenta la narración. */
  drenajeAcumulado: number;
}
