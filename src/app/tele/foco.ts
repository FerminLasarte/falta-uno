/**
 * Las flechas ↑↓ mueven el foco entre los botones de una placa, y al llegar al último
 * vuelven al primero. Es lo que después toma el gamepad en la Deck.
 */
export function moverFoco(evento: KeyboardEvent, contenedor: HTMLElement | undefined): void {
  const paso = evento.key === "ArrowDown" ? 1 : evento.key === "ArrowUp" ? -1 : 0;
  if (paso === 0 || !contenedor) return;
  evento.preventDefault();
  const botones = [...contenedor.querySelectorAll<HTMLButtonElement>("button")];
  const actual = botones.indexOf(document.activeElement as HTMLButtonElement);
  botones[(actual + paso + botones.length) % botones.length]?.focus();
}

/** Con el mouse encima, la opción queda elegida como si hubieras llegado con las flechas. */
export const enfocarAlPasar = (e: MouseEvent): void => (e.currentTarget as HTMLElement).focus();
