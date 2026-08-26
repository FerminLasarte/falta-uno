/**
 * Tipos del dominio. Este archivo, como todo `src/core`, no toca el DOM.
 */

export const ROLES = ["arquero", "defensor", "mediocampista", "delantero"] as const;
export type Rol = (typeof ROLES)[number];

export const RASGOS = [
  "quejoso",
  "impuntual",
  "rustico",
  "habilidoso",
  "aguantador",
  "cagon",
  "capitan",
] as const;
export type Rasgo = (typeof RASGOS)[number];

export const ESTADOS_CONTACTO = [
  "sin_contactar",
  "esperando", // le escribiste, no respondió todavía
  "hablando", // conversación abierta
  "confirmado",
  "rechazado",
  "bajado", // había confirmado y se cayó
] as const;
export type EstadoContacto = (typeof ESTADOS_CONTACTO)[number];

export const PERFILES = ["acomodado", "pibe_de_barrio", "oficinista"] as const;
export type PerfilId = (typeof PERFILES)[number];

/** Efectos declarativos. Nunca código embebido: son datos que el núcleo interpreta. */
export interface Efectos {
  readonly moral?: number;
  readonly dinero?: number;
  readonly probabilidadBaja?: number;
  readonly enojo?: number;
  readonly dineroAportado?: number;
  readonly estado?: EstadoContacto;
  /** Etiqueta que se guarda en la bitácora para que la resolución pueda narrarla. */
  readonly registrar?: TipoEvento;
}

export const TIPOS_EVENTO = [
  "apuro", // lo apuraste / lo presionaste
  "favor", // le hiciste un favor
  "plata", // le pagaste para que venga
  "ignorado", // lo dejaste en visto
  "roce", // hubo cruce en el chat
  "pareja_ignorada",
  "trabajo_ignorado",
  "confirmacion_limpia",
  "baja_tardia",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export interface EntradaBitacora {
  readonly tipo: TipoEvento;
  readonly minuto: number;
  readonly contactoId?: string;
  readonly detalle?: string;
}

export interface OpcionDialogo {
  readonly id: string;
  readonly texto: string;
  readonly costoReloj: number;
  readonly efectos: Efectos;
  readonly siguiente: string | null;
  /** Requisitos para que la opción aparezca. */
  readonly requiere?: {
    readonly dineroMin?: number;
    readonly moralMin?: number;
    readonly horaDesde?: number;
    readonly horaHasta?: number;
  };
}

export interface NodoDialogo {
  readonly mensajes: readonly string[];
  readonly opciones: readonly OpcionDialogo[];
}

export interface DefinicionContacto {
  readonly id: string;
  readonly nombre: string;
  readonly rol: Rol;
  readonly habilidad: number;
  readonly rasgos: readonly Rasgo[];
  readonly probabilidadBajaInicial: number;
  readonly nodoInicial: string;
  readonly nodos: Readonly<Record<string, NodoDialogo>>;
}

export interface DefinicionPerfil {
  readonly id: PerfilId;
  readonly nombre: string;
  readonly moralInicial: number;
  readonly dineroInicial: number;
  readonly ventaja: string;
  readonly desventaja: string;
  readonly contactoUnico: string;
}

export interface Config {
  readonly horaInicio: number;
  readonly horaCorte: number;
  readonly jugadoresNecesarios: number;
  readonly senaCancha: number;
  readonly costoVacante: number;
  readonly umbralBaja: number;
  readonly minutoRevision: number;
}

/** Estado mutable de un contacto durante un viernes. */
export interface EstadoDeContacto {
  readonly id: string;
  estado: EstadoContacto;
  probabilidadBaja: number;
  enojo: number;
  dineroAportado: number;
  nodoActual: string | null;
  /** Mensajes del NPC ya recibidos, en orden. */
  historial: string[];
}

export interface Desglose {
  readonly concepto: string;
  readonly valor: number;
}

export type MotivoFin =
  | "corte_horario"
  | "moral_agotada"
  | "bancarrota";
