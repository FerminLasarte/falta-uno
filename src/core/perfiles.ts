/**
 * Cada perfil tiene su propio mundo: sus amigos, su grupo, quién más le
 * escribe un viernes y cómo habla. No comparten a nadie: un tipo de oficina no
 * se pelea por lo mismo que los pibes del barrio. Lo único común es el sistema
 * (puestos, rasgos, roces, el reloj) y la charla con la cancha, que es donde se
 * elige el perfil. Un perfil sin elenco todavía no se puede jugar.
 */
import type { Frases } from "./frases.js";
import type { DefinicionGrupo } from "./grupo.js";
import type { DefinicionInterrupcion } from "./interrupciones.js";
import type { DefinicionContacto, DefinicionPerfil, PerfilId } from "./tipos.js";

export interface Elenco {
  /** La agenda: todos sus contactos. */
  readonly contactos: readonly DefinicionContacto[];
  readonly grupo: DefinicionGrupo;
  readonly interrupciones: readonly DefinicionInterrupcion[];
  readonly frases: Frases;
}

export type Elencos = Readonly<Partial<Record<PerfilId, Elenco>>>;

export function jugable(elencos: Elencos, perfil: PerfilId): boolean {
  return elencos[perfil] !== undefined;
}

/** Los perfiles que ya se pueden elegir, en el orden de siempre. */
export function perfilesJugables(perfiles: readonly DefinicionPerfil[], elencos: Elencos): DefinicionPerfil[] {
  return perfiles.filter((p) => jugable(elencos, p.id));
}

export function elencoDe(elencos: Elencos, perfil: PerfilId): Elenco {
  const elenco = elencos[perfil];
  if (!elenco) throw new Error(`el perfil "${perfil}" todavía no tiene elenco`);
  return elenco;
}
