/**
 * Los números con los que se explica el juego (la pizarra de la tele, los avisos de primera
 * vez): salen de la configuración del modo que se juega, no del texto, así no quedan viejos.
 */
import { configDeViernes, MODO_POR_DEFECTO, type Modo } from "../../core/modo.js";
import { formatearHora } from "../../core/tiempo.js";
import type { Contenido } from "../../datos/cargar.js";

export interface Reglas {
  /** "21:00" */
  readonly corte: string;
  /** "20:30" */
  readonly revision: string;
  /** La revisión, en minutos del día. */
  readonly minutoRevision: number;
  /** Minutos de reloj que tiene el que duda. Sin plazo, tiene hasta la revisión. */
  readonly plazoDuda: number | null;
  readonly suplentes: number;
}

/** Antes de elegir modo, las del de siempre. */
export function reglasDe(contenido: Contenido, modo: Modo = MODO_POR_DEFECTO): Reglas {
  const config = configDeViernes(contenido.config, modo);
  return {
    corte: formatearHora(config.horaCorte),
    revision: formatearHora(config.minutoRevision),
    minutoRevision: config.minutoRevision,
    plazoDuda: config.plazoDuda ?? null,
    suplentes: contenido.config.suplentesTorneo,
  };
}
