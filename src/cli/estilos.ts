/**
 * Cómo juega el bot. Un solo bot mide un solo jugador; con varios estilos se ve
 * si la dificultad separa al que presta atención del que juega apurado, que es
 * lo que tiene que pasar para que el viernes sea difícil y no arbitrario.
 *
 * El bot juega a través del registro, como la ventana: lo que devuelve son los
 * pasos, y se mide igual que la partida de una persona.
 */
import type { InterrupcionActiva } from "../core/interrupciones.js";
import { Partida, type OpcionesPartida, type VistaContacto } from "../core/partida.js";
import { Registro, type Paso } from "../core/registro.js";
import { Rng } from "../core/rng.js";
import type { OpcionDialogo } from "../core/tipos.js";

/** Lo que el estilo sabe de la partida que va a jugar. */
export interface Contexto {
  readonly opciones: OpcionesPartida;
  readonly rng: Rng;
  /** El chat de la cancha: ignorarla puede costar la cancha. */
  readonly cancha: string | null;
  /** Respuestas que pueden volverse en contra: alguien se baja por haberlas elegido ("contacto.opcion"). */
  readonly riesgosas: ReadonlySet<string>;
}

export interface Estilo {
  readonly id: string;
  readonly descripcion: string;
  /** A quién le escribe ahora, de los que todavía no le escribió. */
  siguiente(pendientes: readonly VistaContacto[], partida: Partida, ctx: Contexto): VistaContacto | undefined;
  /** Qué contesta. Sin respuesta, deja la charla ahí. */
  elegir(opciones: readonly OpcionDialogo[], partida: Partida, ctx: Contexto): OpcionDialogo | undefined;
  calma(partida: Partida, ctx: Contexto): boolean;
  escucha(audioId: string, partida: Partida, ctx: Contexto): boolean;
  atiende(interrupcion: InterrupcionActiva, partida: Partida, ctx: Contexto): boolean;
  /** Si llama al que avisó que no sabe si llega. Se decide una vez por aviso. */
  ataja(id: string, partida: Partida, ctx: Contexto): boolean;
  /** Sin nadie más a quien escribirle, si paga un reemplazo. Solo se pregunta cuando se puede pagar. */
  paga(partida: Partida): boolean;
  /** Antes de cerrar la lista atiende lo pendiente: después ya no tiene otra cosa que hacer. */
  readonly atiendeAntesDeCerrar: boolean;
}

const costoMoral = (o: OpcionDialogo): number => -(o.efectos.moral ?? 0);
const suba = (o: OpcionDialogo): number => o.efectos.probabilidadBaja ?? 0;
const confirma = (o: OpcionDialogo): boolean => o.efectos.estado === "confirmado";
/** Cuántos más entran a la lista con esta respuesta: los que trae. Más es mejor cuando falta gente. */
const traeMenos = (o: OpcionDialogo): number => -(o.efectos.trae?.length ?? 0);
const avanza = (o: OpcionDialogo): boolean => o.siguiente !== null && o.efectos.estado === undefined;
/** Si después de pagar un reemplazo la seña sigue cubierta, contando lo guardado. */
const alcanzaDespuesDePagar = (partida: Partida): boolean =>
  partida.dinero - partida.config.costoVacante + Math.max(0, partida.colchon) >= partida.config.senaCancha;
const porMenor =
  <T>(...criterios: ((x: T) => number)[]) =>
  (a: T, b: T): number => {
    for (const c of criterios) {
      const d = c(a) - c(b);
      if (d !== 0) return d;
    }
    return 0;
  };

/** Escribe a todos, prefiere confirmar, cuida la moral cuando se le está acabando. No escucha audios. */
const razonable: Estilo = {
  id: "razonable",
  descripcion: "escribe a todos, confirma con la que menos moral cuesta, calma roces, no escucha audios, ataja la mitad de los avisos",
  siguiente: (pendientes) => pendientes[0],
  elegir(opciones, partida) {
    return (
      opciones.filter(confirma).sort(porMenor(traeMenos, costoMoral))[0] ??
      opciones
        .filter(avanza)
        .filter((o) => partida.moral > 30 || costoMoral(o) <= 2)
        .sort(porMenor(costoMoral))[0]
    );
  },
  calma: () => true,
  escucha: () => false,
  atiende: (_i, partida) => partida.moral < 45,
  // Lee los avisos a veces: el que avisa en medio de otra charla se le pasa.
  ataja: (_id, _p, ctx) => ctx.rng.ocurre(50),
  // Ve el botón y lo toca: no hace la cuenta de la seña.
  paga: () => true,
  atiendeAntesDeCerrar: true,
};

