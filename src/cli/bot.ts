/**
 * Bot de balanceo. Juega N viernes headless por perfil y por estilo de jugador
 * y reporta dónde se rompe el juego. Es la única forma realista de balancear un
 * juego de sistemas sin cientos de playtesters, y solo es posible porque el
 * núcleo no toca el DOM.
 *
 *   npm run bot -- 500
 *   npm run bot -- 500 --perfil oficinista --estilo razonable,apurado
 *   npm run bot -- 500 --modo partido-f5,torneo-f8      (o --modo todos; sin --modo, el del slice)
 *   npm run bot -- 1 --narrar
 *
 * Qué rinde cada respuesta lo mide `npm run valor`.
 */
import { MODO_POR_DEFECTO, nombreDelModo, TODOS_LOS_MODOS, type Modo } from "../core/modo.js";
import { Registro } from "../core/registro.js";
import { resolver } from "../core/resolucion.js";
import { opcionesDeViernes } from "../core/viernes.js";
import { cargarContenido } from "../datos/cargar.js";
import type { DefinicionPerfil } from "../core/tipos.js";
import { ESTILOS, jugarViernes, type Estilo } from "./estilos.js";
import { imprimirTabla, medir, type Medicion } from "./medicion.js";

const argumentos = process.argv.slice(2);
const valor = (nombre: string): string | undefined => {
  const i = argumentos.indexOf(nombre);
  return i === -1 ? undefined : argumentos[i + 1];
};
const CORRIDAS = Number(argumentos.find((a) => /^\d+$/.test(a)) ?? 500);
const NARRAR = argumentos.includes("--narrar");

/**
 * Lo que se busca en el vertical slice (GDD §9.8), para el Oficinista en la
 * primera fecha del torneo de fútbol 5: el que presta atención llena la lista,
 * el apurado casi nunca, y el razonable depende de cómo juegue ese viernes.
 */
const OBJETIVOS: Readonly<Record<string, readonly [number, number]>> = {
  razonable: [55, 65],
  atento: [75, 85],
  apurado: [20, 35],
};
const PERFIL_DEL_SLICE = "oficinista";

const contenido = await cargarContenido();

function elegidos<T extends { id: string }>(todos: readonly T[], filtro: string | undefined, que: string): T[] {
  if (!filtro) return [...todos];
  const ids = filtro.split(",");
  const encontrados = todos.filter((x) => ids.includes(x.id));
  if (encontrados.length !== ids.length) {
    console.error(`\n  ${que} desconocido en "${filtro}". Hay: ${todos.map((x) => x.id).join(", ")}\n`);
    process.exit(1);
  }
  return encontrados;
}

const perfiles = elegidos(contenido.perfiles, valor("--perfil"), "Perfil");
const clave = (m: Modo): string => `${m.competencia}-${m.formato}`;
const modos: Modo[] =
  valor("--modo") === "todos"
    ? [...TODOS_LOS_MODOS]
    : elegidos(TODOS_LOS_MODOS.map((m) => ({ ...m, id: clave(m) })), valor("--modo"), "Modo").filter(
        (m) => valor("--modo") || m.id === clave(MODO_POR_DEFECTO),
      );
const estilos = elegidos(ESTILOS, valor("--estilo"), "Estilo");

/** El primer viernes de una campaña con esa semilla, como lo arma el juego. */
function opcionesPara(perfil: DefinicionPerfil, semilla: string, modo: Modo = MODO_POR_DEFECTO) {
  return opcionesDeViernes(contenido, perfil, semilla, { fecha: 1, dinero: perfil.dineroInicial }, { modo });
}

function correr(perfil: DefinicionPerfil, estilo: Estilo, modo: Modo): Medicion[] {
  const mediciones: Medicion[] = [];
  for (let i = 0; i < CORRIDAS; i++) {
    const semilla = `bot-${i}`;
    const opciones = opcionesPara(perfil, semilla, modo);
    mediciones.push(medir(opciones, jugarViernes(opciones, estilo, semilla)));
  }
  return mediciones;
}

