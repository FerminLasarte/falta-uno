/**
 * Bot de balanceo. Juega N viernes headless y reporta dónde se rompe el juego.
 * Es la única forma realista de balancear un juego de sistemas sin cientos de
 * playtesters, y solo es posible porque el núcleo no toca el DOM.
 *
 *   npm run bot -- 2000
 */
import { Partida } from "../core/partida.js";
import { Rng } from "../core/rng.js";
import { resolver } from "../core/resolucion.js";
import { cargarContenido } from "../datos/cargar.js";
import type { DefinicionPerfil, PerfilId } from "../core/tipos.js";
import type { Contenido } from "../datos/cargar.js";

const CORRIDAS = Number(process.argv[2] ?? 500);
const NARRAR = process.argv.includes("--narrar");
const contenido = await cargarContenido();

interface Resultado {
  readonly perfil: PerfilId;
  readonly confirmados: number;
  readonly llegoADiez: boolean;
  readonly hayPartido: boolean;
  readonly gano: boolean;
  readonly probabilidad: number;
  readonly moralFinal: number;
  readonly minutosUsados: number;
  readonly motivoFin: string;
  readonly usados: readonly string[];
}

/**
 * Un jugador razonable, no óptimo: escribe a todos, prefiere confirmar, cuida
 * la moral cuando se le está acabando y para cuando ya tiene el plantel.
 */
function jugar(perfil: DefinicionPerfil, semilla: string, contenido: Contenido): Resultado {
  const partida = new Partida({
    perfil,
    agenda: contenido.contactos,
    interrupciones: contenido.interrupciones,
    config: contenido.config,
    semilla,
  });
  const usados: string[] = [];

  // El orden de la agenda se mezcla: si el bot siempre arranca por el mismo,
  // los últimos del archivo nunca se usan y la métrica de contenido muerto
  // mide el orden alfabético en vez de medir el diseño.
  const orden = new Rng(`${semilla}-orden`).mezclar(partida.contactos());

  for (const contacto of orden) {
    if (partida.terminada) break;
    if (partida.roster().confirmados >= contenido.config.jugadoresNecesarios) break;

    // Atender lo pendiente cuando el drenaje ya duele más que el reloj.
    for (const pendiente of [...partida.interrupcionesActivas]) {
      if (partida.moral < 45) partida.atender(pendiente.definicion.id);
    }

    partida.escribir(contacto.id);
    usados.push(contacto.id);

    for (let paso = 0; paso < 5 && !partida.terminada; paso++) {
      const opciones = partida.opcionesDisponibles(contacto.id);
      if (opciones.length === 0) break;

      const costoMoral = (o: (typeof opciones)[number]): number => -(o.efectos.moral ?? 0);
      const confirma = opciones
        .filter((o) => o.efectos.estado === "confirmado")
        .sort((a, b) => costoMoral(a) - costoMoral(b))[0];
      const avanza = opciones
        .filter((o) => o.siguiente !== null && o.efectos.estado === undefined)
        .filter((o) => partida.moral > 30 || costoMoral(o) <= 2)
        .sort((a, b) => costoMoral(a) - costoMoral(b))[0];

      const elegida = confirma ?? avanza;
      if (!elegida) break;
      partida.responder(contacto.id, elegida.id);
    }
  }

  // Con plata en el bolsillo y lugares abiertos, se tapan los agujeros.
  while (
    !partida.terminada &&
    partida.roster().confirmados < contenido.config.jugadoresNecesarios &&
    partida.dinero >= contenido.config.costoVacante + contenido.config.senaCancha
  ) {
    const hueco = partida.roster().faltantes[0];
    if (!partida.pagarVacante(hueco?.rol ?? "mediocampista").ok) break;
  }

  const r = resolver(partida);

  if (NARRAR) {
    console.log(`\n  ${perfil.nombre} · semilla ${semilla}`);
    if (!r.hayPartido) {
      console.log(`  ${r.motivoSinPartido}\n`);
    } else {
      for (const d of r.desglose) {
        const signo = d.valor >= 0 ? "+" : "−";
        console.log(`  ${d.concepto.padEnd(44)} ${signo}${String(Math.abs(d.valor)).padStart(3)}`);
      }
      console.log(`  ${"─".repeat(52)}`);
      console.log(`  ${"Probabilidad de victoria".padEnd(44)}  ${r.probabilidad}%\n`);
      for (const beat of r.narracion) {
        console.log(`  ${String(beat.minuto).padStart(2)}′ │ ${beat.texto}`);
      }
      console.log(`\n  ${r.gano ? "GANARON" : "PERDIERON"} ${r.golesFavor}-${r.golesContra}\n`);
    }
  }

  return {
    perfil: perfil.id,
    confirmados: partida.roster().confirmados,
    llegoADiez: partida.roster().confirmados >= contenido.config.jugadoresNecesarios,
    hayPartido: r.hayPartido,
    gano: r.gano,
    probabilidad: r.probabilidad,
    moralFinal: partida.moral,
    minutosUsados: partida.reloj.minutos - contenido.config.horaInicio,
    motivoFin: partida.motivoFin ?? "sin_terminar",
    usados,
  };
}

