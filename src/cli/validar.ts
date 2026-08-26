import { cargarContenido, ErrorDeContenido } from "../datos/cargar.js";
import { ROLES } from "../core/tipos.js";
import type { Rol } from "../core/tipos.js";

const contenido = await cargarContenido().catch((error: unknown) => {
  if (error instanceof ErrorDeContenido) {
    console.error(`\n✗ ${error.message}\n`);
    process.exit(1);
  }
  throw error;
});

const porRol = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Rol, number>;
let nodos = 0;
let opciones = 0;
let palabras = 0;

for (const contacto of contenido.contactos) {
  porRol[contacto.rol]++;
  for (const nodo of Object.values(contacto.nodos)) {
    nodos++;
    opciones += nodo.opciones.length;
    for (const mensaje of nodo.mensajes) palabras += mensaje.split(/\s+/).length;
    for (const opcion of nodo.opciones) palabras += opcion.texto.split(/\s+/).length;
  }
}

console.log(`\n✓ Contenido válido\n`);
console.log(`  Contactos       ${contenido.contactos.length}`);
console.log(`  Nodos           ${nodos}`);
console.log(`  Opciones        ${opciones}`);
console.log(`  Palabras        ~${palabras}`);
console.log(`  Perfiles        ${contenido.perfiles.length}`);
console.log(`  Interrupciones  ${contenido.interrupciones.length}`);
console.log(`\n  Por rol:`);
for (const rol of ROLES) console.log(`    ${rol.padEnd(15)} ${porRol[rol]}`);

const disponibles = contenido.contactos.length;
const necesarios = contenido.config.jugadoresNecesarios;
console.log(
  `\n  Margen: ${disponibles} contactos para ${necesarios} lugares (pueden fallarte ${disponibles - necesarios}).\n`,
);
