/**
 * Traduce la moral en un único número de deterioro, de 0 a 1, que después
 * alimenta todos los tokens de CSS.
 *
 * Sin una sola referencia al DOM: escribir el valor en el documento es tarea de
 * App.svelte, que es el único lugar del juego que toca `document`. Así esta
 * curva se puede testear sin navegador, y el chequeo de tipos sin `lib: DOM`
 * garantiza que siga siendo así.
 */

/** Por encima de esta moral la interfaz está impecable. */
export const MORAL_INTACTA = 70;

/** Exponente > 1: el deterioro tarda en arrancar y se acelera al final. */
const CURVA = 1.4;

export function calcularDeterioro(moral: number): number {
  const crudo = (MORAL_INTACTA - moral) / MORAL_INTACTA;
  const limitado = Math.min(1, Math.max(0, crudo));
  return Math.round(limitado ** CURVA * 1000) / 1000;
}
