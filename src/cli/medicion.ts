/**
 * Medir un viernes. Lo usan el bot y el analizador de partidas de personas, así
 * los dos reportan lo mismo con la misma vara: se reproduce el registro paso a
 * paso contra el núcleo y se anota qué pasó y por qué no hubo partido.
 */
import { CHAT_GRUPO, Partida, type EventoFeed, type OpcionesPartida } from "../core/partida.js";
import { Registro, type Paso } from "../core/registro.js";
import { resolver } from "../core/resolucion.js";
import { formatearHora } from "../core/tiempo.js";
import type { EstadoContacto, OpcionDialogo, PerfilId } from "../core/tipos.js";

/**
 * Por qué no hubo partido, en orden de precedencia:
 *   · moral: te quedaste sin moral;
 *   · plata: la lista estaba llena y no alcanzó la seña;
 *   · bajas: sin las bajas de las 20:30 la lista estaba llena;
 *   · agenda: no quedaba nadie a quien escribirle ni nadie con quien seguir hablando;
 *   · reloj: quedaba gente y no hubo tiempo.
 */
export const CAUSAS = ["reloj", "agenda", "bajas", "plata", "moral"] as const;
export type Causa = (typeof CAUSAS)[number];

/** Una respuesta elegida y las que había para elegir en ese momento. */
export interface Decision {
  readonly contacto: string;
  readonly nodo: string;
  readonly opcion: string;
  readonly disponibles: readonly OpcionDialogo[];
}

/** Un renglón de la línea de tiempo: algo que hiciste o algo que pasó. */
export interface Momento {
  readonly ms: number;
  /** Orden entre momentos con los mismos ms: el índice del paso. */
  readonly orden: number;
  readonly hora: string;
  readonly texto: string;
  readonly tuyo: boolean;
}

export interface Medicion {
  readonly perfil: PerfilId;
  /** Llegó a las 21:00 o se quedó sin moral. Un viernes a medias no se cuenta en el informe. */
  readonly terminada: boolean;
  readonly listaLlena: boolean;
  readonly hayPartido: boolean;
  readonly gano: boolean;
  readonly probabilidad: number;
  readonly moralFinal: number;
  /** Minutos de reloj hasta la última acción que no fue dejar correr el reloj (esperar o cerrar la lista). */
  readonly minutosUsados: number;
  /** El minuto del día en que la lista se llenó por primera vez. */
  readonly minutoLleno: number | null;
  readonly bajas: number;
  /** Te dijo que no: en ese momento no había respuesta que lo siguiera convenciendo. */
  readonly teDijeronQueNo: number;
  /** Lo dejaste vos, cuando todavía se lo podía convencer. */
  readonly losDejaste: number;
  readonly audiosEscuchados: number;
  readonly interrupcionesAtendidas: number;
  readonly calmadas: number;
  readonly causa: Causa | null;
  readonly usados: readonly string[];
  readonly decisiones: readonly Decision[];
  /** Cómo terminó cada contacto de la agenda. */
  readonly finales: Readonly<Record<string, EstadoContacto>>;
  /** Cuántos pasos se pudieron reproducir. Menos que `pasos` si el contenido cambió. */
  readonly aplicados: number;
  readonly pasos: number;
  /** Tiempo real jugado, en ms. */
  readonly ms: number;
  readonly linea: readonly Momento[];
}

/** Lo que se dice de un evento en la línea de tiempo. Lo que no importa para entender la partida, nada. */
function contarEvento(e: EventoFeed): string | null {
  const recortado = e.texto.length > 70 ? `${e.texto.slice(0, 69)}…` : e.texto;
  if (e.clase === "alerta" && e.de === "Sistema") return e.texto;
  if (e.clase === "alerta") return `${e.de}: «${recortado}»`;
  if (e.audio) return `Audio de ${e.de} (${e.audio.segundos} s)`;
  if (e.clase === "sistema" && /confirmó|revisión/.test(e.texto)) return e.texto;
  // Lo que te escribe cada uno, sí: con eso se ve cuánto tardaste en contestar. La charla del grupo es ruido.
  if (e.clase === "mensaje" && e.chat !== CHAT_GRUPO) return `${e.de}: «${recortado}»`;
  return null;
}

/** Lo que hiciste, dicho para leerlo después. */
function contarPaso(partida: Partida, paso: Paso, opcion: OpcionDialogo | undefined): string {
  const nombre = (id: string): string => partida.definicion(id).nombre;
  switch (paso[0]) {
    case "t":
      return "";
    case "escribir":
      return `Le escribís a ${nombre(paso[1])}`;
    case "responder":
      return `A ${nombre(paso[1])}: «${opcion?.texto ?? paso[2]}»`;
    case "llamar":
      return `Lo llamás a ${nombre(paso[1])}`;
    case "pagar":
      return `Pagás un ${paso[1]}`;
    case "atender":
      return `Atendés ${paso[1]}`;
    case "escuchar":
      return `Escuchás el audio ${paso[1]}`;
    case "calmar":
      return "Calmás al grupo";
    case "esperar":
      return `Esperás ${paso[1]} min`;
    case "cerrar":
      return "Cerrás la lista";
  }
}

