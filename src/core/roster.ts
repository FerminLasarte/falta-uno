import { ROLES, type DefinicionContacto, type Desglose, type Rasgo, type Rol } from "./tipos.js";

/** Composición ideal para un picadito de F5: dos equipos de cinco. */
export const COMPOSICION_IDEAL: Readonly<Record<Rol, number>> = {
  arquero: 2,
  defensor: 3,
  mediocampista: 3,
  delantero: 2,
};

/** Pares de rasgos que se cruzan en el chat: cuestan moral, pero suman intensidad. */
/** Más allá de este número, los cruces ya no suman al porcentaje de victoria. */
export const TOPE_ROCES_CON_BONO = 3;

export const PARES_EN_ROCE: readonly (readonly [Rasgo, Rasgo])[] = [
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

export function faltantes(
  plantel: readonly DefinicionContacto[],
): { rol: Rol; faltan: number }[] {
  const conteo = contarPorRol(plantel);
  return ROLES.map((rol) => ({ rol, faltan: COMPOSICION_IDEAL[rol] - conteo[rol] })).filter(
    (f) => f.faltan > 0,
  );
}

/** Roces que se forman al sumar `nuevo` a un plantel ya armado. */
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
      if (cruce) roces.push({ a: existente.id, b: nuevo.id, rasgos: [x, y] });
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
export function quimica(plantel: readonly DefinicionContacto[]): Desglose[] {
  if (plantel.length === 0) return [];
  const conteo = contarPorRol(plantel);
  const desglose: Desglose[] = [];

  if (conteo.arquero === 0) {
    desglose.push({ concepto: "Ningún arquero natural", valor: -18 });
  } else if (conteo.arquero === 1) {
    desglose.push({ concepto: "Un solo arquero para dos equipos", valor: -7 });
  }

  const excesoDelanteros = Math.max(0, conteo.delantero - COMPOSICION_IDEAL.delantero);
  if (excesoDelanteros > 0) {
    desglose.push({
      concepto: `${excesoDelanteros} delantero(s) de más, nadie marca`,
      valor: -5 * excesoDelanteros,
    });
  }

  const faltaFondo = Math.max(0, COMPOSICION_IDEAL.defensor - conteo.defensor);
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
