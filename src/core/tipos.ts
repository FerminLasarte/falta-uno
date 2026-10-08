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
  // Qué vota: también se pelean por eso en el grupo.
  "kuka",
  "gorila",
  "libertario",
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
  /** Lo que le provoca a otros de la agenda. Si no están en la agenda, nada. */
  readonly otros?: readonly { readonly contacto: string; readonly probabilidadBaja?: number; readonly enojo?: number }[];
  /** Los que trae con él. Juegan si él juega: si se baja, se van con él. */
  readonly trae?: readonly Invitado[];
}

/** Alguien que no está en tu agenda y viene porque lo trae otro. */
export interface Invitado {
  readonly nombre: string;
  readonly rol: Rol;
  readonly habilidad: number;
  /** No lo conocés: a las 20:30 puede no venir. El texto es lo que te dice el que lo trajo. */
  readonly noViene?: { readonly probabilidad: number; readonly texto: string };
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
  "roce_calmado", // calmaste a dos que se estaban peleando en el grupo
  "trajo", // alguien de la agenda trajo a otro que no conocés
  "no_vino", // el que trajo alguien al final no vino
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export interface EntradaBitacora {
  readonly tipo: TipoEvento;
  readonly minuto: number;
  readonly contactoId?: string;
  readonly detalle?: string;
  /** El otro de un par, cuando la entrada es de dos: los que se cruzaron en el grupo. */
  readonly otroId?: string;
}

/**
 * Algo que tiene que ser cierto: para que aparezca una respuesta, para que la
 * charla siga por un lado o por otro, para que alguien abra de una manera o
 * para que se baje. Todos los campos tienen que cumplirse a la vez.
 */
export interface Condicion {
  readonly dineroMin?: number;
  readonly moralMin?: number;
  readonly horaDesde?: number;
  readonly horaHasta?: number;
  /** Escuchaste ese audio del grupo: lo que dijo es lo que te deja contestar esto. */
  readonly escuchado?: string;
  /** Ese contacto está en la lista. La lista es pública: todos la ven. */
  readonly confirmado?: string;
  /** Ese contacto no está en la lista. */
  readonly noConfirmado?: string;
  /** Hay por lo menos tantos en la lista. */
  readonly confirmadosMin?: number;
  /** Faltan por lo menos tantos para llenar la lista: "si les falta gente, traigo a mi primo". */
  readonly faltanMin?: number;
  /** A este mismo contacto le contestaste esa respuesta. */
  readonly elegiste?: string;
  /** A otro contacto le contestaste esa respuesta. */
  readonly elegidoA?: { readonly contacto: string; readonly opcion: string };
}

/** Para dónde sigue la charla si se cumple `si`. Sin `si`, es el camino de siempre. */
export interface Desvio {
  readonly si?: Condicion;
  readonly nodo: string | null;
}

export interface OpcionDialogo {
  readonly id: string;
  readonly texto: string;
  readonly costoReloj: number;
  readonly efectos: Efectos;
  /**
   * El nodo que sigue, null si la charla termina, o una lista de desvíos: el
   * primero que se cumpla. El último va sin condición.
   */
  readonly siguiente: string | null | readonly Desvio[];
  /** Requisitos para que la opción aparezca. */
  readonly requiere?: Condicion;
}

/** Cómo arranca la charla si se cumple `si`: escribirle tarde no es lo mismo que escribirle temprano. */
export interface Apertura {
  readonly si: Condicion;
  readonly nodo: string;
}

/**
 * Cómo se baja a las 20:30. Con `si`, se baja aunque esté tranquilo, si eso es
 * cierto (la mentira que se descubrió). Sin `si`, es lo que dice cuando se baja
 * porque quedó caliente. `porque` es la decisión tuya que la explica, para la narración.
 */
export interface Baja {
  readonly si?: Condicion;
  readonly texto: string;
  readonly porque?: string;
}

export interface NodoDialogo {
  readonly mensajes: readonly string[];
  readonly opciones: readonly OpcionDialogo[];
}

export interface DefinicionContacto {
  readonly id: string;
  readonly nombre: string;
  /** Quién es, en una línea: para saber a qué amigo le toca. */
  readonly retrato?: string;
  readonly rol: Rol;
  readonly habilidad: number;
  readonly rasgos: readonly Rasgo[];
  readonly probabilidadBajaInicial: number;
  /** Su voz en Hz: la del murmullo de sus audios. Más bajo, más grave. */
  readonly voz?: number;
  readonly nodoInicial: string;
  /** Otras maneras de arrancar, según cuándo o cómo le escribís. Gana la primera que se cumpla. */
  readonly aperturas?: readonly Apertura[];
  readonly nodos: Readonly<Record<string, NodoDialogo>>;
  readonly bajas?: readonly Baja[];
}

/** Los nodos a los que puede llevar una respuesta. null es que la charla termina. */
export function destinos(opcion: OpcionDialogo): (string | null)[] {
  return Array.isArray(opcion.siguiente) ? opcion.siguiente.map((d) => d.nodo) : [opcion.siguiente as string | null];
}

export interface DefinicionPerfil {
  readonly id: PerfilId;
  readonly nombre: string;
  readonly moralInicial: number;
  readonly dineroInicial: number;
  readonly ventaja: string;
  readonly desventaja: string;
  /** El contacto que solo tiene este perfil en la agenda. */
  readonly contactoUnico: string;
  /** Lo que le contestás a la cancha cuando pregunta cómo van a pagar: así se elige el perfil. */
  readonly respuesta: string;
  /** Lo que implica, en una línea, debajo de la respuesta. */
  readonly resumen: string;
  /** Contactos comunes que este perfil no tiene en la agenda. */
  readonly excluidos?: readonly string[];
  /** Cuánto más (o menos) probable es cada interrupción con este perfil, por id. */
  readonly probabilidadInterrupciones?: Readonly<Record<string, number>>;
}

/** La configuración de un viernes, ya con su modo (ver `configDeViernes`). */
export interface Config {
  readonly horaInicio: number;
  readonly horaCorte: number;
  /** Los titulares del formato más los suplentes, si es torneo. */
  readonly jugadoresNecesarios: number;
  readonly senaCancha: number;
  readonly costoVacante: number;
  readonly umbralBaja: number;
  readonly minutoRevision: number;
  /** El equipo ideal, por puesto: uno al arco y el resto repartido. */
  readonly composicion: Readonly<Record<Rol, number>>;
  /** Los que van además de los titulares, del puesto que sean. */
  readonly suplentes: number;
  /** Contra quién se juega, si se sabe: su nivel resta en la probabilidad de ganar. */
  readonly rival?: { readonly nombre: string; readonly nivel: number };
}

export interface MensajeRecibido {
  readonly texto: string;
  readonly minuto: number;
}

/** Estado mutable de un contacto durante un viernes. */
export interface EstadoDeContacto {
  readonly id: string;
  estado: EstadoContacto;
  probabilidadBaja: number;
  enojo: number;
  dineroAportado: number;
  nodoActual: string | null;
  /** Lo que le contestaste, por id, en orden. */
  elegidas: string[];
  /** Mensajes del NPC ya recibidos, en orden. */
  historial: MensajeRecibido[];
}

export interface Desglose {
  readonly concepto: string;
  readonly valor: number;
}

export type MotivoFin =
  | "corte_horario"
  | "moral_agotada"
  | "bancarrota";