/**
 * Juega como el razonable, más lo que da prestar atención: escucha los audios y
 * usa lo que dijeron, no deja esperando a la cancha, casi siempre ataja al que
 * avisa y mira la plata: si no llega a la seña, cobra por adelantado y no regala.
 * Juega como una persona atenta, no como quien leyó el contenido: no sabe qué
 * audio importa hasta escucharlo, y una mentira que la lista va a descubrir la ve
 * según lo obvio que es que el otro va a estar: más cuanto más gente hace falta.
 *
 * No elige a quién escribirle primero: escribir antes a los puestos que faltan, o
 * al mejor de cada uno, no rinde en ningún formato, y en F8 lo hace abrir siempre
 * con los mismos, justo cuando la mentira sobre otro todavía se puede decir.
 */
const atento: Estilo = {
  id: "atento",
  descripcion: "como el razonable, más: escucha los audios, atiende la cancha, ve las mentiras según cuánta gente hace falta, ataja casi todos los avisos y cuida la plata",
  siguiente: (pendientes) => pendientes[0],
  elegir(opciones, partida, ctx) {
    // No dice lo que ve que se va a descubrir. Sin la seña asegurada, la plata pesa más
    // que la tranquilidad; con la seña, no gasta lo que lo dejaría corto de nuevo.
    // La seña la completa el colchón: lo que cuenta es el bolsillo más lo guardado.
    const sena = partida.config.senaCancha;
    const alcance = partida.dinero + Math.max(0, partida.colchon);
    const plata = (o: OpcionDialogo): number => (o.efectos.dinero ?? 0) + (o.efectos.dineroAportado ?? 0);
    const quedaCorto = (o: OpcionDialogo): number => (alcance + plata(o) < sena ? 1 : 0);
    // Si hacen falta casi todos, "fulano no va" se descubre seguro, y se nota.
    const obvia = (100 * partida.config.jugadoresNecesarios) / ctx.opciones.agenda.length;
    const ve = new Set(opciones.filter((o) => ctx.riesgosas.has(o.id) && ctx.rng.ocurre(obvia)).map((o) => o.id));
    const riesgo = (o: OpcionDialogo): number => (ve.has(o.id) ? 1 : 0);
    // Lo que solo puede contestar porque escuchó el audio: para eso lo escuchó.
    const escucho = (o: OpcionDialogo): number => (o.requiere?.escuchado ? 0 : 1);
    const criterio =
      alcance < sena
        ? porMenor(riesgo, escucho, (o) => -plata(o), traeMenos, costoMoral, suba)
        : porMenor(riesgo, escucho, quedaCorto, traeMenos, costoMoral, suba);
    return (
      opciones.filter(confirma).sort(criterio)[0] ??
      opciones
        .filter(avanza)
        .filter((o) => partida.moral > 30 || costoMoral(o) <= 2)
        .sort(criterio)[0]
    );
  },
  calma: () => true,
  escucha: () => true,
  atiende: (i, partida, ctx) => i.definicion.id === ctx.cancha || partida.moral < 45,
  // Uno de cada cinco avisos le llega en medio de otra charla y se le pasa.
  ataja: (_id, _p, ctx) => ctx.rng.ocurre(80),
  paga: alcanzaDespuesDePagar,
  atiendeAntesDeCerrar: true,
};

/** Quiere la lista ya: confirma lo más rápido, apura cuando puede, no atiende a nadie ni escucha nada. */
const apurado: Estilo = {
  id: "apurado",
  descripcion: "confirma lo más rápido, apura, no calma, no escucha, no atiende",
  siguiente: (pendientes) => pendientes[0],
  elegir(opciones) {
    const apura = (o: OpcionDialogo): number => (o.efectos.registrar === "apuro" ? 0 : 1);
    return (
      opciones.filter(confirma).sort(porMenor(traeMenos, (o) => o.costoReloj))[0] ??
      opciones.filter(avanza).sort(porMenor(apura, (o) => o.costoReloj))[0]
    );
  },
  calma: () => false,
  escucha: () => false,
  atiende: () => false,
  ataja: () => false,
  paga: () => true,
  atiendeAntesDeCerrar: false,
};

export const ESTILOS: readonly Estilo[] = [razonable, atento, apurado];

/**
 * Las respuestas por las que alguien se baja a las 20:30: las mentiras que la
 * lista descubre. Por id de opción: dentro de una charla no se repiten.
 */
function riesgosas(opciones: OpcionesPartida): Set<string> {
  const ids = new Set<string>();
  for (const c of opciones.agenda) {
    for (const baja of c.bajas ?? []) {
      if (baja.si?.elegiste) ids.add(baja.si.elegiste);
      if (baja.si?.elegidoA) ids.add(baja.si.elegidoA.opcion);
    }
  }
  return ids;
}

function cancha(opciones: OpcionesPartida): string | null {
  const chat = opciones.inscripcion?.chat;
  return chat && opciones.interrupciones.some((i) => i.id === chat) ? chat : null;
}

/**
 * Una respuesta forzada: en la decisión número `decision` (desde 0, en el orden
 * en que el bot contesta) se elige `opcion` en vez de lo que diría el estilo.
 * Todo lo anterior se juega igual, así que mide qué habría pasado con otra respuesta.
 */
export interface Desvio {
  readonly decision: number;
  readonly opcion: string;
}

