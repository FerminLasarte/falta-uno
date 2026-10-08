/**
 * Analiza viernes jugados por personas. Lee los archivos que deja el juego en
 * `partidas/` (y también un guardado, `saves/partida.json`, para reproducir el
 * bug de alguien), los juega de nuevo contra el núcleo y saca el mismo informe
 * que el bot, más la línea de tiempo de cada viernes: qué hizo, qué estaba
 * mirando y cuánto tiempo real tardó.
 *
 *   npm run analizar -- carpeta-con-partidas
 *   npm run analizar -- partidas/123-fecha-1.json --linea
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { leerArchivado, esMarca, type Build, type MarcaVista } from "../core/archivo.js";
import { huella, leerGuardado, type ViernesGuardado } from "../core/registro.js";
import { formatearHora } from "../core/tiempo.js";
import { opcionesDeViernes, type Ajustes } from "../core/viernes.js";
import { cargarContenido, type Contenido } from "../datos/cargar.js";
import type { PerfilId } from "../core/tipos.js";
import { imprimirTabla, medir, type Medicion, type Momento } from "./medicion.js";

/** Un viernes leído de disco, venga del archivo o del guardado. */
interface Leido {
  readonly archivo: string;
  readonly perfil: PerfilId;
  readonly semilla: string;
  readonly ajustes: Ajustes;
  readonly viernes: ViernesGuardado;
  readonly marcas: readonly MarcaVista[];
  readonly build: Build | null;
}

async function listar(ruta: string): Promise<string[]> {
  const info = await stat(ruta);
  if (!info.isDirectory()) return [ruta];
  const dentro = await readdir(ruta, { withFileTypes: true });
  const anidados = await Promise.all(
    dentro.map((d) => (d.isDirectory() ? listar(join(ruta, d.name)) : Promise.resolve(d.name.endsWith(".json") ? [join(ruta, d.name)] : []))),
  );
  return anidados.flat().sort();
}

/** El guardado viaja envuelto en una copia con sello (electron/guardado.ts): se desenvuelve acá. */
function desdeGuardado(texto: string, archivo: string): Leido | null {
  let datos = texto;
  try {
    const copia = JSON.parse(texto) as Record<string, unknown>;
    if (typeof copia["datos"] === "string") datos = copia["datos"];
  } catch {
    return null;
  }
  const guardado = leerGuardado(datos);
  if (!guardado) return null;
  const vista = guardado.vista as Record<string, unknown> | undefined;
  const marcas = Array.isArray(vista?.["marcas"]) ? (vista["marcas"] as unknown[]).filter(esMarca) : [];
  return {
    archivo,
    perfil: guardado.campana.perfil,
    semilla: guardado.campana.semilla,
    ajustes: guardado.campana,
    viernes: guardado.viernes,
    marcas,
    build: null,
  };
}

async function leer(archivo: string): Promise<Leido | null> {
  const texto = await readFile(archivo, "utf8");
  const archivado = leerArchivado(texto);
  if (archivado) {
    return {
      archivo,
      perfil: archivado.campana.perfil,
      semilla: archivado.campana.semilla,
      ajustes: archivado.campana,
      viernes: archivado.viernes,
      marcas: archivado.marcas,
      build: archivado.build,
    };
  }
  return desdeGuardado(texto, archivo);
}

/** "contacto:carlos_el_quejoso" → "el chat con Carlos". */
function nombrarPantalla(pantalla: string, contenido: Contenido): string {
  const [tipo, id] = pantalla.split(":");
  switch (tipo) {
    case "grupo":
      return "el grupo";
    case "chats":
      return "la bandeja";
    case "partido":
      return "la cancha";
    case "contacto":
      return `el chat con ${contenido.contactos.find((c) => c.id === id)?.nombre ?? id}`;
    case "interrupcion":
      return `el chat con ${contenido.interrupciones.find((i) => i.id === id)?.de ?? id}`;
    default:
      return pantalla;
  }
}

