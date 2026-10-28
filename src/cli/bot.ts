/**
 * Bot de balanceo. Juega N viernes headless por perfil y por estilo de jugador
 * y reporta dónde se rompe el juego. Es la única forma realista de balancear un
 * juego de sistemas sin cientos de playtesters, y solo es posible porque el
 * núcleo no toca el DOM.
 *
 *   npm run bot -- 500
 *   npm run bot -- 500 --perfil pibe --estilo razonable,apurado
 *   npm run bot -- 500 --modo partido-f5,torneo-f8      (o --modo todos; sin --modo, el del slice)
 *   npm run bot -- 1 --narrar
 *
 * Qué rinde cada respuesta lo mide `npm run valor`.
 */
import { nuevaCampana } from "../core/campana.js";
import { MODO_POR_DEFECTO, nombreDelModo, TODOS_LOS_MODOS, type Modo } from "../core/modo.js";
import { Registro } from "../core/registro.js";
import { resolver } from "../core/resolucion.js";
import { opcionesDeViernes } from "../core/viernes.js";
import { cargarContenido } from "../datos/cargar.js";
import { elencoDe, perfilesJugables } from "../core/perfiles.js";
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
 * Lo que se busca en el vertical slice (GDD §9.8), con el Pibe en la primera
 * fecha del torneo de fútbol 5: el que presta atención juega el partido, el
 * apurado casi nunca, y el razonable depende de cómo juegue ese viernes. Se
 * mide con "se juega" y no con "lista llena": a cada perfil le cuesta otra
 * cosa, y al Pibe le cuesta pagar la seña, no juntar gente. Por eso el apurado
 * va más abajo que con el Oficinista (20–35%): confirma a todos con "la plata
 * después" y llega a la cancha sin con qué pagar.
 */
const OBJETIVOS: Readonly<Record<string, readonly [number, number]>> = {
  razonable: [55, 65],
  atento: [75, 85],
  apurado: [0, 15],
};
const PERFIL_DEL_SLICE = "pibe";

/**
 * La meta de los formatos grandes (paso 8 del slice): en F6 y F8 la diferencia
 * entre el atento y el razonable es igual o mayor que en F5, en la misma
 * competencia. Se mide con "se juega" y no con "lista llena": en F8 el razonable
 * llena pagando reemplazos y después no le alcanza la seña.
 */
const BIEN = "atento";
const MAS_O_MENOS = "razonable";

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

const perfiles = elegidos(perfilesJugables(contenido.perfiles, contenido.elencos), valor("--perfil"), "Perfil");
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
  return opcionesDeViernes(contenido, perfil, semilla, nuevaCampana(perfil, semilla, { modo, torneo: contenido.torneo }), { modo });
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
const seJuega = (ms: readonly Medicion[]): number => Math.round((ms.filter((m) => m.hayPartido).length / ms.length) * 100);
/** Cuánto le saca el que juega bien al que juega más o menos en cada modo del perfil del slice, en puntos de "se juega". */
const diferencias = new Map<string, number>();
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
        const juega = seJuega(mediciones);
        const ok = juega >= objetivo[0] && juega <= objetivo[1];
        return [`${nombre} ${objetivo[0]}–${objetivo[1]}% ${ok ? "✓" : "✗"}`];
      });
      if (marcas.length > 0) console.log(`\n  objetivo del slice, se juega: ${marcas.join(" · ")}`);
    }
    const bien = filas.find((f) => f.nombre === BIEN);
    const masOMenos = filas.find((f) => f.nombre === MAS_O_MENOS);
    if (perfil.id === PERFIL_DEL_SLICE && bien && masOMenos) {
      diferencias.set(clave(modo), seJuega(bien.mediciones) - seJuega(masOMenos.mediciones));
    }
    console.log("");
  }
}

// Solo se puede decir con el F5 de la competencia medido: es la vara.
const conSigno = (d: number): string => `${d >= 0 ? "+" : ""}${d}`;
const marcasGrandes = modos.flatMap((modo) => {
  const d = diferencias.get(clave(modo));
  const vara = diferencias.get(clave({ ...modo, formato: "f5" }));
  if (d === undefined || vara === undefined || modo.formato === "f5") return [];
  return [`${nombreDelModo(modo)} ${conSigno(d)} ${d >= vara ? "✓" : "✗"}`];
});
if (marcasGrandes.length > 0) {
  const varas = modos
    .filter((m) => m.formato === "f5" && diferencias.has(clave(m)))
    .map((m) => `${nombreDelModo(m)} ${conSigno(diferencias.get(clave(m))!)}`);
  console.log(`  formatos grandes, ${BIEN} − ${MAS_O_MENOS} en "se juega" (≥ que en F5): ${varas.join(" · ")} → ${marcasGrandes.join(" · ")}\n`);
}

// Un contacto que nadie usa nunca es contenido muerto: hay que arreglarlo o sacarlo.
const conteo = new Map<string, number>();
for (const p of perfiles) for (const c of elencoDe(contenido.elencos, p.id).contactos) conteo.set(c.id, 0);
for (const m of todas) for (const id of m.usados) conteo.set(id, (conteo.get(id) ?? 0) + 1);
const muertos = [...conteo].filter(([, n]) => n / todas.length < 0.05);

console.log(`  Contactos que casi nunca entran en juego:`);
if (muertos.length === 0) {
  console.log(`    ninguno — toda la agenda se usa`);
} else {
  for (const [id, n] of muertos) console.log(`    ${id.padEnd(24)} ${((n / todas.length) * 100).toFixed(1)}%`);
}
console.log("");
