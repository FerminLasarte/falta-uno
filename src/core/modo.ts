/**
 * El modo de juego: qué formato de cancha y si es un partido suelto o el
 * torneo. Armás tu equipo contra un rival: en un partido van los titulares del
 * formato (uno al arco); en el torneo, además, los suplentes, del puesto que
 * sean. La agenda es la misma en todos los modos: el formato es la dificultad.
 */
import type { Config, Rol } from "./tipos.js";

export const FORMATOS = ["f5", "f6", "f8"] as const;
export type Formato = (typeof FORMATOS)[number];

export const COMPETENCIAS = ["partido", "torneo"] as const;
export type Competencia = (typeof COMPETENCIAS)[number];

export interface Modo {
  readonly formato: Formato;
  readonly competencia: Competencia;
}

/** El del vertical slice: una fecha del torneo de fútbol 5. */
export const MODO_POR_DEFECTO: Modo = { formato: "f5", competencia: "torneo" };

export interface DefinicionFormato {
  readonly nombre: string;
  /** Cuántos juegan por equipo, el arquero incluido. */
  readonly porEquipo: number;
  /** A qué hora arranca el viernes, si no es la de siempre: armar una cancha grande lleva más. */
  readonly horaInicio?: number;
  /** La última revisión, si en este formato no es la de siempre. */
  readonly minutoRevision?: Readonly<Partial<Record<Competencia, number>>>;
  /** Lo que sale la cancha: más grande, más cara. */
  readonly sena: number;
  /** El equipo ideal, por puesto. Suma `porEquipo`. */
  readonly titulares: Readonly<Record<Rol, number>>;
}

/** La configuración tal como está en `contenido/config.json`: sin modo todavía. */
export interface ConfigContenido {
  readonly horaInicio: number;
  readonly horaCorte: number;
  readonly costoVacante: number;
  /** Desde qué probabilidad se baja a las 20:30. En un partido suelto se compromete menos que en un torneo. */
  readonly umbralBaja: Readonly<Record<Competencia, number>>;
  /** Cuándo es la última revisión. En el partido suelto, más tarde: las bajas llegan cuando queda poco. */
  readonly minutoRevision: Readonly<Record<Competencia, number>>;
  /** Cuántos suplentes pide el torneo. El partido suelto no lleva. */
  readonly suplentesTorneo: number;
  /** Cuántos minutos antes de la revisión avisan los que dudan: cuanto menos, menos tiempo para llamarlos. */
  readonly avisoAntes: number;
  /** Cuántos de la agenda tienen una excusa esa noche: los elige la semilla. */
  readonly excusas: { readonly min: number; readonly max: number };
  readonly formatos: Readonly<Record<Formato, DefinicionFormato>>;
}

/** La configuración de un viernes en un modo: cuántos van, qué sale la cancha y el equipo ideal. */
export function configDeViernes(base: ConfigContenido, modo: Modo): Config {
  const formato = base.formatos[modo.formato];
  const suplentes = modo.competencia === "torneo" ? base.suplentesTorneo : 0;
  return {
    horaInicio: formato.horaInicio ?? base.horaInicio,
    horaCorte: base.horaCorte,
    costoVacante: base.costoVacante,
    umbralBaja: base.umbralBaja[modo.competencia],
    minutoRevision: formato.minutoRevision?.[modo.competencia] ?? base.minutoRevision[modo.competencia],
    jugadoresNecesarios: formato.porEquipo + suplentes,
    senaCancha: formato.sena,
    composicion: formato.titulares,
    suplentes,
    avisoAntes: base.avisoAntes,
    excusas: base.excusas,
  };
}

/** "torneo F5", "partido F8": como lo dice el bot. */
export function nombreDelModo(modo: Modo): string {
  return `${modo.competencia} ${modo.formato.toUpperCase()}`;
}

export const TODOS_LOS_MODOS: readonly Modo[] = COMPETENCIAS.flatMap((competencia) =>
  FORMATOS.map((formato) => ({ formato, competencia })),
);
