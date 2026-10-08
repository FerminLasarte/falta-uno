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
 *   npm run bot -- 2000 --perfil oficinista --decisiones
 */
import { MODO_POR_DEFECTO, nombreDelModo, TODOS_LOS_MODOS, type Modo } from "../core/modo.js";
import { Registro } from "../core/registro.js";
import { resolver } from "../core/resolucion.js";
import { opcionesDeViernes } from "../core/viernes.js";
import { cargarContenido } from "../datos/cargar.js";
import type { DefinicionPerfil } from "../core/tipos.js";
import { ESTILOS, ESTILOS_DE_JUGADOR, jugarViernes, type Estilo } from "./estilos.js";
import { imprimirTabla, medir, type Medicion } from "./medicion.js";

const argumentos = process.argv.slice(2);
const valor = (nombre: string): string | undefined => {
  const i = argumentos.indexOf(nombre);
  return i === -1 ? undefined : argumentos[i + 1];
};
const CORRIDAS = Number(argumentos.find((a) => /^\d+$/.test(a)) ?? 500);
const NARRAR = argumentos.includes("--narrar");
const DECISIONES = argumentos.includes("--decisiones");

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
const estilos = DECISIONES
  ? [ESTILOS.find((e) => e.id === "explorador")!]
  : elegidos(ESTILOS, valor("--estilo"), "Estilo").filter((e) => valor("--estilo") || ESTILOS_DE_JUGADOR.includes(e));

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

/**
 * Decisiones falsas: con el explorador contestando al azar, cuánto termina
 * jugando cada contacto según la respuesta que se le dio. Una respuesta que
 * convence más y no cuesta más moral, reloj ni plata que las otras no es una
 * decisión: es la respuesta correcta.
 */
function informarDecisiones(mediciones: readonly Medicion[]): void {
  interface Conteo {
    texto: string;
    moral: number;
    reloj: number;
    /** La plata que entra (o sale, si es negativa) con esta respuesta. */
    plata: number;
    veces: number;
    juega: number;
  }
  const nodos = new Map<string, Map<string, Conteo>>();
  for (const m of mediciones) {
    for (const d of m.decisiones) {
      const clave = `${d.contacto} · ${d.nodo}`;
      const delNodo = nodos.get(clave) ?? new Map<string, Conteo>();
      nodos.set(clave, delNodo);
      const opcion = d.disponibles.find((o) => o.id === d.opcion);
      if (!opcion) continue;
      const c = delNodo.get(d.opcion) ?? {
        texto: opcion.texto,
        moral: opcion.efectos.moral ?? 0,
        reloj: opcion.costoReloj,
        plata: (opcion.efectos.dinero ?? 0) + (opcion.efectos.dineroAportado ?? 0),
        veces: 0,
        juega: 0,
      };
      c.veces++;
      if (m.finales[d.contacto] === "confirmado") c.juega++;
      delNodo.set(d.opcion, c);
    }
  }

  const MUESTRA = 30;
  const MARGEN = 5;
  let revisados = 0;
  const falsas: string[] = [];
  const conCostoAfuera: string[] = [];
  const afuera = costosEnOtros();
  for (const [nodo, opciones] of [...nodos].sort()) {
    const medibles = [...opciones].filter(([, c]) => c.veces >= MUESTRA);
    if (medibles.length < 2) continue;
    revisados++;
    const tasa = (c: Conteo): number => (c.juega / c.veces) * 100;
    const orden = medibles.sort((a, b) => tasa(b[1]) - tasa(a[1]));
    const [id, mejor] = orden[0]!;
    const resto = orden.slice(1).map(([, c]) => c);
    const convenceMas = resto.every((c) => tasa(mejor) >= tasa(c) + MARGEN);
    const noCuestaMas = resto.every((c) => mejor.moral >= c.moral && mejor.reloj <= c.reloj && mejor.plata >= c.plata);
    if (!convenceMas || !noCuestaMas) continue;
    const otras = resto.map((c) => `${tasa(c).toFixed(0)}%`).join(", ");
    const renglon = `    ${nodo.padEnd(34)} ${id.padEnd(16)} juega ${tasa(mejor).toFixed(0)}% contra ${otras}  «${mejor.texto}»`;
    // Lo que cuesta en otro de la agenda no lo ve esta medición: se lista aparte.
    const contacto = nodo.split(" · ")[0]!;
    const quien = afuera.get(`${contacto}.${id}`);
    if (quien) conCostoAfuera.push(`${renglon}  → ${quien}`);
    else falsas.push(renglon);
  }
  console.log(`\n  Decisiones falsas: ${falsas.length} de ${revisados} nodos con más de una respuesta medible`);
  console.log(`  (la respuesta convence ${MARGEN} puntos más que todas las otras y no cuesta más moral, reloj ni plata)\n`);
  for (const f of falsas) console.log(f);
  if (conCostoAfuera.length > 0) {
    console.log(`\n  Con costo en otro contacto, que esta medición no ve (revisarlas a mano):\n`);
    for (const f of conCostoAfuera) console.log(f);
  }
  console.log("");
}

/** Respuestas que le cuestan algo a otro: las que mueven a otro (`otros`) o lo hacen bajarse (`elegidoA`). Por "contacto.opcion". */
function costosEnOtros(): Map<string, string> {
  const costos = new Map<string, string>();
  const anotar = (clave: string, quien: string): void => {
    const previo = costos.get(clave);
    costos.set(clave, previo ? `${previo}, ${quien}` : quien);
  };
  for (const c of contenido.contactos) {
    for (const nodo of Object.values(c.nodos)) {
      for (const o of nodo.opciones) for (const otro of o.efectos.otros ?? []) anotar(`${c.id}.${o.id}`, otro.contacto);
    }
    for (const baja of c.bajas ?? []) {
      const e = baja.si?.elegidoA;
      if (e) anotar(`${e.contacto}.${e.opcion}`, `${c.id} se baja`);
    }
  }
  return costos;
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
    if (perfil.id === PERFIL_DEL_SLICE && clave(modo) === clave(MODO_POR_DEFECTO) && !DECISIONES) {
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

if (DECISIONES) informarDecisiones(todas);

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
