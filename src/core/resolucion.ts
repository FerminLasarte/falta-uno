import { formatearPesos } from "./formato.js";
import type { Partida } from "./partida.js";
import { Rng } from "./rng.js";
import { formacion, quimica, titulares, todosLosRoces } from "./roster.js";
import { Narrador, type ClaveRelato } from "./relato.js";
import { formatearHora } from "./tiempo.js";
import type { Desglose, DefinicionContacto, EntradaBitacora } from "./tipos.js";

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
  /** Qué se cuenta: el fraseo se elige recién si el momento entra al relato. */
  readonly frase: Frase;
  readonly porque?: string;
  readonly signo: -1 | 0 | 1;
  readonly peso: number;
  /** Familia del beat: se usa para no narrar cinco veces lo mismo. */
  readonly clave: string;
}

interface Frase {
  readonly clave: ClaveRelato;
  readonly marcas?: Readonly<Record<string, string>>;
}

const frase = (clave: ClaveRelato, marcas?: Readonly<Record<string, string>>): Frase => (marcas ? { clave, marcas } : { clave });

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
      `Quedaron ${plantel.length}/${config.jugadoresNecesarios}. Faltando ${faltan}, no hay partido.`,
    );
  }
  if (partida.dinero + Math.max(0, partida.colchon) < config.senaCancha) {
    return sinPartido(
      partida,
      `Juntaste los ${config.jugadoresNecesarios}, pero no te alcanzó para la seña (${formatearPesos(config.senaCancha)}) ni poniendo lo que tenías guardado. El complejo largó la cancha.`,
    );
  }

  // --- la matemática -------------------------------------------------------
  const desglose: Desglose[] = [...formacion(plantel, config.composicion), ...quimica(plantel, config.composicion)];

  if (config.rival && config.rival.nivel > 0) {
    desglose.push({ concepto: `Enfrente: ${config.rival.nombre}`, valor: -config.rival.nivel });
  }

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
  const alcance = partida.dinero + Math.max(0, partida.colchon);
  if (plantel.length >= config.jugadoresNecesarios && alcance < config.senaCancha) {
    motivos.push({
      hora: null,
      texto: `Faltaron ${formatearPesos(config.senaCancha - alcance)} para la seña.`,
      porque:
        partida.colchon > 0
          ? `Entre todos juntaron ${formatearPesos(partida.dinero)} y tenías ${formatearPesos(partida.colchon)} guardados`
          : `Entre todos juntaron ${formatearPesos(partida.dinero)}`,
    });
  }

  const contactos = partida.contactos();
  for (const c of contactos.filter((x) => x.estado === "bajado")) {
    const baja = bitacora.find((e) => e.tipo === "baja_tardia" && e.contactoId === c.id);
    const motivo = { hora: baja ? formatearHora(baja.minuto) : null, texto: `${c.nombre} se bajó.` };
    const porque = baja?.detalle ?? avisoDe(partida, c.id);
    motivos.push(porque ? { ...motivo, porque } : con(c.id, motivo));
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

/** "Te avisó a las 20:05 que no sabía si llegaba", si avisó antes de bajarse. */
function avisoDe(partida: Partida, id: string): string | undefined {
  const aviso = partida.bitacora.todas().find((e) => e.tipo === "duda" && e.contactoId === id);
  return aviso ? `Te avisó a las ${formatearHora(aviso.minuto)} que no sabía si llegaba` : undefined;
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
  const narrador = new Narrador(partida.relato, rng);
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

  /** Lo que es de dos (un roce, el que trajo a otro) solo se cuenta si los dos están en la cancha. */
  const vinieronLosDos = (entrada: EntradaBitacora): boolean =>
    enPlantel.has(entrada.contactoId ?? "") && enPlantel.has(entrada.otroId ?? "");

  for (const entrada of partida.bitacora.todas()) {
    const id = entrada.contactoId;
    const hora = formatearHora(entrada.minuto);
    const clave = entrada.tipo;

    switch (entrada.tipo) {
      case "apuro":
        if (id && enPlantel.has(id)) {
          candidatos.push({
            frase: frase("apuro", { x: nombre(id) }),
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
            frase: comprado ? frase("plata_comprado") : frase("plata", { x: nombre(id) }),
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
            frase: frase("grupo_caliente"),
            porque: "Dejaste que el grupo se incendiara",
            signo: -1,
            peso: 2,
            clave,
          });
          break;
        }
        if (!vinieronLosDos(entrada)) break;
        candidatos.push({
          frase: frase("roce", { par: entrada.detalle ?? "Dos de los tuyos" }),
          porque: `Se cruzaron en el grupo a las ${hora} y no los calmaste`,
          signo: 0,
          peso: 3,
          clave,
        });
        break;
      case "roce_calmado":
        if (!vinieronLosDos(entrada)) break;
        candidatos.push({
          frase: frase("roce_calmado", { par: entrada.detalle ?? "Los que se peleaban" }),
          porque: `Los calmaste en el grupo a las ${hora}`,
          signo: 1,
          peso: 3,
          clave,
        });
        break;
      case "baja_tardia":
        if (id) {
          // Si la baja tiene un motivo tuyo (la mentira que se descubrió), se cuenta
          // ese; si no, el aviso que no atajaste.
          const motivo = entrada.detalle ?? avisoDe(partida, id);
          candidatos.push({
            frase: frase("baja", { x: nombre(id) }),
            porque: motivo ? `${motivo}. Se bajó a las ${hora}` : `Se bajó a las ${hora}`,
            signo: -1,
            peso: 3,
            clave,
          });
        }
        break;
      case "no_vino":
        candidatos.push({
          frase: frase("no_vino", { x: entrada.detalle ?? "uno" }),
          porque: `Era el que traía ${nombre(id)}: no lo conocías`,
          signo: -1,
          peso: 3,
          clave,
        });
        break;
      case "trajo":
        // Los dos en la cancha: el que lo trajo y el invitado, que pudo no venir.
        if (vinieronLosDos(entrada)) {
          candidatos.push({
            frase: frase("trajo", { x: entrada.detalle ?? "El que trajo" }),
            porque: `Lo trajo ${nombre(id)} a las ${hora}`,
            signo: 0,
            peso: 2,
            clave,
          });
        }
        break;
      case "favor":
        if (id && enPlantel.has(id)) {
          candidatos.push({
            frase: frase("favor", { x: nombre(id) }),
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
            frase: frase("confirmacion_limpia", { x: nombre(id) }),
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
            frase: frase("ignorado", { x: nombre(id) }),
            porque: `Lo dejaste en visto a las ${hora}`,
            signo: -1,
            peso: 2,
            clave,
          });
        } else if (id) {
          candidatos.push({
            frase: frase("cancha_ignorada"),
            porque: `No le contestaste a ${entrada.detalle ?? "la cancha"}`,
            signo: -1,
            peso: 2,
            clave,
          });
        }
        break;
      case "pareja_ignorada":
        candidatos.push({
          frase: frase("pareja_ignorada"),
          porque: `Dejaste a ${entrada.detalle ?? "tu pareja"} esperando`,
          signo: -1,
          peso: 2,
          clave,
        });
        break;
      case "trabajo_ignorado":
        candidatos.push({
          frase: frase("trabajo_ignorado"),
          porque: `No le contestaste al ${entrada.detalle ?? "jefe"}`,
          signo: -1,
          peso: 2,
          clave,
        });
        break;
    }
  }

  // Lo que se narra de la formación es lo mismo que la cuenta: los que arrancan y dónde.
  for (const t of titulares(plantel, partida.config.composicion)) {
    if (t.puesto === t.jugador.rol) continue;
    candidatos.push(
      t.puesto === "arquero"
        ? {
            frase: frase("sin_arquero", { x: t.jugador.nombre }),
            porque: "No conseguiste arquero",
            signo: -1,
            peso: 4,
            clave: "sin_arquero",
          }
        : {
            frase: frase("fuera_de_puesto", { x: t.jugador.nombre, puesto: t.puesto }),
            porque: `No conseguiste ${t.puesto}`,
            signo: -1,
            peso: 3,
            clave: "fuera_de_puesto",
          },
    );
  }

  const roces = todosLosRoces(plantel);
  if (roces.length >= 2) {
    candidatos.push({
      frase: frase("picado"),
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
      frase: frase("crack", { x: crack.nombre }),
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
  const unico = (c: Candidato): string => `${c.frase.clave}|${JSON.stringify(c.frase.marcas ?? {})}`;
  const ordenados = candidatos
    .filter((c) => (vistos.has(unico(c)) ? false : (vistos.add(unico(c)), true)))
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
      const { frase, porque, signo } = m.candidato;
      return { minuto, texto: narrador.decir(frase.clave, frase.marcas), signo, ...(porque !== undefined ? { porque } : {}) };
    }
    if (m.de === "favor") {
      nuestros++;
      const autor = pateadores.length > 0 ? rng.elegir(pateadores) : rng.elegir(plantel);
      const texto = `${narrador.decir("gol_favor", { x: autor.nombre })} ${nuestros} a ${suyos}.`;
      return { minuto, texto, signo: 1, gol: "favor" };
    }
    suyos++;
    return { minuto, texto: `${narrador.decir("gol_contra")} ${nuestros} a ${suyos}.`, signo: -1, gol: "contra" };
  });

  beats.push({
    minuto: 40,
    texto: narrador.decir(gano ? "gano" : "perdio", { favor: String(golesFavor), contra: String(golesContra) }),
    signo: gano ? 1 : -1,
  });

  return beats;
}