function narrar(perfil: DefinicionPerfil, estilo: Estilo, modo: Modo): void {
  const semilla = "bot-0";
  const opciones = opcionesPara(perfil, semilla, modo);
  const { registro } = Registro.reproducir(opciones, jugarViernes(opciones, estilo, semilla));
  const r = resolver(registro.partida);
  console.log(`\n  ${perfil.nombre} · ${nombreDelModo(modo)} · ${estilo.id} · semilla ${semilla}`);
  if (!r.hayPartido) {
    console.log(`  ${r.motivoSinPartido}`);
    for (const m of r.porQueNo) console.log(`    ${m.hora ?? "     "}  ${m.texto}${m.porque ? `  ↳ ${m.porque}` : ""}`);
    console.log("");
    return;
  }
  for (const d of r.desglose) {
    const signo = d.valor >= 0 ? "+" : "−";
    console.log(`  ${d.concepto.padEnd(44)} ${signo}${String(Math.abs(d.valor)).padStart(3)}`);
  }
  console.log(`  ${"─".repeat(52)}`);
  console.log(`  ${"Probabilidad de victoria".padEnd(44)}  ${r.probabilidad}%\n`);
  for (const beat of r.narracion) {
    console.log(`  ${String(beat.minuto).padStart(2)}′ │ ${beat.texto}`);
    if (beat.porque) console.log(`      │ ↳ ${beat.porque}`);
  }
  console.log(`\n  ${r.gano ? "GANARON" : "PERDIERON"} ${r.golesFavor}-${r.golesContra}\n`);
}

// ------------------------------------------------------------------ corrida

console.log(`\n  ${CORRIDAS} viernes por perfil, modo y estilo · primera fecha\n`);

if (NARRAR) {
  for (const perfil of perfiles) for (const modo of modos) for (const estilo of estilos) narrar(perfil, estilo, modo);
  process.exit(0);
}

const todas: Medicion[] = [];
for (const perfil of perfiles) {
  for (const modo of modos) {
    const necesarios = opcionesPara(perfil, "x", modo).config.jugadoresNecesarios;
    console.log(`  ${perfil.nombre} · ${nombreDelModo(modo)} · van ${necesarios}`);
    const filas = estilos.map((estilo) => ({ nombre: estilo.id, mediciones: correr(perfil, estilo, modo) }));
    imprimirTabla(filas);
    for (const f of filas) todas.push(...f.mediciones);
    if (perfil.id === PERFIL_DEL_SLICE && clave(modo) === clave(MODO_POR_DEFECTO)) {
      const marcas = filas.flatMap(({ nombre, mediciones }) => {
        const objetivo = OBJETIVOS[nombre];
        if (!objetivo) return [];
        const llena = Math.round((mediciones.filter((m) => m.listaLlena).length / mediciones.length) * 100);
        const ok = llena >= objetivo[0] && llena <= objetivo[1];
        return [`${nombre} ${objetivo[0]}–${objetivo[1]}% ${ok ? "✓" : "✗"}`];
      });
      if (marcas.length > 0) console.log(`\n  objetivo del slice, lista llena: ${marcas.join(" · ")}`);
    }
    console.log("");
  }
}

// Un contacto que nadie usa nunca es contenido muerto: hay que arreglarlo o sacarlo.
const conteo = new Map<string, number>();
for (const c of contenido.contactos) conteo.set(c.id, 0);
for (const m of todas) for (const id of m.usados) conteo.set(id, (conteo.get(id) ?? 0) + 1);
const agendas = new Set(perfiles.flatMap((p) => opcionesPara(p, "x").agenda.map((c) => c.id)));
const muertos = [...conteo].filter(([id, n]) => agendas.has(id) && n / todas.length < 0.05);

console.log(`  Contactos que casi nunca entran en juego:`);
if (muertos.length === 0) {
  console.log(`    ninguno — toda la agenda se usa`);
} else {
  for (const [id, n] of muertos) console.log(`    ${id.padEnd(24)} ${((n / todas.length) * 100).toFixed(1)}%`);
}
console.log("");
