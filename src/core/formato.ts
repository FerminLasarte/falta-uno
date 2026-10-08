/**
 * Cómo se escribe la plata. A mano y no con toLocaleString: el núcleo pone
 * montos en el texto de los mensajes, y eso no puede depender de la máquina.
 */
export function formatearPesos(monto: number): string {
  const signo = monto < 0 ? "-" : "";
  const miles = String(Math.abs(Math.round(monto))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${signo}$${miles}`;
}
