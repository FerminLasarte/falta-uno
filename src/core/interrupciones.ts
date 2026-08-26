import type { Efectos, TipoEvento } from "./tipos.js";

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
  readonly costoAtender: number;
  readonly efectosAtender: Efectos;
  readonly registrarSiIgnorada: TipoEvento;
}

export interface InterrupcionActiva {
  readonly definicion: DefinicionInterrupcion;
  readonly minutoLlegada: number;
  /** Moral total drenada mientras estuvo pendiente. Alimenta la narración. */
  drenajeAcumulado: number;
}
