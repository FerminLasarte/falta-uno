/**
 * El puente entre el núcleo y la vista. La vista nunca calcula nada del juego:
 * lee esta instantánea, que es un objeto plano. Cada comando la recalcula.
 */
import {
  CHAT_GRUPO,
  Partida,
  type EventoFeed,
  type VistaContacto,
  type VistaPuesto,
  type VistaRoster,
} from "../../core/partida.js";
import { formatearHora } from "../../core/tiempo.js";
import type { Contenido } from "../../datos/cargar.js";
import type { PerfilId, Rol } from "../../core/tipos.js";

/** Dónde está parado el jugador adentro del teléfono. El juego abre en el grupo. */
export type Pantalla =
  | { readonly tipo: "grupo" }
  | { readonly tipo: "chats" }
  | { readonly tipo: "contacto"; readonly id: string }
  | { readonly tipo: "interrupcion"; readonly id: string };

/** Una interrupción que ya llegó: Sofi, el jefe, la cancha. Es un chat más. */
export interface VistaInterrupcion {
  readonly id: string;
  readonly de: string;
  readonly texto: string;
  readonly minuto: number;
  readonly costoAtender: number;
  /** Sigue drenando moral hasta que la atiendas. */
  readonly pendiente: boolean;
  readonly sinLeer: boolean;
}

export interface Vista {
  readonly hora: string;
  readonly minutos: number;
  readonly restante: number;
  readonly moral: number;
  readonly dinero: number;
  readonly roster: VistaRoster;
  readonly lista: readonly VistaPuesto[];
  readonly contactos: readonly VistaContacto[];
  readonly interrupciones: readonly VistaInterrupcion[];
  readonly eventos: readonly EventoFeed[];
  readonly grupoSinLeer: number;
  readonly terminada: boolean;
}

class Juego {
  contenido = $state<Contenido | null>(null);
  vista = $state<Vista | null>(null);
  error = $state<string | null>(null);
  pantalla = $state<Pantalla>({ tipo: "grupo" });

  #partida: Partida | null = null;
  #anterior: Pantalla = { tipo: "grupo" };
  /** Cuántos eventos del grupo ya viste. */
  #grupoVisto = 0;
  /** Interrupciones cuyo chat ya abriste. */
  #interrupcionesVistas = new Set<string>();

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

  // ------------------------------------------------------------ navegación

  ir(destino: Pantalla): void {
    this.#anterior = this.pantalla;
    this.pantalla = destino;
    this.#refrescar();
  }

  /** Vuelve a donde estabas. Desde el grupo, la bandeja; desde la bandeja, el grupo. */
  volver(): void {
    const actual = this.pantalla;
    let destino = this.#anterior;
    if (mismaPantalla(destino, actual)) {
      destino = actual.tipo === "grupo" ? { tipo: "chats" } : { tipo: "grupo" };
    }
    this.pantalla = destino;
    this.#anterior = { tipo: "grupo" };
    this.#refrescar();
  }

  // -------------------------------------------------------------- comandos

  escribir(id: string): void {
    this.#comando(() => this.#partida?.escribir(id));
  }

  responder(id: string, opcionId: string): void {
    this.#comando(() => this.#partida?.responder(id, opcionId));
  }

  llamar(id: string): void {
    this.#comando(() => this.#partida?.llamar(id));
  }

  atender(interrupcionId: string): void {
    this.#comando(() => this.#partida?.atender(interrupcionId));
  }

  pagarReemplazo(rol: Rol): void {
    this.#comando(() => this.#partida?.pagarVacante(rol));
  }

  #comando(accion: () => unknown): void {
    accion();
    this.#refrescar();
  }

  // -------------------------------------------------------------- snapshot

  #refrescar(): void {
    const p = this.#partida;
    const contenido = this.contenido;
    if (!p || !contenido) return;

    // Lo que está en pantalla se da por leído, también lo que llega mientras lo mirás.
    const actual = this.pantalla;
    const eventos = p.eventos();
    const delGrupo = eventos.filter((e) => e.chat === CHAT_GRUPO).length;
    if (actual.tipo === "contacto") p.marcarLeido(actual.id);
    if (actual.tipo === "interrupcion") this.#interrupcionesVistas.add(actual.id);
    if (actual.tipo === "grupo") this.#grupoVisto = delGrupo;

    const pendientes = new Set(p.interrupcionesActivas.map((i) => i.definicion.id));
    const interrupciones = contenido.interrupciones.flatMap((def): VistaInterrupcion[] => {
      const llegada = eventos.find((e) => e.chat === def.id && e.clase === "alerta");
      if (!llegada) return [];
      return [
        {
          id: def.id,
          de: def.de,
          texto: def.texto,
          minuto: llegada.minuto,
          costoAtender: def.costoAtender,
          pendiente: pendientes.has(def.id),
          sinLeer: !this.#interrupcionesVistas.has(def.id),
        },
      ];
    });

    this.vista = {
      hora: formatearHora(p.reloj.minutos),
      minutos: p.reloj.minutos,
      restante: p.reloj.restante,
      moral: p.moral,
      dinero: p.dinero,
      roster: p.roster(),
      lista: p.lista(),
      contactos: p.contactos(),
      interrupciones,
      eventos: [...eventos],
      grupoSinLeer: delGrupo - this.#grupoVisto,
      terminada: p.terminada,
    };
  }
}

function mismaPantalla(a: Pantalla, b: Pantalla): boolean {
  if (a.tipo !== b.tipo) return false;
  return !("id" in a) || !("id" in b) || a.id === b.id;
}

export const juego = new Juego();
