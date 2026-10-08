import { formatearPesos } from "./formato.js";
import type { Partida } from "./partida.js";
import { Rng } from "./rng.js";
import { habilidadPromedio, quimica, todosLosRoces } from "./roster.js";
import { formatearHora } from "./tiempo.js";
import type { Desglose, DefinicionContacto } from "./tipos.js";

export interface Beat {
  readonly minuto: number;
  /** Lo que pasa en la cancha. */
  readonly texto: string;
  /** La decisión tuya que lo explica, si hay una. Va aparte para que se vea de dónde sale. */
  readonly porque?: string;
  readonly signo: -1 | 0 | 1;
  /** Un gol, nuestro o de ellos. El texto ya trae cómo va el partido. */
  readonly gol?: "favor" | "contra";
}

/** Algo que explica por qué no hubo partido: quién faltó y qué hiciste vos para que faltara. */
export interface Motivo {
  /** Cuándo pasó, si se sabe. */
  readonly hora: string | null;
  readonly texto: string;
  readonly porque?: string;
}

export interface Resolucion {
  readonly hayPartido: boolean;
  readonly motivoSinPartido?: string;
  /** Sin partido, por qué: la narración atribuida de lo que no pasó. */
  readonly porQueNo: readonly Motivo[];
  readonly plantel: readonly DefinicionContacto[];
  readonly desglose: readonly Desglose[];
  readonly probabilidad: number;
  readonly gano: boolean;
  readonly golesFavor: number;
  readonly golesContra: number;
  readonly narracion: readonly Beat[];
  readonly recompensa: { readonly dinero: number; readonly prestigio: number };
}

/** Candidato a beat, todavía sin minuto asignado. */
interface Candidato {
  readonly texto: string;
  readonly porque?: string;
  readonly signo: -1 | 0 | 1;
  readonly peso: number;
  /** Familia del beat: se usa para no narrar cinco veces lo mismo. */
  readonly clave: string;
}

function limitar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Resuelve el partido. La matemática es un desglose auditable; lo que hace que
 * el desenlace no se sienta arbitrario es que cada beat de la narración sale de
 * una decisión concreta registrada en la bitácora.
 */
export function resolver(partida: Partida): Resolucion {
  const rng = new Rng(partida.semillaActual ^ 0x5f3759df);
  const plantel = partida.plantel();
  const config = partida.config;

  // --- ¿hay partido? -------------------------------------------------------
  if (partida.motivoFin === "moral_agotada") {
    return sinPartido(partida, "Colapsaste antes de las 21. No fue nadie porque nadie supo nada.");
  }
  if (plantel.length < config.jugadoresNecesarios) {
    const faltan = config.jugadoresNecesarios - plantel.length;
    return sinPartido(
      partida,
      `Quedaron ${plantel.length}/${config.jugadoresNecesarios}. Faltando ${faltan}, no hay picadito.`,
    );
  }
  if (partida.dinero < config.senaCancha) {
    return sinPartido(
      partida,
      `Juntaste los ${config.jugadoresNecesarios}, pero no te alcanzó para la seña (${formatearPesos(config.senaCancha)}). El complejo largó la cancha.`,
    );
  }

  // --- la matemática -------------------------------------------------------
  const base = habilidadPromedio(plantel);
  const desglose: Desglose[] = [
    { concepto: "Habilidad promedio del plantel", valor: Math.round(base) },
    ...quimica(plantel),
  ];

  const moral = partida.moral;
  if (moral < 25) desglose.push({ concepto: "Llegás fundido a la cancha", valor: -10 });
  else if (moral > 75) desglose.push({ concepto: "Llegás entero y de buen humor", valor: 5 });

  const bajas = partida.bitacora.contar("baja_tardia");
  if (bajas > 0) {
    desglose.push({ concepto: `${bajas} baja(s) de último momento`, valor: -4 * bajas });
  }

  const comprados = plantel.filter((c) => c.id.startsWith("relleno_")).length;
  if (comprados > 0) {
    desglose.push({ concepto: `${comprados} desconocido(s) pagado(s)`, valor: -3 * comprados });
  }

  const total = desglose.reduce((suma, d) => suma + d.valor, 0);
  const probabilidad = limitar(Math.round(total), 5, 95);

  const gano = rng.ocurre(probabilidad);
  // La diferencia sale de cuánto favorito era el que ganó: si gana el que tenía
  // menos chances, gana por poco, no por goleada.
  const favoritismo = (gano ? probabilidad : 100 - probabilidad) - 50;
  const diferencia = Math.max(1, Math.round(favoritismo / 14) + rng.entero(0, 1));
  const perdedor = rng.entero(0, 3);
  const golesFavor = gano ? perdedor + diferencia : perdedor;
  const golesContra = gano ? perdedor : perdedor + diferencia;

  const narracion = narrar(partida, plantel, gano, golesFavor, golesContra, rng);

  const recompensa = gano
    ? { dinero: Math.round(config.senaCancha * 0.6), prestigio: 10 }
    : { dinero: 0, prestigio: -4 };

  return {
    hayPartido: true,
    porQueNo: [],
    plantel,
    desglose,
    probabilidad,
    gano,
    golesFavor,
    golesContra,
    narracion,
    recompensa,
  };
}