function reloj(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function imprimirLinea(leido: Leido, medicion: Medicion, contenido: Contenido): void {
  // Una marca con `paso` = n pasó antes del paso de índice n: a igual ms, va primero.
  const marcas: Momento[] = leido.marcas.map((m) => ({
    ms: m.ms,
    orden: m.paso - 0.5,
    hora: "",
    texto: `mira ${nombrarPantalla(m.pantalla, contenido)}`,
    tuyo: false,
  }));
  const todo = [...medicion.linea, ...marcas].sort((a, b) => a.ms - b.ms || a.orden - b.orden);
  let hora = formatearHora(contenido.config.horaInicio);
  for (const m of todo) {
    if (m.hora) hora = m.hora;
    const marca = m.tuyo ? "▸" : m.hora ? " " : "·";
    console.log(`    ${reloj(m.ms).padStart(6)}  ${hora}  ${marca} ${m.texto}`);
  }
  console.log("");
}

function resumen(m: Medicion): string {
  if (!m.terminada) return [`${m.usados.length} contactos escritos`, `moral ${m.moralFinal}`, `${reloj(m.ms)} reales`].join(" · ");
  const lleno = m.minutoLleno === null ? "no llenó la lista" : `llenó la lista a las ${formatearHora(m.minutoLleno)}`;
  const partido = m.hayPartido ? (m.gano ? "ganó" : "perdió") : `sin partido (${m.causa})`;
  const extras = [m.bajas > 0 ? `${m.bajas} baja(s)` : "", m.teDijeronQueNo > 0 ? `${m.teDijeronQueNo} no` : ""].filter(Boolean);
  return [lleno, partido, ...extras, `moral ${m.moralFinal}`, `${reloj(m.ms)} reales`].join(" · ");
}

// ------------------------------------------------------------------ corrida

const argumentos = process.argv.slice(2);
const rutas = argumentos.filter((a) => !a.startsWith("--"));
if (rutas.length === 0) {
  console.error("\n  Uso: npm run analizar -- <carpeta o archivo>... [--linea]\n");
  process.exit(1);
}

const contenido = await cargarContenido();
const huellaActual = huella(JSON.stringify(contenido));
const archivos = (await Promise.all(rutas.map(listar))).flat();
// Un mismo viernes puede estar en el archivo y en el guardado: cuenta una vez, y
// gana el archivo, que sabe con qué build se jugó.
const porViernes = new Map<string, Leido>();
for (const archivo of archivos) {
  const leido = await leer(archivo).catch(() => null);
  if (!leido) {
    console.log(`  ⚠ ${archivo}: no es un viernes archivado ni un guardado`);
    continue;
  }
  const clave = `${leido.semilla}·${leido.viernes.fecha}`;
  const previo = porViernes.get(clave);
  if (!previo || (previo.build === null && leido.build !== null)) porViernes.set(clave, leido);
}
const leidos = [...porViernes.values()];
const conLinea = argumentos.includes("--linea") || leidos.length === 1;

console.log(`\n  ${leidos.length} viernes · contenido actual ${huellaActual}\n`);

const medidos = leidos.flatMap((leido) => {
  const perfil = contenido.perfiles.find((p) => p.id === leido.perfil);
  if (!perfil) {
    console.log(`  ⚠ ${leido.archivo}: el perfil "${leido.perfil}" ya no existe`);
    return [];
  }
  const opciones = opcionesDeViernes(contenido, perfil, leido.semilla, leido.viernes, leido.ajustes);
  return [{ leido, medicion: medir(opciones, leido.viernes.pasos, conLinea) }];
});

for (const perfil of contenido.perfiles) {
  const suyos = medidos.filter((x) => x.leido.perfil === perfil.id && x.medicion.terminada).map((x) => x.medicion);
  if (suyos.length === 0) continue;
  console.log(`  ${perfil.nombre}`);
  imprimirTabla([{ nombre: "personas", mediciones: suyos }]);
  console.log("");
}

console.log("  Viernes por viernes\n");
for (const { leido, medicion } of medidos) {
  const build = leido.build ? `${leido.build.version} ${leido.build.commit} ${leido.build.plataforma}` : "guardado";
  const estado = medicion.terminada ? "" : " · a medias, no entra en la tabla";
  console.log(`  ${basename(leido.archivo)} · ${build} · fecha ${leido.viernes.fecha}${estado}`);
  console.log(`    ${resumen(medicion)}`);
  if (leido.viernes.contenido !== huellaActual) {
    console.log(`    ⚠ se jugó con otro contenido (${leido.viernes.contenido}); se reprodujeron ${medicion.aplicados} de ${medicion.pasos} pasos`);
  } else if (medicion.aplicados < medicion.pasos) {
    console.log(`    ⚠ se reprodujeron ${medicion.aplicados} de ${medicion.pasos} pasos`);
  }
  if (conLinea) {
    console.log("");
    imprimirLinea(leido, medicion, contenido);
  }
}
console.log("");
