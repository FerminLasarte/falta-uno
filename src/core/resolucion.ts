import type { Partida } from "./partida.js";
import { Rng } from "./rng.js";
import { habilidadPromedio, quimica, todosLosRoces } from "./roster.js";
import { formatearHora } from "./tiempo.js";
import type { Desglose, DefinicionContacto } from "./tipos.js";

export interface Beat {
  readonly minuto: number;
  readonly texto: string;
  readonly signo: -1 | 0 | 1;
}

export interface Resolucion {
  readonly hayPartido: boolean;
  readonly motivoSinPartido?: string;
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
    return sinPartido(plantel, "Colapsaste antes de las 21. No fue nadie porque nadie supo nada.");
  }
  if (plantel.length < config.jugadoresNecesarios) {
    const faltan = config.jugadoresNecesarios - plantel.length;
    return sinPartido(
      plantel,
      `Quedaron ${plantel.length}/${config.jugadoresNecesarios}. Faltando ${faltan}, no hay picadito.`,
    );
  }
  if (partida.dinero < config.senaCancha) {
    return sinPartido(
      plantel,
      `Juntaste los ${config.jugadoresNecesarios}, pero no te alcanzó para la seña ($${config.senaCancha}). El complejo largó la cancha.`,
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
  const diferencia = Math.max(1, Math.round(Math.abs(probabilidad - 50) / 14) + rng.entero(0, 1));
  const perdedor = rng.entero(0, 3);
  const golesFavor = gano ? perdedor + diferencia : perdedor;
  const golesContra = gano ? perdedor : perdedor + diferencia;

  const narracion = narrar(partida, plantel, gano, golesFavor, golesContra, rng);

  const recompensa = gano
    ? { dinero: Math.round(config.senaCancha * 0.6), prestigio: 10 }
    : { dinero: 0, prestigio: -4 };

  return {
    hayPartido: true,
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

function sinPartido(plantel: readonly DefinicionContacto[], motivo: string): Resolucion {
  return {
    hayPartido: false,
    motivoSinPartido: motivo,
    plantel,
    desglose: [],
    probabilidad: 0,
    gano: false,
    golesFavor: 0,
    golesContra: 0,
    narracion: [],
    recompensa: { dinero: 0, prestigio: -8 },
  };
}

/**
 * Cada beat referencia algo que el jugador hizo. Si no hay nada que atribuir,
 * mejor menos beats que beats genéricos.
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
  const nombre = (id: string): string => {
    const enAgenda = plantel.find((c) => c.id === id);
    if (enAgenda) return enAgenda.nombre;
    try {
      return partida.definicion(id).nombre;
    } catch {
      return "alguien";
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

    switch (entrada.tipo) {
      case "apuro":
        if (id && enPlantel.has(id)) {
          candidatos.push({
            texto: `${nombre(id)}, que vino de mala gana porque lo apuraste a las ${hora}, erra un gol hecho.`,
            signo: -1,
            peso: 3,
            clave: entrada.tipo,
          });
        }
        break;
      case "plata":
        if (id && enPlantel.has(id)) {
          candidatos.push({
            texto: `El que conseguiste pagando a las ${hora} corre como si le fuera la vida. Valió cada peso.`,
            signo: 1,
            peso: 2,
            clave: entrada.tipo,
          });
        }
        break;
      case "roce":
        if (calmados.has(id)) break;
        candidatos.push({
          texto: `${entrada.detalle ?? "Se arma lío en la cancha"}. Los pusiste juntos igual y ahora se gritan todo.`,
          signo: 0,
          peso: 3,
          clave: entrada.tipo,
        });
        break;
      case "roce_calmado":
        candidatos.push({
          texto: `${entrada.detalle ?? "Los que se peleaban"} se cruzan en la primera pelota dividida y se dan la mano. Valió calmarlos a las ${hora}.`,
          signo: 1,
          peso: 3,
          clave: entrada.tipo,
        });
        break;
      case "baja_tardia":
        if (id) {
          candidatos.push({
            texto: `Se nota el hueco de ${nombre(id)}, que se bajó a las ${hora}. Juegan corriendo de atrás.`,
            signo: -1,
            peso: 3,
            clave: entrada.tipo,
          });
        }
        break;
      case "favor":
        if (id && enPlantel.has(id)) {
          candidatos.push({
            texto: `${nombre(id)} te devuelve el favor adentro de la cancha: deja todo.`,
            signo: 1,
            peso: 2,
            clave: entrada.tipo,
          });
        }
        break;
      case "confirmacion_limpia":
        if (id && enPlantel.has(id)) {
          candidatos.push({
            texto: `${nombre(id)}, que dijo que sí a la primera, la descose por la banda.`,
            signo: 1,
            peso: 1,
            clave: entrada.tipo,
          });
        }
        break;
      case "ignorado":
        if (id) {
          candidatos.push({
            texto: `${nombre(id)} te lo recuerda todo el partido: lo dejaste en visto a las ${hora}.`,
            signo: -1,
            peso: 2,
            clave: entrada.tipo,
          });
        }
        break;
      case "pareja_ignorada":
        candidatos.push({
          texto: `No podés dejar de mirar el teléfono. Te comés un caño mirando la pantalla.`,
          signo: -1,
          peso: 2,
          clave: entrada.tipo,
        });
        break;
      case "trabajo_ignorado":
        candidatos.push({
          texto: `Suena el teléfono desde el laburo en pleno partido. Salís a atender y entra el gol.`,
          signo: -1,
          peso: 2,
          clave: entrada.tipo,
        });
        break;
    }
  }

  const arqueros = plantel.filter((c) => c.rol === "arquero").length;
  if (arqueros === 0) {
    const voluntario = rng.elegir(plantel);
    candidatos.push({
      texto: `Nadie quiere ir al arco. Se pone ${voluntario.nombre}, que no ataja ni un centro.`,
      signo: -1,
      peso: 4,
      clave: "sin_arquero",
    });
  }

  const roces = todosLosRoces(plantel);
  if (roces.length >= 2) {
    candidatos.push({
      texto: `El partido se pica en serio. Nadie afloja, y eso también es jugar.`,
      signo: 1,
      peso: 2,
      clave: "picado",
    });
  }

  const cracks = plantel.filter((c) => c.habilidad >= 80);
  if (cracks.length > 0) {
    const crack = rng.elegir(cracks);
    candidatos.push({
      texto: `${crack.nombre} agarra la pelota en la mitad y se lleva a tres puestos.`,
      signo: 1,
      peso: 2,
      clave: "crack",
    });
  }

  // Se ordena por cuánto pesó cada cosa, con un poco de ruido para que dos
  // partidos iguales no se narren idéntico. El ruido desempata entre pares,
  // nunca tapa un beat importante con relleno: lo que definió el partido tiene
  // que aparecer sí o sí.
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

  const minutos = elegidos
    .map(() => rng.entero(2, 38))
    .sort((a, b) => a - b);

  const beats: Beat[] = elegidos.map((c, i) => ({
    minuto: minutos[i] ?? 20,
    texto: c.texto,
    signo: c.signo,
  }));

  beats.push({
    minuto: 40,
    texto: gano
      ? `Termina ${golesFavor} a ${golesContra}. Ganaron. Alguien propone ir a comer algo.`
      : `Termina ${golesFavor} a ${golesContra}. Perdieron. Nadie habla en el vestuario.`,
    signo: gano ? 1 : -1,
  });

  return beats;
}
