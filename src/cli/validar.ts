import { cargarContenido, ErrorDeContenido } from "../datos/cargar.js";
import { configDeViernes, nombreDelModo, TODOS_LOS_MODOS } from "../core/modo.js";
import { ROLES } from "../core/tipos.js";
import type { Rol } from "../core/tipos.js";

const contenido = await cargarContenido().catch((error: unknown) => {
  if (error instanceof ErrorDeContenido) {
    console.error(`\n✗ ${error.message}\n`);
    process.exit(1);
  }
  throw error;
});

console.log(`\n✓ Contenido válido\n`);

// Cada perfil tiene su elenco, y cada modo pide otra cantidad: el margen es por perfil y por modo.
const margen: string[] = [];
for (const perfil of contenido.perfiles) {
  const elenco = contenido.elencos[perfil.id];
  if (!elenco) {
    console.log(`  ${perfil.nombre}: todavía sin elenco, no se puede elegir\n`);
    continue;
  }
  const porRol = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Rol, number>;
  let nodos = 0;
  let opciones = 0;
  let palabras = 0;
  for (const contacto of elenco.contactos) {
    porRol[contacto.rol]++;
    for (const nodo of Object.values(contacto.nodos)) {
      nodos++;
      opciones += nodo.opciones.length;
      for (const mensaje of nodo.mensajes) palabras += mensaje.split(/\s+/).length;
      for (const opcion of nodo.opciones) palabras += opcion.texto.split(/\s+/).length;
    }
  }
  const { grupo } = elenco;
  const mensajesGrupo = [...grupo.charlas, ...grupo.roces].flatMap((c) => c.mensajes);
  console.log(`  ${perfil.nombre}`);
  console.log(`    Contactos       ${elenco.contactos.length} (${ROLES.map((r) => `${porRol[r]} ${r}`).join(", ")})`);
  console.log(`    Nodos           ${nodos}`);
  console.log(`    Opciones        ${opciones}`);
  console.log(`    Palabras        ~${palabras}`);
  console.log(`    Interrupciones  ${elenco.interrupciones.length}`);
  console.log(`    Grupo           ${grupo.charlas.length} charlas, ${mensajesGrupo.filter((m) => m.audio).length} audios, ${grupo.roces.length} roces\n`);

  const margenes = TODOS_LOS_MODOS.map((m) => {
    const necesarios = configDeViernes(contenido.config, m).jugadoresNecesarios;
    return `${elenco.contactos.length - necesarios} de ${necesarios}`.padStart(12);
  });
  margen.push(`    ${perfil.nombre.padEnd(18)} ${String(elenco.contactos.length).padStart(6)}${margenes.join("")}`);
}

console.log(`  Margen: cuántos te pueden fallar`);
console.log(`    ${"".padEnd(18)} ${"agenda".padStart(6)}${TODOS_LOS_MODOS.map((m) => nombreDelModo(m).padStart(12)).join("")}`);
for (const renglon of margen) console.log(renglon);
console.log("");
