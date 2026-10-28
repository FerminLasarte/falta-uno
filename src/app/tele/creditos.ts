/**
 * Los créditos salen de arte/CREDITOS.md, que es la única lista de lo que no es propio:
 * cada fila de su tabla es alguien en la formación. Así no hay dos listas que se separen.
 */

export interface Aporte {
  readonly asset: string;
  readonly autor: string;
  /** El sitio de donde salió, sin el link: en la tele no se toca. */
  readonly fuente: string;
  readonly licencia: string;
}

/** `[Sketchfab](https://…)` → `Sketchfab`. */
const sinLink = (celda: string): string => celda.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();

/** Las filas de la tabla, salteando la cabecera y la línea de guiones. */
export function aportes(markdown: string): Aporte[] {
  return markdown
    .split("\n")
    .filter((linea) => linea.trim().startsWith("|"))
    .map((linea) => linea.trim().replace(/^\||\|$/g, "").split("|").map(sinLink))
    .filter((celdas) => celdas.length === 4 && !/^-+$/.test(celdas[0]!) && celdas[0] !== "Asset")
    .map(([asset, autor, fuente, licencia]) => ({ asset: asset!, autor: autor!, fuente: fuente!, licencia: licencia! }));
}
