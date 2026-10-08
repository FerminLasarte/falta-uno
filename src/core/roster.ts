import { ROLES, type DefinicionContacto, type Desglose, type Rasgo, type Rol } from "./tipos.js";

/** Pares de rasgos que se cruzan en el chat: cuestan moral, pero suman intensidad. */
/** Más allá de este número, los cruces ya no suman al porcentaje de victoria. */
export const TOPE_ROCES_CON_BONO = 3;

/**
 * Pares de rasgos que se pelean. Si dos chocan por más de un lado, se pelean por
 * el primero de la lista: la política va primero porque es la pelea que se ve.
 */
export const PARES_EN_ROCE: readonly (readonly [Rasgo, Rasgo])[] = [
  ["kuka", "gorila"],
  ["kuka", "libertario"],
  ["rustico", "habilidoso"],
  ["quejoso", "capitan"],
  ["cagon", "aguantador"],
];

export interface Roce {
  readonly a: string;
  readonly b: string;
  readonly rasgos: readonly [Rasgo, Rasgo];
}

export function contarPorRol(plantel: readonly DefinicionContacto[]): Record<Rol, number> {
  const conteo = { arquero: 0, defensor: 0, mediocampista: 0, delantero: 0 };
  for (const c of plantel) conteo[c.rol]++;
  return conteo;
}

/**
 * Lo que falta para el equipo ideal, por puesto, y cuántos suplentes. Los que
 * sobran de un puesto ya cubierto cuentan como suplentes.
 */
export function faltantes(
  plantel: readonly DefinicionContacto[],
  composicion: Readonly<Record<Rol, number>>,
  necesarios: number,
): { porPuesto: { rol: Rol; faltan: number }[]; suplentes: number } {
  const conteo = contarPorRol(plantel);
  const porPuesto = ROLES.map((rol) => ({ rol, faltan: composicion[rol] - conteo[rol] })).filter((f) => f.faltan > 0);
  const titularesQueFaltan = porPuesto.reduce((suma, f) => suma + f.faltan, 0);
  const suplentes = Math.max(0, necesarios - plantel.length - titularesQueFaltan);
  return { porPuesto, suplentes };
}

/** Roces que se forman al sumar `nuevo` a un plantel ya armado. Dos se cruzan una vez, aunque choquen por dos lados. */
export function rocesAlSumar(
  plantel: readonly DefinicionContacto[],
  nuevo: DefinicionContacto,
): Roce[] {
  const roces: Roce[] = [];
  for (const existente of plantel) {
    for (const [x, y] of PARES_EN_ROCE) {
      const cruce =
        (existente.rasgos.includes(x) && nuevo.rasgos.includes(y)) ||
        (existente.rasgos.includes(y) && nuevo.rasgos.includes(x));
      if (cruce) {
        roces.push({ a: existente.id, b: nuevo.id, rasgos: [x, y] });
        break;
      }
    }
  }
  return roces;
}

export function todosLosRoces(plantel: readonly DefinicionContacto[]): Roce[] {
  const roces: Roce[] = [];
  for (let i = 0; i < plantel.length; i++) {
    const anteriores = plantel.slice(0, i);
    roces.push(...rocesAlSumar(anteriores, plantel[i]!));
  }
  return roces;
}

/**
 * Química del plantel, como desglose auditable en vez de un número opaco.
 * Que sea inspeccionable es lo que después permite balancear con el bot.
 */
export function quimica(plantel: readonly DefinicionContacto[], composicion: Readonly<Record<Rol, number>>): Desglose[] {
  if (plantel.length === 0) return [];
  const conteo = contarPorRol(plantel);
  const desglose: Desglose[] = [];

  if (conteo.arquero === 0) {
    desglose.push({ concepto: "Ningún arquero natural", valor: -18 });
  } else if (conteo.arquero > composicion.arquero) {
    desglose.push({ concepto: "Arquero de suplente, por si acaso", valor: 2 });
  }

  const excesoDelanteros = Math.max(0, conteo.delantero - composicion.delantero);
  if (excesoDelanteros > 0) {
    desglose.push({
      concepto: `${excesoDelanteros} delantero(s) de más, nadie marca`,
      valor: -5 * excesoDelanteros,
    });
  }

  const faltaFondo = Math.max(0, composicion.defensor - conteo.defensor);
  if (faltaFondo > 0) {
    desglose.push({ concepto: `Falta fondo (${faltaFondo} defensor/es)`, valor: -3 * faltaFondo });
  }

  // El bono por roces tiene techo: un partido picado se juega más intenso, pero
  // amontonar incompatibles no puede ser una estrategia ganadora.
  const roces = todosLosRoces(plantel);
  if (roces.length > 0) {
    const computados = Math.min(roces.length, TOPE_ROCES_CON_BONO);
    desglose.push({
      concepto: `${roces.length} roce(s) en el chat: se juega picado`,
      valor: 3 * computados,
    });
  }

  const capitanes = plantel.filter((c) => c.rasgos.includes("capitan")).length;
  if (capitanes > 0) desglose.push({ concepto: "Hay quien ordena adentro", valor: 6 });

  const cagones = plantel.filter((c) => c.rasgos.includes("cagon")).length;
  if (cagones >= 2) desglose.push({ concepto: `${cagones} que no van al roce`, valor: -4 });

  return desglose;
}

export function habilidadPromedio(plantel: readonly DefinicionContacto[]): number {
  if (plantel.length === 0) return 0;
  return plantel.reduce((suma, c) => suma + c.habilidad, 0) / plantel.length;
}