function sinPartido(partida: Partida, motivo: string): Resolucion {
  return {
    hayPartido: false,
    motivoSinPartido: motivo,
    porQueNo: porQueNoHubo(partida),
    plantel: partida.plantel(),
    desglose: [],
    probabilidad: 0,
    gano: false,
    golesFavor: 0,
    golesContra: 0,
    narracion: [],
    recompensa: { dinero: 0, prestigio: -8 },
  };
}

/** "Gonza", "Gonza y Lucho", "Gonza, Lucho y Darío", "Gonza, Lucho y 3 más". */
function nombrar(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  if (nombres.length > 3) return `${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} más`;
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

/**
 * Sin partido también se cuenta, y con la misma regla: cada cosa con la
 * decisión tuya que la explica, si hay una. Lo que fue culpa de nadie va sin causa.
 */
function porQueNoHubo(partida: Partida): Motivo[] {
  const config = partida.config;
  const bitacora = partida.bitacora.todas();
  const motivos: Motivo[] = [];

  /** Lo último que le hiciste a alguien que explica que no venga. */
  const decisionCon = (id: string): string | undefined => {
    const entrada = bitacora.filter((e) => e.contactoId === id && (e.tipo === "apuro" || e.tipo === "ignorado")).at(-1);
    if (!entrada) return undefined;
    const hora = formatearHora(entrada.minuto);
    return entrada.tipo === "apuro"
      ? `${capitalizar(entrada.detalle ?? "lo apuraste")} a las ${hora}`
      : `Lo dejaste en visto a las ${hora}`;
  };
  const con = (id: string, motivo: Omit<Motivo, "porque">): Motivo => {
    const porque = decisionCon(id);
    return porque ? { ...motivo, porque } : motivo;
  };

  if (partida.motivoFin === "moral_agotada") {
    motivos.push({ hora: formatearHora(partida.reloj.minutos), texto: "Apagaste el teléfono.", porque: "No diste más" });
  }
  const plantel = partida.plantel();
  if (plantel.length >= config.jugadoresNecesarios && partida.dinero < config.senaCancha) {
    motivos.push({
      hora: null,
      texto: `Faltaron ${formatearPesos(config.senaCancha - partida.dinero)} para la seña.`,
      porque: `Entre todos juntaron ${formatearPesos(partida.dinero)}`,
    });
  }

  const contactos = partida.contactos();
  for (const c of contactos.filter((x) => x.estado === "bajado")) {
    const baja = bitacora.find((e) => e.tipo === "baja_tardia" && e.contactoId === c.id);
    motivos.push(con(c.id, { hora: baja ? formatearHora(baja.minuto) : null, texto: `${c.nombre} se bajó.` }));
  }
  for (const c of contactos.filter((x) => x.estado === "rechazado")) {
    motivos.push(con(c.id, { hora: c.minutoUltimo === null ? null : formatearHora(c.minutoUltimo), texto: `${c.nombre} no viene.` }));
  }
  for (const c of contactos.filter((x) => x.estado === "hablando" || x.estado === "esperando")) {
    motivos.push({ hora: null, texto: `${c.nombre} quedó en el aire.`, porque: "No le cerraste a tiempo" });
  }
  const sinEscribir = contactos.filter((x) => x.estado === "sin_contactar").map((x) => x.nombre);
  if (sinEscribir.length > 0) {
    const uno = sinEscribir.length === 1;
    motivos.push({
      hora: null,
      texto: `${nombrar(sinEscribir)} ${uno ? "ni se enteró" : "ni se enteraron"}.`,
      porque: uno ? "No le escribiste" : "No les escribiste",
    });
  }
  return motivos;
}

/** "lo llamaste por teléfono" → "Lo llamaste por teléfono". */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Cuánto pesa cada puesto a la hora de elegir quién hace un gol. */
const OLFATO: Record<DefinicionContacto["rol"], number> = {
  arquero: 0,
  defensor: 1,
  mediocampista: 2,
  delantero: 4,
};

const GOL_FAVOR = ["{x} la empuja abajo del arco.", "{x} le pega de lejos y entra.", "{x} define cruzado."];
const GOL_CONTRA = ["Gol de ellos.", "Se la meten por arriba.", "Contra, y gol de ellos."];

/**
 * Cada beat referencia algo que el jugador hizo, con la decisión aparte. Si no
 * hay nada que atribuir, mejor menos beats que beats genéricos. Los goles van
 * entre medio, con cómo va el partido, y el último beat cuenta el resultado.
 */
function narrar(
  partida: Partida,
  plantel: readonly DefinicionContacto[],
  gano: boolean,
  golesFavor: number,
  golesContra: number,
  rng: Rng,
): Beat[] {
  const candidatos: Candidato[] = [];
  const enPlantel = new Set(plantel.map((c) => c.id));
  /** El nombre de alguien de la agenda, o lo que la bitácora anotó de quien no lo es. */
  const nombre = (id: string | undefined, detalle?: string): string => {
    const enAgenda = plantel.find((c) => c.id === id);
    if (enAgenda) return enAgenda.nombre;
    try {
      return partida.definicion(id ?? "").nombre;
    } catch {
      return detalle ?? "alguien";
    }
  };

  /** Si es alguien de la agenda. Una interrupción ignorada también deja su marca, con su id. */
  const esContacto = (id: string | undefined): boolean => {
    try {
      partida.definicion(id ?? "");
      return true;
    } catch {
      return false;
    }
  };

  // Un roce que calmaste a tiempo no se narra como pelea: se narra que lo calmaste.
  const calmados = new Set(
    partida.bitacora
      .todas()
      .filter((e) => e.tipo === "roce_calmado")
      .map((e) => e.contactoId),
  );

  for (const entrada of partida.bitacora.todas()) {
    const id = entrada.contactoId;
    const hora = formatearHora(entrada.minuto);
    const clave = entrada.tipo;

    switch (entrada.tipo) {
      case "apuro":
        if (id && enPlantel.has(id)) {
          candidatos.push({
            texto: `${nombre(id)} vino de mala gana y erra un gol hecho.`,
            porque: `${capitalizar(entrada.detalle ?? "lo apuraste")} a las ${hora}`,
            signo: -1,
            peso: 3,
            clave,
          });
        }
        break;
      case "plata":
        if (id && enPlantel.has(id)) {
          const comprado = id.startsWith("relleno_");
          candidatos.push({
            texto: `${comprado ? "El que conseguiste pagando" : nombre(id)} corre como si le fuera la vida.`,
            porque: comprado
              ? `${capitalizar(entrada.detalle ?? "pagaste un reemplazo")} a las ${hora}`
              : `Le pusiste plata para que venga, a las ${hora}`,
            signo: 1,
            peso: 2,
            clave,
          });
        }
        break;
      case "roce":
        if (calmados.has(id)) break;
        if (!esContacto(id)) {
          // El grupo que se prendió fuego y nadie apagó: llegan todos calientes.
          candidatos.push({
            texto: "Llegan todos calientes de lo que se dijo en el grupo, y en la cancha se nota.",
            porque: "Dejaste que el grupo se incendiara",
            signo: -1,
            peso: 2,
            clave,
          });
          break;
        }
        candidatos.push({
          texto: `${entrada.detalle ?? "Dos de los tuyos"} se gritan todo el partido.`,
          porque: `Se cruzaron en el grupo a las ${hora} y no los calmaste`,
          signo: 0,
          peso: 3,
          clave,
        });
        break;
      case "roce_calmado":
        candidatos.push({
          texto: `${entrada.detalle ?? "Los que se peleaban"} se cruzan en la primera dividida y se dan la mano.`,
          porque: `Los calmaste en el grupo a las ${hora}`,
          signo: 1,
          peso: 3,
          clave,
        });
        break;
      case "baja_tardia":
        if (id) {
          candidatos.push({
            texto: `Se nota el hueco de ${nombre(id)}. Juegan corriendo de atrás.`,
            porque: `Se bajó a las ${hora}`,
            signo: -1,
            peso: 3,
            clave,
          });
        }
        break;
      case "favor":
        if (id && enPlantel.has(id)) {
          candidatos.push({
            texto: `${nombre(id)} deja todo adentro de la cancha.`,
            porque: `Le hiciste un favor a las ${hora}`,
            signo: 1,
            peso: 2,
            clave,
          });
        }
        break;
      case "confirmacion_limpia":
        if (id && enPlantel.has(id)) {
          candidatos.push({
            texto: `${nombre(id)} la descose por la banda.`,
            porque: `Dijo que sí a la primera, a las ${hora}`,
            signo: 1,
            peso: 1,
            clave,
          });
        }
        break;
      case "ignorado":
        if (id && esContacto(id)) {
          candidatos.push({
            texto: `${nombre(id)} te lo recuerda toda la noche.`,
            porque: `Lo dejaste en visto a las ${hora}`,
            signo: -1,
            peso: 2,
            clave,
          });
        } else if (id) {
          candidatos.push({
            texto: "Llegás y en la entrada te miran torcido. Arrancan con la cancha a medio preparar.",
            porque: `No le contestaste a ${entrada.detalle ?? "la cancha"}`,
            signo: -1,
            peso: 2,
            clave,
          });
        }
        break;
      case "pareja_ignorada":
        candidatos.push({
          texto: "No podés dejar de mirar el teléfono. Te comés un caño mirando la pantalla.",
          porque: `Dejaste a ${entrada.detalle ?? "tu pareja"} esperando`,
          signo: -1,
          peso: 2,
          clave,
        });
        break;
      case "trabajo_ignorado":
        candidatos.push({
          texto: "Suena el teléfono del laburo en pleno partido y salís a atender.",
          porque: `No le contestaste al ${entrada.detalle ?? "jefe"}`,
          signo: -1,
          peso: 2,
          clave,
        });
        break;
    }
  }

  const arqueros = plantel.filter((c) => c.rol === "arquero").length;
  if (arqueros === 0) {
    const voluntario = rng.elegir(plantel);
    candidatos.push({
      texto: `Nadie quiere ir al arco. Se pone ${voluntario.nombre}, que no ataja ni un centro.`,
      porque: "No conseguiste arquero",
      signo: -1,
      peso: 4,
      clave: "sin_arquero",
    });
  }

  const roces = todosLosRoces(plantel);
  if (roces.length >= 2) {
    candidatos.push({
      texto: "El partido se pica en serio. Nadie afloja, y eso también es jugar.",
      porque: "Armaste un equipo de gente que se cruza",
      signo: 1,
      peso: 2,
      clave: "picado",
    });
  }

  const cracks = plantel.filter((c) => c.habilidad >= 80);
  if (cracks.length > 0) {
    const crack = rng.elegir(cracks);
    candidatos.push({
      texto: `${crack.nombre} agarra la pelota en la mitad y se lleva a tres.`,
      porque: `Lo trajiste`,
      signo: 1,
      peso: 2,
      clave: "crack",
    });
  }

  // El peso manda: lo que definió el partido se narra sí o sí. La coherencia con
  // el resultado y el ruido solo desempatan entre beats del mismo peso, nunca
  // alcanzan para que un relleno tape algo importante.
  const RUIDO = 1.2;
  const MAX_POR_FAMILIA = 2;

  const vistos = new Set<string>();
  const ordenados = candidatos
    .filter((c) => (vistos.has(c.texto) ? false : (vistos.add(c.texto), true)))
    .map((c) => {
      const alineado = gano ? c.signo >= 0 : c.signo <= 0;
      return { candidato: c, puntaje: c.peso * 2 + (alineado ? 1 : 0) + rng.siguiente() * RUIDO };
    })
    .sort((a, b) => b.puntaje - a.puntaje);

  const porFamilia = new Map<string, number>();
  const elegidos: Candidato[] = [];
  for (const { candidato } of ordenados) {
    const usados = porFamilia.get(candidato.clave) ?? 0;
    if (usados >= MAX_POR_FAMILIA) continue;
    porFamilia.set(candidato.clave, usados + 1);
    elegidos.push(candidato);
    if (elegidos.length === 5) break;
  }

  // Los goles se reparten entre los momentos. Quién hace los nuestros depende
  // del puesto y de cuánto juega cada uno.
  const goles: ("favor" | "contra")[] = [
    ...Array<"favor">(golesFavor).fill("favor"),
    ...Array<"contra">(golesContra).fill("contra"),
  ];
  const momentos: ({ tipo: "beat"; candidato: Candidato } | { tipo: "gol"; de: "favor" | "contra" })[] = [
    ...elegidos.map((candidato) => ({ tipo: "beat" as const, candidato })),
    ...goles.map((de) => ({ tipo: "gol" as const, de })),
  ];
  const minutos = momentos.map(() => rng.entero(2, 38));
  const enOrden = rng
    .mezclar(momentos.map((m, i) => ({ m, minuto: minutos[i]! })))
    .sort((a, b) => a.minuto - b.minuto);

  const pateadores = plantel.flatMap((c) => Array<DefinicionContacto>(OLFATO[c.rol] * Math.max(1, Math.round(c.habilidad / 20))).fill(c));
  let nuestros = 0;
  let suyos = 0;
  const beats: Beat[] = enOrden.map(({ m, minuto }): Beat => {
    if (m.tipo === "beat") {
      const { texto, porque, signo } = m.candidato;
      return { minuto, texto, signo, ...(porque !== undefined ? { porque } : {}) };
    }
    if (m.de === "favor") {
      nuestros++;
      const autor = pateadores.length > 0 ? rng.elegir(pateadores) : rng.elegir(plantel);
      const texto = `${rng.elegir(GOL_FAVOR).replace("{x}", autor.nombre)} ${nuestros} a ${suyos}.`;
      return { minuto, texto, signo: 1, gol: "favor" };
    }
    suyos++;
    return { minuto, texto: `${rng.elegir(GOL_CONTRA)} ${nuestros} a ${suyos}.`, signo: -1, gol: "contra" };
  });

  beats.push({
    minuto: 40,
    texto: gano
      ? `Termina ${golesFavor} a ${golesContra}. Ganaron. Alguien propone ir a comer algo.`
      : `Termina ${golesFavor} a ${golesContra}. Perdieron. Nadie habla en el vestuario.`,
    signo: gano ? 1 : -1,
  });

  return beats;
}
