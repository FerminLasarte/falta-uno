/**
 * Cuánto de cada chat ya viste. Mirar es gratis y no cambia nada del juego, así
 * que el núcleo no se entera: es memoria de la vista, y se guarda con ella.
 *
 * Cada chat se mide en "cuántos mensajes suyos llegaron"; lo que cuenta como
 * suyo lo decide quien pregunta. Sin leer es lo que llegó menos lo que viste.
 */
export class Leidos {
  #vistos = new Map<string, number>();

  constructor(vistos: Readonly<Record<string, number>> = {}) {
    for (const [chat, cuantos] of Object.entries(vistos)) this.#vistos.set(chat, cuantos);
  }

  /** Lo tenés en pantalla: todo lo que llegó hasta ahora queda visto. */
  ver(chat: string, llegados: number): void {
    this.#vistos.set(chat, llegados);
  }

  sinLeer(chat: string, llegados: number): number {
    return Math.max(0, llegados - (this.#vistos.get(chat) ?? 0));
  }

  serializar(): Record<string, number> {
    return Object.fromEntries(this.#vistos);
  }

  /** Lee lo que guardó `serializar`. Si viene roto, arranca sin nada visto. */
  static desde(crudo: unknown): Leidos {
    if (typeof crudo !== "object" || crudo === null) return new Leidos();
    const validos = Object.entries(crudo).filter(
      (e): e is [string, number] => Number.isInteger(e[1]) && (e[1] as number) >= 0,
    );
    return new Leidos(Object.fromEntries(validos));
  }
}
