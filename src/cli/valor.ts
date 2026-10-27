/**
 * El valor esperado de cada respuesta. El bot juega un viernes; en cada
 * respuesta que dio vuelve atrás, contesta otra cosa y sigue jugando igual desde
 * ahí, con la misma semilla. Así cada respuesta se compara con las otras en la
 * misma situación, y no en promedios de situaciones distintas.
 *
 *   npm run valor                          (300 viernes, razonable, el modo del slice)
 *   npm run valor -- 1000 --estilo atento
 *   npm run valor -- 300 --plata           (además, el detalle de las charlas que mueven plata)
 *   npm run valor -- 300 --todo            (el detalle de todas las charlas)
 *   npm run valor -- 300 --colchon 3000    (con otra plata guardada en la campaña: para probar la economía)
 *
 * Las respuestas de una charla se comparan de a pares, en las mismas
 * situaciones: A le gana a B si llevó a más (partido, y después ganarlo). Con eso:
 *   · conviene siempre: nunca pierde contra ninguna y a alguna le gana. No es una decisión;
 *   · no conviene nunca: hay otra que nunca le pierde y a veces le gana. Las que
 *     dicen que no quedan afuera: perder a alguien es su costo, y está bien que lo tengan;
 *   · da lo mismo: ninguna le gana a la otra. Elegir entre ellas es color, no juego.
 * Después de la respuesta distinta el azar se separa (quién interrumpe, si atajás
 * un aviso), así que hay ruido parejo para los dos lados: "nunca" es casi nunca.
 */
import { MODO_POR_DEFECTO } from "../core/modo.js";
import { opcionesDeViernes } from "../core/viernes.js";
import { cargarContenido } from "../datos/cargar.js";
import type { OpcionDialogo } from "../core/tipos.js";
import { ESTILOS, jugarViernes } from "./estilos.js";
import { medir, type Medicion } from "./medicion.js";

const argumentos = process.argv.slice(2);
const valor = (nombre: string): string | undefined => {
  const i = argumentos.indexOf(nombre);
  return i === -1 ? undefined : argumentos[i + 1];
};
const CORRIDAS = Number(argumentos.find((a) => /^\d+$/.test(a)) ?? 300);
const PLATA = argumentos.includes("--plata");
const TODO = argumentos.includes("--todo");
const PERFIL = valor("--perfil") ?? "oficinista";
const ESTILO = valor("--estilo") ?? "razonable";
const COLCHON = valor("--colchon");

/** Situaciones mínimas para opinar de una respuesta. */
const MUESTRA = 20;
/** Por debajo de esto, "nunca": una situación rara no cambia el veredicto. */
const CASI_NUNCA = 2;
/** Por encima de esto, "a veces" ya es una diferencia que se juega. */
const A_VECES = 5;

const contenido = await cargarContenido();
const perfil = contenido.perfiles.find((p) => p.id === PERFIL);
const estilo = ESTILOS.find((e) => e.id === ESTILO);
if (!perfil || !estilo) {
  console.error(`\n  Perfil o estilo desconocido. Perfiles: ${contenido.perfiles.map((p) => p.id).join(", ")}. Estilos: ${ESTILOS.map((e) => e.id).join(", ")}\n`);
  process.exit(1);
}

/** Cuánto vale cómo terminó el viernes: sin partido 0, partido 1, partido ganado 2. */
const puntaje = (m: Medicion): number => (m.hayPartido ? 1 : 0) + (m.gano ? 1 : 0);
const plataDe = (o: OpcionDialogo): number => (o.efectos.dinero ?? 0) + (o.efectos.dineroAportado ?? 0);
const diceQueNo = (o: OpcionDialogo): boolean => o.efectos.estado === "rechazado";

interface Conteo {
  readonly opcion: OpcionDialogo;
  veces: number;
  partido: number;
  gana: number;
  /** Contra cada otra respuesta de la charla: en cuántas situaciones estuvieron las dos y cuántas le ganó y le perdió. */
  readonly contra: Map<string, { juntas: number; leGano: number; lePerdio: number }>;
}

/** Por charla ("contacto · nodo"), lo que pasó con cada respuesta. */
const nodos = new Map<string, Map<string, Conteo>>();

for (let i = 0; i < CORRIDAS; i++) {
  const semilla = `bot-${i}`;
  const dinero = COLCHON === undefined ? perfil.dineroInicial : Number(COLCHON);
  const opciones = opcionesDeViernes(contenido, perfil, semilla, { fecha: 1, dinero }, { modo: MODO_POR_DEFECTO });
  const base = medir(opciones, jugarViernes(opciones, estilo, semilla));
  base.decisiones.forEach((d, k) => {
    if (d.disponibles.length < 2) return;
    // La misma situación con cada respuesta: la que eligió el estilo y las demás.
    const resultados = d.disponibles.map((o) => ({
      opcion: o,
      m: o.id === d.opcion ? base : medir(opciones, jugarViernes(opciones, estilo, semilla, { decision: k, opcion: o.id })),
    }));
    const clave = `${d.contacto} · ${d.nodo}`;
    const delNodo = nodos.get(clave) ?? new Map<string, Conteo>();
    nodos.set(clave, delNodo);
    for (const { opcion, m } of resultados) {
      const c = delNodo.get(opcion.id) ?? { opcion, veces: 0, partido: 0, gana: 0, contra: new Map() };
      c.veces++;
      if (m.hayPartido) c.partido++;
      if (m.gano) c.gana++;
      for (const otra of resultados) {
        if (otra.opcion.id === opcion.id) continue;
        const par = c.contra.get(otra.opcion.id) ?? { juntas: 0, leGano: 0, lePerdio: 0 };
        par.juntas++;
        if (puntaje(m) > puntaje(otra.m)) par.leGano++;
        if (puntaje(m) < puntaje(otra.m)) par.lePerdio++;
        c.contra.set(otra.opcion.id, par);
      }
      delNodo.set(opcion.id, c);
    }
  });
}

