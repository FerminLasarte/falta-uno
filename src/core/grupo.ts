/**
 * La vida propia del grupo: lo que se habla sin que vos hagas nada, los audios
 * que cuesta reloj escuchar y los roces entre los que ya están en la lista.
 * Todo sale de datos (`contenido/grupo.json`); este archivo solo los tipa.
 */
import type { Efectos, Rasgo } from "./tipos.js";

/** Un audio. Lo que dice solo se sabe escuchándolo, y escucharlo cuesta reloj. */
export interface DefinicionAudio {
  readonly id: string;
  /** Lo que dura, como lo muestra el teléfono. De ahí sale lo que cuesta escucharlo. */
  readonly segundos: number;
  readonly transcripcion: string;
  /** Lo que le pasa a quien lo mandó cuando lo escuchás. */
  readonly alEscuchar?: Efectos;
  /** Mientras no lo escuches, quien lo mandó se enfría esto por cada acción tuya. */
  readonly enfriaPorAccion?: number;
}

/**
 * Un mensaje al grupo. En una charla, `de` es el id de un contacto; en un roce,
 * "a" o "b". Lleva texto o un audio, nunca los dos.
 */
export interface MensajeGrupo {
  readonly de: string;
  readonly texto?: string;
  readonly audio?: DefinicionAudio;
  /** Contesta citando el mensaje anterior: así se ve que uno le habla al otro. */
  readonly cita?: boolean;
}

/** Cuándo arranca una charla: en una franja del reloj, cuando alguien confirma o cuando la lista llega a tanto. */
export type Disparador =
  | { readonly desde: number; readonly hasta: number }
  | { readonly alConfirmar: string }
  | { readonly conConfirmados: number };

export interface Charla {
  readonly id: string;
  readonly cuando: Disparador;
  readonly mensajes: readonly MensajeGrupo[];
}

/**
 * Cómo se pelean dos rasgos en el grupo. "a" es el que tiene el primer rasgo y
 * "b" el que tiene el segundo, sin importar quién entró antes a la lista. `{a}`
 * y `{b}` se reemplazan por sus nombres.
 */
export interface PlantillaRoce {
  readonly entre: readonly [Rasgo, Rasgo];
  readonly mensajes: readonly MensajeGrupo[];
  /** Lo que mandás para calmar esta pelea, si no es el de siempre. */
  readonly calmar?: string;
}

/** Bajar un cambio en el grupo cuando hay roce: cuesta reloj y frena que se calienten. */
export interface Calmar {
  readonly texto: string;
  readonly costoReloj: number;
  /** Lo que mandás al grupo. */
  readonly mensaje: string;
  /** Lo que contestan los que se estaban peleando: "a" y "b". */
  readonly respuestas: readonly MensajeGrupo[];
  /** Mientras nadie los calme, cada uno de los dos se enfría esto por cada acción tuya. */
  readonly calientaPorAccion: number;
}

/**
 * Cerrar la lista: mandás un mensaje al grupo y el reloj corre hasta las 21:00.
 * Con los diez, o cuando ya no queda nada por hacer para llegar.
 */
export interface Cerrar {
  readonly texto: string;
  /** Lo que mandás al grupo con los diez. */
  readonly mensaje: string;
  /** Lo que mandás cuando no llegaste y ya no queda a quién escribirle. */
  readonly sinDiez: string;
}

export interface DefinicionGrupo {
  readonly charlas: readonly Charla[];
  readonly roces: readonly PlantillaRoce[];
  readonly calmar: Calmar;
  readonly cerrar: Cerrar;
}

/** Un grupo sin vida: para tests y partidas que no la necesitan. */
export const GRUPO_QUIETO: DefinicionGrupo = {
  charlas: [],
  roces: [],
  calmar: { texto: "Calmar", costoReloj: 3, mensaje: "Tranquilos.", respuestas: [], calientaPorAccion: 0 },
  cerrar: { texto: "Cerrar la lista", mensaje: "Lista cerrada.", sinDiez: "No llegamos." },
};

/** La voz de quien no tiene una definida, en Hz: la del murmullo de sus audios. */
export const VOZ_POR_DEFECTO = 120;

/** Un minuto de reloj por cada medio minuto de audio, nunca menos de uno. */
export function costoDeEscuchar(segundos: number): number {
  return Math.max(1, Math.ceil(segundos / 30));
}
