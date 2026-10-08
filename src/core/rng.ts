/** FNV-1a de 32 bits: un número estable a partir de un texto. */
export function hashTexto(texto: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * RNG determinista y serializable. Sin esto no se puede reproducir el bug que
 * reporta un jugador ni comparar corridas de balance.
 */
export class Rng {
  private estado: number;

  constructor(semilla: number | string) {
    this.estado = typeof semilla === "number" ? semilla >>> 0 : hashTexto(semilla);
    if (this.estado === 0) this.estado = 0x9e3779b9;
  }

  /** mulberry32 */
  siguiente(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [min, max] inclusive. */
  entero(min: number, max: number): number {
    return min + Math.floor(this.siguiente() * (max - min + 1));
  }

  /** true con probabilidad `porcentaje` (0-100). */
  ocurre(porcentaje: number): boolean {
    return this.siguiente() * 100 < porcentaje;
  }

  elegir<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.elegir recibió una lista vacía");
    return items[this.entero(0, items.length - 1)]!;
  }

  /** Fisher-Yates sobre una copia. */
  mezclar<T>(items: readonly T[]): T[] {
    const copia = [...items];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = this.entero(0, i);
      [copia[i], copia[j]] = [copia[j]!, copia[i]!];
    }
    return copia;
  }

  serializar(): number {
    return this.estado;
  }

  static desde(estado: number): Rng {
    const rng = new Rng(1);
    rng.estado = estado >>> 0;
    return rng;
  }
}
