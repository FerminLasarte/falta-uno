/**
 * Lo que cambia según quién arma el partido. Cada perfil tiene en la agenda a
 * todos los contactos comunes más el suyo; los contactos únicos de los otros
 * perfiles no existen para él.
 */
import type { DefinicionContacto, DefinicionPerfil } from "./tipos.js";

export function agendaDe(
  perfil: DefinicionPerfil,
  perfiles: readonly DefinicionPerfil[],
  contactos: readonly DefinicionContacto[],
): DefinicionContacto[] {
  const ajenos = new Set(perfiles.filter((p) => p.id !== perfil.id).map((p) => p.contactoUnico));
  ajenos.delete(perfil.contactoUnico);
  return contactos.filter((c) => !ajenos.has(c.id));
}