const pct = (n: number, de: number): number => Math.round((n / de) * 100);

function costos(o: OpcionDialogo): string {
  const partes: string[] = [`${o.costoReloj} min`];
  const { moral, probabilidadBaja } = o.efectos;
  const plata = plataDe(o);
  if (moral) partes.push(`moral ${moral > 0 ? "+" : ""}${moral}`);
  if (plata) partes.push(`${plata > 0 ? "+" : "−"}$${Math.abs(plata)}`);
  if (probabilidadBaja) partes.push(`calentura ${probabilidadBaja > 0 ? "+" : ""}${probabilidadBaja}`);
  if (o.efectos.trae?.length) partes.push(`trae ${o.efectos.trae.length}`);
  return partes.join(" · ");
}

const recortar = (texto: string): string => (texto.length > 44 ? `${texto.slice(0, 43)}…` : texto);

function renglon(nodo: string, c: Conteo, nota = ""): string {
  return (
    `    ${nodo.padEnd(32)} ${c.opcion.id.padEnd(16)} ${String(c.veces).padStart(4)} veces · ` +
    `partido ${String(pct(c.partido, c.veces)).padStart(3)}% · gana ${String(pct(c.gana, c.veces)).padStart(3)}%  ` +
    `[${costos(c.opcion)}]  «${recortar(c.opcion.texto)}»${nota}`
  );
}

/** Cómo le va a `a` contra `b`: le gana, le pierde, da lo mismo, o depende de la situación. Null sin muestra. */
function duelo(a: Conteo, b: Conteo): "gana" | "pierde" | "igual" | "depende" | null {
  const par = a.contra.get(b.opcion.id);
  if (!par || par.juntas < MUESTRA) return null;
  const gano = pct(par.leGano, par.juntas);
  const perdio = pct(par.lePerdio, par.juntas);
  if (gano <= CASI_NUNCA && perdio <= CASI_NUNCA) return "igual";
  if (perdio <= CASI_NUNCA && gano >= A_VECES) return "gana";
  if (gano <= CASI_NUNCA && perdio >= A_VECES) return "pierde";
  return "depende";
}

const siempre: string[] = [];
const nunca: string[] = [];
const iguales: string[] = [];
let medibles = 0;
for (const [nodo, conteos] of [...nodos].sort()) {
  const conMuestra = [...conteos.values()].filter((c) => c.veces >= MUESTRA);
  if (conMuestra.length < 2) continue;
  medibles++;
  for (const c of conMuestra) {
    const otras = conMuestra.filter((o) => o !== c);
    const duelos = otras.map((o) => ({ o, d: duelo(c, o) })).filter((x) => x.d !== null);
    if (duelos.length === 0) continue;
    if (duelos.every((x) => x.d === "gana" || x.d === "igual") && duelos.some((x) => x.d === "gana")) {
      siempre.push(renglon(nodo, c));
    } else if (!diceQueNo(c.opcion)) {
      const leGanan = duelos.filter((x) => x.d === "pierde").map((x) => x.o.opcion.id);
      if (leGanan.length > 0) nunca.push(renglon(nodo, c, `  → mejor ${leGanan.join(" o ")}`));
    }
    for (const { o, d } of duelos) {
      if (d === "igual" && c.opcion.id < o.opcion.id) iguales.push(`    ${nodo.padEnd(32)} ${c.opcion.id} = ${o.opcion.id}  «${recortar(c.opcion.texto)}» / «${recortar(o.opcion.texto)}»`);
    }
  }
}

const conColchon = COLCHON === undefined ? "" : ` · colchón $${COLCHON}`;
console.log(`\n  Valor esperado de cada respuesta · ${perfil.nombre} · ${estilo.id}${conColchon} · ${CORRIDAS} viernes · ${medibles} charlas con más de una respuesta medible`);
console.log(`  (comparadas de a pares en las mismas situaciones; "nunca" es menos del ${CASI_NUNCA}%, "a veces" más del ${A_VECES}%)\n`);
console.log(`  Convienen siempre (no son decisiones): ${siempre.length}`);
for (const r of siempre) console.log(r);
console.log(`\n  No convienen nunca (sin contar las que dicen que no): ${nunca.length}`);
for (const r of nunca) console.log(r);
console.log(`\n  Da lo mismo cuál (color, no juego): ${iguales.length}`);
for (const r of iguales) console.log(r);

if (PLATA || TODO) {
  console.log(`\n  Detalle${TODO ? "" : " de las charlas que mueven plata"}:`);
  for (const [nodo, conteos] of [...nodos].sort()) {
    const lista = [...conteos.values()];
    if (!TODO && !lista.some((c) => plataDe(c.opcion) !== 0)) continue;
    console.log("");
    for (const c of lista.sort((a, b) => b.veces - a.veces)) console.log(renglon(nodo, c));
  }
}
console.log("");