/** Charlas por contacto antes de pasar al siguiente: los árboles no son más largos que esto. */
const MAX_RESPUESTAS = 8;

/**
 * Juega un viernes con un estilo y devuelve lo que hizo. Con la lista llena la
 * cierra: si a las 20:30 alguien se baja, el reloj se frena ahí y repone con lo
 * que quede de la agenda. Sin nada más para hacer, cierra igual, que es como
 * termina el viernes en la ventana.
 */
export function jugarViernes(opciones: OpcionesPartida, estilo: Estilo, semilla: string, desvio?: Desvio): readonly Paso[] {
  const registro = new Registro(new Partida(opciones));
  const partida = registro.partida;
  const { config } = opciones;
  const ctx: Contexto = {
    opciones,
    rng: new Rng(`${semilla}-${estilo.id}`),
    cancha: cancha(opciones),
    riesgosas: riesgosas(opciones),
  };
  const hacer = (paso: Paso): boolean => registro.hacer(paso).ok;
  // El bot no lee: deja llegar todo antes de decidir. Para él el tiempo real no existe.
  const alDia = (): void => {
    for (let ms = partida.msHastaProximaEntrega(); ms !== null && !partida.terminada; ms = partida.msHastaProximaEntrega()) {
      if (!hacer(["t", ms])) return;
    }
  };
  const lleno = (): boolean => partida.roster().confirmados >= config.jugadoresNecesarios;
  /** Cuántas respuestas dio: cuenta las decisiones para el desvío. */
  let decisiones = 0;
  /** Cuántos avisos ya leyó, los haya atajado o no. Uno puede avisar dos veces. */
  let leidos = 0;
  const atenderTodo = (): void => {
    if (partida.terminada) return;
    for (const id of partida.avisaron.slice(leidos)) {
      if (partida.terminada) break;
      leidos++;
      if (partida.estadoDe(id).estado === "confirmado" && estilo.ataja(id, partida, ctx) && hacer(["llamar", id])) alDia();
    }
    if (partida.accionCalmar && estilo.calma(partida, ctx) && hacer(["calmar"])) alDia();
    for (const audio of partida.audiosSinEscuchar()) {
      if (!partida.terminada && estilo.escucha(audio.id, partida, ctx) && hacer(["escuchar", audio.id])) alDia();
    }
    for (const pendiente of [...partida.interrupcionesActivas]) {
      if (!partida.terminada && estilo.atiende(pendiente, partida, ctx) && hacer(["atender", pendiente.definicion.id])) alDia();
    }
  };

  // El orden de la agenda se mezcla: si el bot siempre arranca por el mismo,
  // los últimos del archivo nunca se usan y la métrica de contenido muerto
  // mide el orden alfabético en vez de medir el diseño.
  const agenda = new Rng(`${semilla}-orden`).mezclar(partida.contactos());

  while (!partida.terminada) {
    atenderTodo();
    if (partida.terminada) break;
    if (lleno()) {
      // Cierra la lista, como en la ventana. Si a las 20:30 alguien se baja o
      // cae una interrupción, el reloj se frena ahí y sigue con lo que haya.
      // Mientras atiende a uno puede llegar otro: atiende hasta que no quede nadie.
      if (estilo.atiendeAntesDeCerrar) {
        for (let pendiente = partida.interrupcionesActivas[0]; pendiente && !partida.terminada; pendiente = partida.interrupcionesActivas[0]) {
          if (!hacer(["atender", pendiente.definicion.id])) break;
          alDia();
        }
        if (partida.terminada) break;
      }
      hacer(["cerrar"]);
      alDia();
      continue;
    }
    const pendientes = agenda.filter((c) => partida.estadoDe(c.id).estado === "sin_contactar");
    const contacto = estilo.siguiente(pendientes, partida, ctx);
    if (!contacto) break;
    hacer(["escribir", contacto.id]);
    alDia();
    for (let i = 0; i < MAX_RESPUESTAS && !partida.terminada; i++) {
      const disponibles = partida.opcionesDisponibles(contacto.id);
      const elegida =
        decisiones === desvio?.decision
          ? disponibles.find((o) => o.id === desvio.opcion)
          : estilo.elegir(disponibles, partida, ctx);
      if (!elegida || !hacer(["responder", contacto.id, elegida.id])) break;
      decisiones++;
      alDia();
      atenderTodo();
    }
  }

  // Sin nadie más, se tapan los agujeros pagando, si el estilo quiere.
  for (let pagar = partida.accionPagar; pagar && estilo.paga(partida); pagar = partida.accionPagar) {
    if (!hacer(["pagar", pagar.puestos[0]!])) break;
  }

  // Sin nada más para hacer, cierra igual: es como termina el viernes en la ventana.
  if (!partida.terminada && partida.accionCerrar) hacer(["cerrar"]);
  // Le quedaba gente que este estilo no sabe convencer: deja correr el reloj.
  if (!partida.terminada && partida.reloj.restante > 0) hacer(["esperar", partida.reloj.restante]);
  return registro.pasos;
}
