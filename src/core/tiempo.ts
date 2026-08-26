/**
 * El reloj del viernes. Avanza por acción, nunca en tiempo real: un cronómetro
 * castigaría al jugador por leer, que es justo lo que el juego le pide hacer.
 */

/** Costos base en minutos virtuales. El contenido puede sobreescribirlos. */
export const COSTO = {
  mensaje: 2,
  insistir: 4,
  llamar: 8,
  atenderPareja: 15,
  atenderTrabajo: 20,
  pagarVacante: 5,
} as const;

export function aMinutos(hora: number, minuto: number): number {
  return hora * 60 + minuto;
}

export function formatearHora(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export class Reloj {
  private actual: number;

  constructor(
    readonly inicio: number,
    readonly corte: number,
  ) {
    if (corte <= inicio) throw new Error("El corte tiene que ser posterior al inicio");
    this.actual = inicio;
  }

  get minutos(): number {
    return this.actual;
  }

  get restante(): number {
    return Math.max(0, this.corte - this.actual);
  }

  get agotado(): boolean {
    return this.actual >= this.corte;
  }

  /** Devuelve los minutos realmente consumidos (recortados al corte). */
  avanzar(minutos: number): number {
    if (minutos < 0) throw new Error("El reloj no retrocede");
    const consumido = Math.min(minutos, this.restante);
    this.actual += consumido;
    return consumido;
  }

  toString(): string {
    return formatearHora(this.actual);
  }

  serializar(): number {
    return this.actual;
  }

  static desde(inicio: number, corte: number, actual: number): Reloj {
    const reloj = new Reloj(inicio, corte);
    reloj.actual = Math.min(Math.max(actual, inicio), corte);
    return reloj;
  }
}