/**
 * Si al rechazarlo todavía había una respuesta que lo seguía convenciendo, lo
 * dejaste vos; si no, te dijo que no.
 */
function loDejaste(disponibles: readonly OpcionDialogo[]): boolean {
  return disponibles.some(
    (o) => o.efectos.estado === "confirmado" || (o.siguiente !== null && o.efectos.estado !== "rechazado"),
  );
}

export function medir(opciones: OpcionesPartida, pasos: readonly Paso[], conLinea = false): Medicion {
  const registro = new Registro(new Partida(opciones));
  const partida = registro.partida;
  const { horaInicio, jugadoresNecesarios } = opciones.config;

  let minutosUsados = 0;
  let minutoLleno: number | null = null;
  let aplicados = 0;
  let teDijeronQueNo = 0;
  let losDejaste = 0;
  let audiosEscuchados = 0;
  let interrupcionesAtendidas = 0;
  let calmadas = 0;
  const usados: string[] = [];
  const decisiones: Decision[] = [];
  const linea: Momento[] = [];

  for (const paso of pasos) {
    let decision: Decision | undefined;
    try {
      if (paso[0] === "responder") {
        const disponibles = partida.opcionesDisponibles(paso[1]);
        const nodo = partida.estadoDe(paso[1]).nodoActual ?? "";
        decision = { contacto: paso[1], nodo, opcion: paso[2], disponibles };
      }
      const anotarLlegadas = (nuevos: readonly EventoFeed[]): void => {
        for (const e of nuevos) {
          const dicho = contarEvento(e);
          if (dicho) linea.push({ ms: registro.ms, orden: aplicados, hora: formatearHora(e.minuto), texto: dicho, tuyo: false });
        }
      };

      if (conLinea && paso[0] === "t") {
        // El tiempo real seguido se anota como un solo paso. Para fechar cada
        // llegada en su ms se lo juega de a tramos, de llegada en llegada: da la
        // misma partida, porque varios `transcurrir` seguidos equivalen a uno con la suma.
        let falta = paso[1];
        while (falta > 0) {
          const proxima = partida.msHastaProximaEntrega();
          const tramo = proxima === null || proxima >= falta ? falta : Math.max(1, proxima);
          const resultado = registro.hacer(["t", tramo]);
          if (!resultado.ok) break;
          anotarLlegadas(resultado.nuevos);
          falta -= tramo;
        }
      } else {
        const resultado = registro.hacer(paso);
        if (!resultado.ok) break;
        if (conLinea) {
          const hora = formatearHora(partida.reloj.minutos);
          const opcion = decision?.disponibles.find((o) => o.id === paso[2]);
          const texto = contarPaso(partida, paso, opcion);
          if (texto) linea.push({ ms: registro.ms, orden: aplicados, hora, texto, tuyo: true });
          anotarLlegadas(resultado.nuevos);
        }
      }
    } catch {
      // Un paso que nombra algo que ya no existe en el contenido. Se mide hasta
      // el último que anduvo, armando la partida de nuevo para no medir una a medio cambiar.
      return medir(opciones, pasos.slice(0, aplicados), conLinea);
    }
    aplicados++;

    if (paso[0] !== "t" && paso[0] !== "esperar" && paso[0] !== "cerrar") minutosUsados = partida.reloj.minutos - horaInicio;
    if (paso[0] === "escribir") usados.push(paso[1]);
    if (paso[0] === "escuchar") audiosEscuchados++;
    if (paso[0] === "atender") interrupcionesAtendidas++;
    if (paso[0] === "calmar") calmadas++;
    if (decision) {
      decisiones.push(decision);
      if (partida.estadoDe(decision.contacto).estado === "rechazado") {
        if (loDejaste(decision.disponibles)) losDejaste++;
        else teDijeronQueNo++;
      }
    }
    if (minutoLleno === null && partida.roster().confirmados >= jugadoresNecesarios) {
      minutoLleno = partida.reloj.minutos;
    }
  }

  // El que te dijo que no y quedó esperando tu "[Bueno]": también te dijo que no.
  for (const c of partida.contactos()) {
    if (c.estado !== "hablando" && c.estado !== "esperando") continue;
    // Terminado el viernes ya no se ofrece nada: se mira el nodo donde quedó.
    const nodo = partida.estadoDe(c.id).nodoActual;
    const opciones = nodo === null ? [] : (partida.definicion(c.id).nodos[nodo]?.opciones ?? []);
    if (opciones.length > 0 && opciones.every((o) => o.efectos.estado === "rechazado")) teDijeronQueNo++;
  }

  const resolucion = resolver(partida);
  const confirmados = partida.roster().confirmados;
  // Las bajas de la revisión: los de la agenda y los invitados que no vinieron.
  const bajas = partida.bitacora.contar("baja_tardia") + partida.bitacora.contar("no_vino");
  const contactos = partida.contactos();
  const finales = Object.fromEntries(contactos.map((c) => [c.id, c.estado]));

  let causa: Causa | null = null;
  if (!resolucion.hayPartido) {
    const quedaGente = contactos.some(
      (c) => c.estado === "sin_contactar" || c.estado === "esperando" || c.estado === "hablando",
    );
    if (partida.motivoFin === "moral_agotada") causa = "moral";
    else if (confirmados >= jugadoresNecesarios) causa = "plata";
    else if (bajas > 0 && confirmados + bajas >= jugadoresNecesarios) causa = "bajas";
    else if (!quedaGente) causa = "agenda";
    else causa = "reloj";
  }

  return {
    perfil: opciones.perfil.id,
    terminada: partida.terminada,
    listaLlena: confirmados >= jugadoresNecesarios,
    hayPartido: resolucion.hayPartido,
    gano: resolucion.gano,
    probabilidad: resolucion.probabilidad,
    moralFinal: partida.moral,
    minutosUsados,
    minutoLleno,
    bajas,
    teDijeronQueNo,
    losDejaste,
    audiosEscuchados,
    interrupcionesAtendidas,
    calmadas,
    causa,
    usados,
    decisiones,
    finales,
    aplicados,
    pasos: pasos.length,
    ms: registro.ms,
    linea,
  };
}