// ------------------------------------------------------------------ corrida

const resultados: Resultado[] = [];
for (let i = 0; i < CORRIDAS; i++) {
  for (const perfil of contenido.perfiles) {
    resultados.push(jugar(perfil, `bot-${i}`, contenido));
  }
}

const pct = (n: number, total: number): string => `${((n / total) * 100).toFixed(1)}%`;
const prom = (xs: number[]): number =>
  xs.length === 0 ? 0 : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

console.log(`\n  ${CORRIDAS} viernes por perfil · ${resultados.length} partidas\n`);
console.log(
  `  ${"perfil".padEnd(16)}${"llega a 10".padStart(11)}${"se juega".padStart(10)}` +
    `${"gana".padStart(8)}${"% vict.".padStart(9)}${"moral fin".padStart(11)}${"min usados".padStart(12)}`,
);
console.log(`  ${"─".repeat(77)}`);

for (const perfil of contenido.perfiles) {
  const suyos = resultados.filter((r) => r.perfil === perfil.id);
  const jugados = suyos.filter((r) => r.hayPartido);
  console.log(
    `  ${perfil.nombre.padEnd(16)}` +
      `${pct(suyos.filter((r) => r.llegoADiez).length, suyos.length).padStart(11)}` +
      `${pct(jugados.length, suyos.length).padStart(10)}` +
      `${pct(jugados.filter((r) => r.gano).length, Math.max(1, jugados.length)).padStart(8)}` +
      `${String(prom(jugados.map((r) => r.probabilidad))).padStart(9)}` +
      `${String(prom(suyos.map((r) => r.moralFinal))).padStart(11)}` +
      `${String(prom(suyos.map((r) => r.minutosUsados))).padStart(12)}`,
  );
}

console.log(`\n  Cómo termina el viernes:`);
const motivos = new Map<string, number>();
for (const r of resultados) motivos.set(r.motivoFin, (motivos.get(r.motivoFin) ?? 0) + 1);
for (const [motivo, veces] of [...motivos].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${motivo.padEnd(20)} ${pct(veces, resultados.length).padStart(7)}`);
}

// Un contacto que nadie usa nunca es contenido muerto: hay que arreglarlo o sacarlo.
const conteo = new Map<string, number>();
for (const c of contenido.contactos) conteo.set(c.id, 0);
for (const r of resultados) for (const id of r.usados) conteo.set(id, (conteo.get(id) ?? 0) + 1);
const muertos = [...conteo].filter(([, n]) => n / resultados.length < 0.05);

console.log(`\n  Contactos que casi nunca entran en juego:`);
if (muertos.length === 0) {
  console.log(`    ninguno — toda la agenda se usa`);
} else {
  for (const [id, n] of muertos) console.log(`    ${id.padEnd(24)} ${pct(n, resultados.length)}`);
}
console.log("");
