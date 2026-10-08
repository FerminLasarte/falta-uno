/**
 * La campaña: un viernes detrás de otro en el mismo torneo. Perder un partido
 * no la termina; la terminan los recursos (GDD §2):
 *
 *   · moral en 0: colapsás y no vas;
 *   · bancarrota: la cancha se paga se juegue o no, y si dos fechas seguidas
 *     te dejan debiendo, el complejo te saca del torneo;
 *   · disolución: varias fechas seguidas sin poder armar el partido.
 *
 * Entre una fecha y otra pasan la plata y el prestigio. La moral no: en la
 * semana se recupera, y cada viernes arranca con la del perfil.
 */
import type { Partida } from "./partida.js";
import type { Resolucion } from "./resolucion.js";
import type { Config, DefinicionPerfil, PerfilId } from "./tipos.js";

export const FINES_CAMPANA = ["moral", "bancarrota", "disolucion"] as const;
export type FinCampana = (typeof FINES_CAMPANA)[number];

/** Cuántas fechas seguidas aguanta cada cosa antes de terminar la campaña. */
export const AGUANTE = {
  fechasConDeuda: 2,
  fechasSinPartido: 3,
} as const;

/** El torneo: dónde se juega y contra quién, fecha por fecha. */
export interface DefinicionTorneo {
  readonly nombre: string;
  readonly complejo: string;
  readonly cancha: string;
  /** Uno por fecha, en orden. Si la campaña dura más, se vuelve a empezar: es la segunda rueda. */
  readonly rivales: readonly string[];
}

export function rivalDe(torneo: DefinicionTorneo, fecha: number): string {
  return torneo.rivales[(fecha - 1) % torneo.rivales.length] ?? "";
}

/** Lo que quedó de una fecha ya jugada. */
export interface FechaJugada {
  readonly fecha: number;
  readonly hayPartido: boolean;
  readonly gano: boolean;
  readonly golesFavor: number;
  readonly golesContra: number;
}

export interface Campana {
  readonly perfil: PerfilId;
  /** De acá sale la semilla de cada viernes. */
  readonly semilla: string;
  /** La fecha que se está jugando. */
  readonly fecha: number;
  /** La plata con la que se arranca esta fecha. Negativa es deuda con el complejo. */
  readonly dinero: number;
  readonly prestigio: number;
  readonly fechasSinPartido: number;
  readonly fechasConDeuda: number;
  readonly jugadas: readonly FechaJugada[];
  readonly fin: FinCampana | null;
}

/** Cómo cerró una fecha: lo que se pagó, lo que se ganó y cómo quedó todo. */
export interface CierreFecha {
  readonly campana: Campana;
  /** La plata al terminar el viernes, antes de pagar la cancha. */
  readonly juntado: number;
  readonly sena: number;
  readonly premio: number;
  readonly prestigio: number;
}

export function nuevaCampana(perfil: DefinicionPerfil, semilla: string): Campana {
  return {
    perfil: perfil.id,
    semilla,
    fecha: 1,
    dinero: perfil.dineroInicial,
    prestigio: 0,
    fechasSinPartido: 0,
    fechasConDeuda: 0,
    jugadas: [],
    fin: null,
  };
}

/** La semilla del viernes que se está jugando. La primera fecha usa la de la campaña tal cual. */
export function semillaDeFecha(campana: Campana): string {
  return campana.fecha === 1 ? campana.semilla : `${campana.semilla}:fecha-${campana.fecha}`;
}

/**
 * Cierra la fecha que se jugó y deja la campaña lista para la siguiente, o
 * terminada. La cancha se paga siempre: con partido o sin él.
 */
export function cerrarFecha(campana: Campana, partida: Partida, resolucion: Resolucion, config: Config): CierreFecha {
  const juntado = partida.dinero;
  const premio = resolucion.recompensa.dinero;
  const dinero = juntado - config.senaCancha + premio;
  const fechasSinPartido = resolucion.hayPartido ? 0 : campana.fechasSinPartido + 1;
  const fechasConDeuda = dinero < 0 ? campana.fechasConDeuda + 1 : 0;

  let fin: FinCampana | null = null;
  if (partida.motivoFin === "moral_agotada") fin = "moral";
  else if (fechasConDeuda >= AGUANTE.fechasConDeuda) fin = "bancarrota";
  else if (fechasSinPartido >= AGUANTE.fechasSinPartido) fin = "disolucion";

  return {
    juntado,
    sena: config.senaCancha,
    premio,
    prestigio: resolucion.recompensa.prestigio,
    campana: {
      ...campana,
      fecha: fin ? campana.fecha : campana.fecha + 1,
      dinero,
      prestigio: campana.prestigio + resolucion.recompensa.prestigio,
      fechasSinPartido,
      fechasConDeuda,
      jugadas: [
        ...campana.jugadas,
        {
          fecha: campana.fecha,
          hayPartido: resolucion.hayPartido,
          gano: resolucion.gano,
          golesFavor: resolucion.golesFavor,
          golesContra: resolucion.golesContra,
        },
      ],
      fin,
    },
  };
}
