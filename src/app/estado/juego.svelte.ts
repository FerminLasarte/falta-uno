/**
 * El puente entre el núcleo y la vista. La vista nunca calcula nada del juego:
 * lee esta instantánea, que es un objeto plano. Cada comando la recalcula.
 */
import { Partida, type EventoFeed, type VistaContacto, type VistaRoster } from "../../core/partida.js";
import { formatearHora } from "../../core/tiempo.js";
import type { Contenido } from "../../datos/cargar.js";
import type { PerfilId } from "../../core/tipos.js";

export interface Vista {
  readonly hora: string;
  readonly minutos: number;
  readonly restante: number;
  readonly moral: number;
  readonly dinero: number;
  readonly roster: VistaRoster;
  readonly contactos: readonly VistaContacto[];
  readonly eventos: readonly EventoFeed[];
  readonly terminada: boolean;
}

class Juego {
  contenido = $state<Contenido | null>(null);
  vista = $state<Vista | null>(null);
  error = $state<string | null>(null);
  /** Chat abierto, o null si estás en la lista. */
  chatAbierto = $state<string | null>(null);

  #partida: Partida | null = null;

  async iniciar(perfilId: PerfilId = "pibe_de_barrio", semilla = String(Date.now())): Promise<void> {
    try {
      const contenido = await window.faltaUno.contenido();
      if (!contenido) throw new Error("el proceso principal no devolvió contenido");
      this.contenido = contenido;

      const perfil = contenido.perfiles.find((p) => p.id === perfilId) ?? contenido.perfiles[0];
      if (!perfil) throw new Error("no hay perfiles definidos");

      this.#partida = new Partida({
        perfil,
        agenda: contenido.contactos,
        interrupciones: contenido.interrupciones,
        config: contenido.config,
        semilla,
      });
      this.#refrescar();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  escribir(id: string): void {
    this.#comando(() => this.#partida?.escribir(id));
  }

  responder(id: string, opcionId: string): void {
    this.#comando(() => this.#partida?.responder(id, opcionId));
  }

  llamar(id: string): void {
    this.#comando(() => this.#partida?.llamar(id));
  }

  abrirChat(id: string): void {
    this.chatAbierto = id;
    this.#partida?.marcarLeido(id);
    this.#refrescar();
  }

  volverALista(): void {
    this.chatAbierto = null;
  }

  #comando(accion: () => unknown): void {
    accion();
    this.#refrescar();
  }

  #refrescar(): void {
    const p = this.#partida;
    if (!p) return;
    this.vista = {
      hora: formatearHora(p.reloj.minutos),
      minutos: p.reloj.minutos,
      restante: p.reloj.restante,
      moral: p.moral,
      dinero: p.dinero,
      roster: p.roster(),
      contactos: p.contactos(),
      eventos: p.eventos(),
      terminada: p.terminada,
    };
  }
}

export const juego = new Juego();
