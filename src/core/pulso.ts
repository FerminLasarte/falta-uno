/**
 * El pulso: el segundo reloj del viernes, en milisegundos reales.
 *
 * El reloj del juego avanza por acción y nunca en tiempo real: leer no puede
 * costar. Pero los mensajes tienen que llegar solos, apilarse y sonar, que es de
 * donde sale la ansiedad. El pulso es la cola de lo que está en camino y cuándo
 * llega. Regla: el tiempo real nunca toca recursos, solo cambia qué hay en
 * pantalla. Lo que pasa al llegar cada cosa lo decide la partida, no el pulso.
 *
 * El tiempo real entra solo por `avanzarHasta`/`tomarHasta`, como dato: el
 * núcleo nunca mira un reloj de pared. Tiene su propio RNG, derivado de la
 * semilla, para que lo rápido o lento que juegue cada uno no cambie lo que
 * pasa en las decisiones.
 */
import { Rng } from "./rng.js";

export interface Programada<T> {
  /** El chat donde va a aparecer. */
  readonly chat: string;
  /** Quién lo escribe. */
  readonly de: string;
  /** Desde cuándo se lo ve escribiendo. */
  readonly desdeMs: number;
  /** Cuándo llega. */
  readonly enMs: number;
  readonly carga: T;
  /** Desempate estable: dos cosas que llegan juntas salen en el orden en que se programaron. */
  readonly orden: number;
}

export interface Tipeo {
  readonly chat: string;
  readonly de: string;
}

/** Rango en ms reales: [mínimo, máximo]. */
export type Rango = readonly [number, number];

/** Lo que tarda alguien en leerte y ponerse a contestar. */
export const PENSAR: Rango = [700, 2200];

/** Tipear: una base más un tanto por letra, con techo para que un mensaje largo no se coma la pantalla. */
const TIPEO_BASE = 500;
const TIPEO_POR_LETRA = 22;
const TIPEO_MIN = 700;
const TIPEO_MAX = 2800;

export class Pulso<T> {
  private ahora = 0;
  private secuencia = 0;
  private cola: Programada<T>[] = [];
  private readonly rng: Rng;

  constructor(semilla: number | string) {
    this.rng = new Rng(`${semilla}:pulso`);
  }

  /** Milisegundos reales jugados. */
  get ms(): number {
    return this.ahora;
  }

  /**
   * Alguien escribe en un chat. Si ya estaba escribiendo ahí, sigue de corrido;
   * si no, primero piensa. Después tipea lo que le lleva el texto.
   */
  tipear(chat: string, de: string, texto: string, carga: T, pensar: Rango = PENSAR): void {
    const desde = this.ultimoEn(chat) ?? this.ahora + this.rng.entero(pensar[0], pensar[1]);
    const largo = TIPEO_BASE + TIPEO_POR_LETRA * texto.length;
    const tipeo = Math.min(TIPEO_MAX, Math.max(TIPEO_MIN, largo)) * (0.85 + this.rng.siguiente() * 0.3);
    this.cola.push({
      chat,
      de,
      desdeMs: desde,
      enMs: Math.round(desde + tipeo),
      carga,
      orden: this.secuencia++,
    });
  }

  /** Lo próximo que llega antes de `hasta`, ya sacado de la cola. El pulso queda parado en su llegada. */
  tomarHasta(hasta: number): Programada<T> | null {
    let indice = -1;
    for (let i = 0; i < this.cola.length; i++) {
      const p = this.cola[i]!;
      if (p.enMs > hasta) continue;
      const elegida = this.cola[indice];
      if (!elegida || p.enMs < elegida.enMs || (p.enMs === elegida.enMs && p.orden < elegida.orden)) {
        indice = i;
      }
    }
    if (indice === -1) return null;
    const [tomada] = this.cola.splice(indice, 1);
    this.ahora = Math.max(this.ahora, tomada!.enMs);
    return tomada!;
  }

  avanzarHasta(hasta: number): void {
    if (hasta < this.ahora) throw new Error("El pulso no retrocede");
    this.ahora = hasta;
  }

  /** Cuánto falta para la próxima llegada. Null si no hay nada en camino. */
  msHastaProxima(): number | null {
    if (this.cola.length === 0) return null;
    return Math.max(0, Math.min(...this.cola.map((p) => p.enMs)) - this.ahora);
  }

  /** Quién se ve escribiendo ahora mismo, un renglón por chat. */
  escribiendo(): Tipeo[] {
    const porChat = new Map<string, Tipeo>();
    for (const p of this.cola) {
      if (p.desdeMs <= this.ahora && !porChat.has(p.chat)) porChat.set(p.chat, { chat: p.chat, de: p.de });
    }
    return [...porChat.values()];
  }

  enCamino(chat: string): boolean {
    return this.cola.some((p) => p.chat === chat);
  }

  alguna(predicado: (carga: T) => boolean): boolean {
    return this.cola.some((p) => predicado(p.carga));
  }

  /** Saca de la cola lo que ya no tiene que llegar. */
  descartar(predicado: (carga: T) => boolean): void {
    this.cola = this.cola.filter((p) => !predicado(p.carga));
  }

  private ultimoEn(chat: string): number | null {
    const delChat = this.cola.filter((p) => p.chat === chat);
    if (delChat.length === 0) return null;
    return Math.max(...delChat.map((p) => p.enMs));
  }
}
