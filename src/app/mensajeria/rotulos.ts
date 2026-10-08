/**
 * Cómo se nombra y se colorea cada cosa adentro de la app. Vive en un solo lugar
 * porque la lista, la franja, la bandeja y los chats tienen que decir lo mismo.
 */
import type { EventoFeed } from "../../core/partida.js";
import type { EstadoContacto, Rol } from "../../core/tipos.js";

// TODO(contenido): el grupo y la cancha son de la campaña, no de la interfaz.
// Cuando exista la gestión semanal tienen que venir de los datos.
export const NOMBRE_GRUPO = "Los Pibes F5";
export const TITULO_LISTA = "Viernes 21 h · Los Álamos";

/** Abreviado: entra en un renglón y es como se escribe en cualquier lista de fútbol. */
export const ROL_CORTO: Record<Rol, string> = {
  arquero: "ARQ",
  defensor: "DEF",
  mediocampista: "MED",
  delantero: "DEL",
};

export const ROTULO_ESTADO: Record<EstadoContacto, string> = {
  sin_contactar: "sin escribir",
  esperando: "esperando",
  hablando: "hablando",
  confirmado: "en la lista",
  rechazado: "no viene",
  bajado: "se bajó",
};

/** El color es información: es lo único con color en toda la app. */
export const COLOR_ESTADO: Record<EstadoContacto, string> = {
  sin_contactar: "var(--app-tinta-3)",
  esperando: "var(--est-hablando)",
  hablando: "var(--est-hablando)",
  confirmado: "var(--est-confirmado)",
  rechazado: "var(--est-rechazado)",
  bajado: "var(--est-bajado)",
};

/** Las opciones entre corchetes no son mensajes: son gestos, como cerrar el chat. */
export function esGesto(texto: string): boolean {
  return texto.startsWith("[") && texto.endsWith("]");
}

export function sinCorchetes(texto: string): string {
  return esGesto(texto) ? texto.slice(1, -1) : texto;
}

/** Plata como se escribe acá: $15.000. */
export { formatearPesos as pesos } from "../../core/formato.js";

/** Una acción grande de un chat, con lo que cuesta: escribirle, atender. */
export interface AccionChat {
  readonly texto: string;
  readonly minutos: number;
}

/**
 * Una respuesta de un chat. Casi siempre muestra lo que cuesta en minutos; la
 * que elige el perfil, en cambio, dice qué implica.
 */
export interface RespuestaChat {
  readonly id: string;
  readonly texto: string;
  readonly costoReloj?: number;
  readonly detalle?: { readonly titulo: string; readonly texto: string };
}

/** "Fede y El Tano", "Fede, El Tano y Santi". */
export function enumerar(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

/** Lo que dura un audio, como lo escribe el teléfono: 0:47. */
export function duracionAudio(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(Math.floor(segundos % 60)).padStart(2, "0")}`;
}

/**
 * Lo que se ve de un mensaje en una vista previa: la bandeja, la isla. De un
 * audio, que es un audio y cuánto dura; lo que dice se sabe escuchándolo.
 */
export function vistaPrevia(evento: Pick<EventoFeed, "texto" | "audio">): string {
  return evento.audio ? `Audio · ${duracionAudio(evento.audio.segundos)}` : evento.texto;
}
