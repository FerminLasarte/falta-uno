import type { EntradaBitacora, TipoEvento } from "./tipos.js";

/**
 * Registro de por qué pasó cada cosa. Es lo que después permite que la
 * resolución narre atribuyendo a decisiones concretas en vez de tirar un dado
 * y describir el resultado en abstracto.
 */
export class Bitacora {
  private readonly entradas: EntradaBitacora[] = [];

  registrar(tipo: TipoEvento, minuto: number, contactoId?: string, detalle?: string): void {
    this.entradas.push({
      tipo,
      minuto,
      ...(contactoId !== undefined ? { contactoId } : {}),
      ...(detalle !== undefined ? { detalle } : {}),
    });
  }

  todas(): readonly EntradaBitacora[] {
    return this.entradas;
  }

  de(tipo: TipoEvento): readonly EntradaBitacora[] {
    return this.entradas.filter((e) => e.tipo === tipo);
  }

  deContacto(contactoId: string): readonly EntradaBitacora[] {
    return this.entradas.filter((e) => e.contactoId === contactoId);
  }

  contar(tipo: TipoEvento): number {
    return this.de(tipo).length;
  }

  serializar(): EntradaBitacora[] {
    return [...this.entradas];
  }

  static desde(entradas: readonly EntradaBitacora[]): Bitacora {
    const b = new Bitacora();
    b.entradas.push(...entradas);
    return b;
  }
}
