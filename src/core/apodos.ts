/**
 * Los apodos del grupo de amigos de quien juega. Cada personaje sigue siendo el
 * mismo (Fede se hace rogar, Carlos cobra la deuda), pero con el nombre de un
 * amigo de verdad. Los textos nombran a los demás con marcas que acá se
 * completan:
 *
 *   {el_tano}      el nombre de ese contacto, en minúscula como se escribe en un chat
 *   {voc:el_tano}  lo mismo sin artículo, para hablarle: "tano, es un picado"
 *   {vos}          cómo te dicen a vos
 *   {grupo}        el nombre del grupo
 *
 * "a el" y "de el" quedan como "al" y "del": "vi a {el_tano}" es "vi al tano".
 * Las marcas {a} y {b} de las peleas no se tocan: las completa la partida.
 */
import type { DefinicionGrupo, MensajeGrupo } from "./grupo.js";
import type { DefinicionInterrupcion } from "./interrupciones.js";
import type { Modo } from "./modo.js";
import type { Baja, DefinicionContacto, NodoDialogo } from "./tipos.js";

export interface Apodos {
  /** Por id de contacto. Los que falten se quedan con el nombre del personaje. */
  readonly contactos?: Readonly<Record<string, string>>;
  readonly vos?: string;
  readonly grupo?: string;
}

export const APODO_POR_DEFECTO = "capi";

/** Las marcas que entiende `completar`, además de los ids de contacto. */
export const MARCAS_FIJAS = ["vos", "grupo"] as const;
const MARCA = /\{(voc:)?([a-z0-9_]+)\}/g;

export function nombreDelGrupo(apodos: Apodos | undefined, modo: Modo): string {
  return apodos?.grupo?.trim() || `Los Pibes ${modo.formato.toUpperCase()}`;
}

/** Saca el artículo de adelante: "El Tano" → "Tano". Para hablarle a alguien. */
function sinArticulo(nombre: string): string {
  return nombre.replace(/^(el|la)\s+/i, "");
}

interface Nombres {
  readonly contactos: ReadonlyMap<string, string>;
  readonly vos: string;
  readonly grupo: string;
}

/** Completa las marcas de un texto. `enMinuscula` es para lo que se escribe en un chat. */
export function completar(texto: string, nombres: Nombres, enMinuscula = true): string {
  const como = (s: string): string => (enMinuscula ? s.toLowerCase() : s);
  const completo = texto.replace(MARCA, (marca, voc: string | undefined, id: string) => {
    if (id === "vos") return como(nombres.vos);
    if (id === "grupo") return como(nombres.grupo);
    const nombre = nombres.contactos.get(id);
    if (nombre === undefined) return marca;
    return como(voc ? sinArticulo(nombre) : nombre);
  });
  return completo.replace(/\b([aA]) [eE]l /g, "$1l ").replace(/\b([dD]e) [eE]l /g, "$1l ");
}

/** El viernes con los nombres de quien juega: la agenda, el grupo y las interrupciones. */
export function personalizar(
  partes: {
    readonly agenda: readonly DefinicionContacto[];
    readonly grupo: DefinicionGrupo;
    readonly interrupciones: readonly DefinicionInterrupcion[];
  },
  apodos: Apodos | undefined,
  modo: Modo,
): { agenda: DefinicionContacto[]; grupo: DefinicionGrupo; interrupciones: DefinicionInterrupcion[] } {
  const nombres: Nombres = {
    contactos: new Map(partes.agenda.map((c) => [c.id, apodos?.contactos?.[c.id]?.trim() || c.nombre])),
    vos: apodos?.vos?.trim() || APODO_POR_DEFECTO,
    grupo: nombreDelGrupo(apodos, modo),
  };
  const t = (texto: string): string => completar(texto, nombres);
  const nodo = (n: NodoDialogo): NodoDialogo => ({
    mensajes: n.mensajes.map(t),
    opciones: n.opciones.map((o) => ({
      ...o,
      texto: t(o.texto),
      ...(o.efectos.trae
        ? { efectos: { ...o.efectos, trae: o.efectos.trae.map((i) => ({ ...i, nombre: completar(i.nombre, nombres, false) })) } }
        : {}),
    })),
  });
  const baja = (b: Baja): Baja => ({ ...b, texto: t(b.texto) });
  const mensaje = (m: MensajeGrupo): MensajeGrupo => ({
    ...m,
    ...(m.texto !== undefined ? { texto: t(m.texto) } : {}),
    ...(m.audio ? { audio: { ...m.audio, transcripcion: t(m.audio.transcripcion) } } : {}),
  });

  return {
    agenda: partes.agenda.map((c) => ({
      ...c,
      nombre: nombres.contactos.get(c.id) ?? c.nombre,
      nodos: Object.fromEntries(Object.entries(c.nodos).map(([id, n]) => [id, nodo(n)])),
      ...(c.bajas ? { bajas: c.bajas.map(baja) } : {}),
    })),
    grupo: {
      ...partes.grupo,
      charlas: partes.grupo.charlas.map((ch) => ({ ...ch, mensajes: ch.mensajes.map(mensaje) })),
      roces: partes.grupo.roces.map((r) => ({
        ...r,
        mensajes: r.mensajes.map(mensaje),
        ...(r.calmar !== undefined ? { calmar: t(r.calmar) } : {}),
      })),
      calmar: { ...partes.grupo.calmar, mensaje: t(partes.grupo.calmar.mensaje), respuestas: partes.grupo.calmar.respuestas.map(mensaje) },
      cerrar: {
        ...partes.grupo.cerrar,
        mensaje: t(partes.grupo.cerrar.mensaje),
        sinDiez: t(partes.grupo.cerrar.sinDiez),
      },
    },
    interrupciones: partes.interrupciones.map((i) => ({
      ...i,
      de: completar(i.de, nombres, false),
      texto: t(i.texto),
      ...(i.insistencias ? { insistencias: i.insistencias.map((x) => ({ ...x, texto: t(x.texto) })) } : {}),
    })),
  };
}

/** Todas las marcas de un texto, por id: para que el validador revise que existan. */
export function marcasDe(texto: string): string[] {
  return [...texto.matchAll(MARCA)].map((m) => m[2]!);
}