// ------------------------------------------------------------------ el informe

const pct = (n: number, total: number): string => (total === 0 ? "—" : `${((n / total) * 100).toFixed(0)}%`);
const prom = (xs: readonly number[]): string =>
  xs.length === 0 ? "—" : (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);

export function mediana(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const orden = [...xs].sort((a, b) => a - b);
  return orden[Math.floor((orden.length - 1) / 2)] ?? null;
}

/** Una fila del informe: un grupo de viernes medidos con su nombre. */
export interface Fila {
  readonly nombre: string;
  readonly mediciones: readonly Medicion[];
}

const COLUMNAS: readonly [string, number][] = [
  ["lista llena", 12],
  ["se juega", 9],
  ["gana", 7],
  ["moral", 7],
  ["min", 6],
  ["se llena", 10],
  ["bajas", 7],
  ["no", 6],
  ["dejó", 6],
];

/**
 * La tabla del informe. "gana" es sobre los que tuvieron partido; "se llena" es
 * la mediana del minuto de reloj en que la lista llegó a diez; "bajas", "no" y
 * "dejó" son por viernes. Las causas son sobre los viernes sin partido.
 */
export function imprimirTabla(filas: readonly Fila[]): void {
  const ancho = Math.max(18, ...filas.map((f) => f.nombre.length + 2));
  const cabecera = COLUMNAS.map(([t, w]) => t.padStart(w)).join("");
  console.log(`  ${"".padEnd(ancho)}${cabecera}   sin partido, por qué`);
  console.log(`  ${"─".repeat(ancho + cabecera.length + 24)}`);
  for (const { nombre, mediciones: ms } of filas) {
    const n = ms.length;
    const jugados = ms.filter((m) => m.hayPartido);
    const llenos = ms.flatMap((m) => (m.minutoLleno === null ? [] : [m.minutoLleno]));
    const lleno = mediana(llenos);
    const sinPartido = ms.filter((m) => m.causa !== null);
    const causas = CAUSAS.map((c) => [c, sinPartido.filter((m) => m.causa === c).length] as const)
      .filter(([, k]) => k > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([c, k]) => `${c} ${pct(k, sinPartido.length)}`)
      .join(" · ");
    const celdas = [
      pct(ms.filter((m) => m.listaLlena).length, n),
      pct(jugados.length, n),
      pct(jugados.filter((m) => m.gano).length, jugados.length),
      prom(ms.map((m) => m.moralFinal)),
      prom(ms.map((m) => m.minutosUsados)),
      lleno === null ? "—" : formatearHora(lleno),
      prom(ms.map((m) => m.bajas)),
      prom(ms.map((m) => m.teDijeronQueNo)),
      prom(ms.map((m) => m.losDejaste)),
    ];
    const fila = celdas.map((c, i) => c.padStart(COLUMNAS[i]![1])).join("");
    console.log(`  ${nombre.padEnd(ancho)}${fila}   ${causas || "—"}`);
  }
}
