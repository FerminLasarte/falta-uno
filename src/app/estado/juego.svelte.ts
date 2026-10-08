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
import type { Tipeo } from "../../core/pulso.js";
import { formatearHora } from "../../core/tiempo.js";
import type { Contenido } from "../../datos/cargar.js";
import type { PerfilId, Rol } from "../../core/tipos.js";
import { vistaPrevia } from "../mensajeria/rotulos.js";

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
  /** Lo último que escribió: el pedido, o lo que insistió después. */
  readonly texto: string;
  readonly minuto: number;
  readonly costoAtender: number;
  /** Sigue drenando moral hasta que la atiendas. */
  readonly pendiente: boolean;
  readonly sinLeer: number;
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
  /** Quién se ve escribiendo ahora, un renglón por chat. */
  readonly escribiendo: readonly Tipeo[];
  /** Los audios del grupo que ya escuchaste. */
  readonly audiosEscuchados: readonly string[];
  /** Calmar al grupo, si alguien se está peleando. */
  readonly calmar: { readonly texto: string; readonly costoReloj: number; readonly entre: readonly string[] } | null;
  readonly terminada: boolean;
}

/**
 * Algo que acaba de llegar por el pulso. El puente solo avisa; cómo se nota
 * (el aviso en pantalla, la vibración, el sonido) lo decide cada parte de la vista.
 */
export interface Llegada {
  readonly chat: string;
  readonly de: string;
  readonly texto: string;
  /** Alguien te reclama algo, o se bajó: se nota más fuerte que un mensaje. */
  readonly reclamo: boolean;
  /** Llegó al chat que tenés abierto: lo estás viendo, no hace falta avisar. */
  readonly aLaVista: boolean;
  /**
   * El grupo está silenciado, como todo grupo de fútbol: su charla aparece pero
   * no vibra ni suena. Los audios y las peleas sí.
   */
  readonly silenciada: boolean;
}

/** Cada cuánto le pasa el tiempo real al núcleo. */
const LATIDO_MS = 100;
/**
 * Tope de tiempo real por latido. Si la máquina se durmió o el hilo se trabó,
 * lo que estaba en camino no llega todo junto de golpe.
 */
const TOPE_LATIDO_MS = 250;

class Juego {
  contenido = $state<Contenido | null>(null);
  vista = $state<Vista | null>(null);
  error = $state<string | null>(null);
  pantalla = $state<Pantalla>({ tipo: "grupo" });

  #partida: Partida | null = null;
  #anterior: Pantalla = { tipo: "grupo" };
  /** Cuántos eventos del grupo ya viste. */
  #grupoVisto = 0;
  /** Cuántos mensajes de cada interrupción ya viste. */
  #interrupcionesVistas = new Map<string, number>();
  #ultimoLatido = 0;
  /** Quién estaba escribiendo en el último refresco, para no redibujar de más. */
  #firmaTipeo = "";
  #oyentes = new Set<(llegada: Llegada) => void>();

  /** Escuchar lo que llega en tiempo real. Devuelve cómo dejar de escuchar. */
  alLlegar(oyente: (llegada: Llegada) => void): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }

  /** La pantalla donde se lee un chat. */
  pantallaDe(chat: string): Pantalla {
    if (chat === CHAT_GRUPO) return { tipo: "grupo" };
    if (this.contenido?.interrupciones.some((i) => i.id === chat)) return { tipo: "interrupcion", id: chat };
    return { tipo: "contacto", id: chat };
  }

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
        grupo: contenido.grupo,
        config: contenido.config,
        semilla,
      });
      this.#refrescar();
      this.#ultimoLatido = performance.now();
      setInterval(() => this.#latir(), LATIDO_MS);
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

  escuchar(audioId: string): void {
    this.#comando(() => this.#partida?.escuchar(audioId));
  }

  calmar(): void {
    this.#comando(() => this.#partida?.calmar());
  }

  #comando(accion: () => unknown): void {
    accion();
    this.#refrescar();
  }

  /**
   * El tiempo real entra al núcleo como un comando más. Con la ventana oculta
   * no corre: lo que está en camino espera a que vuelvas.
   */
  #latir(): void {
    const ahora = performance.now();
    const delta = Math.min(ahora - this.#ultimoLatido, TOPE_LATIDO_MS);
    this.#ultimoLatido = ahora;
    const p = this.#partida;
    if (!p || p.terminada || document.hidden) return;
    const { nuevos } = p.transcurrir(delta);
    if (nuevos.length > 0 || firma(p.escribiendo()) !== this.#firmaTipeo) this.#refrescar();
    for (const evento of nuevos) this.#avisar(evento);
  }

  #avisar(evento: EventoFeed): void {
    const { chat } = evento;
    if (chat === undefined || evento.de === "Sistema") return;
    if (evento.clase !== "mensaje" && evento.clase !== "alerta") return;
    const pantalla = this.pantallaDe(chat);
    const llegada: Llegada = {
      chat,
      de: evento.de,
      texto: vistaPrevia(evento),
      reclamo: evento.clase === "alerta" || pantalla.tipo === "interrupcion",
      aLaVista: mismaPantalla(pantalla, this.pantalla),
      silenciada: chat === CHAT_GRUPO && !evento.audio && !evento.roce,
    };
    for (const oyente of this.#oyentes) oyente(llegada);
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
    if (actual.tipo === "grupo") this.#grupoVisto = delGrupo;

    const pendientes = new Set(p.interrupcionesActivas.map((i) => i.definicion.id));
    const interrupciones = contenido.interrupciones.flatMap((def): VistaInterrupcion[] => {
      const suyos = eventos.filter((e) => e.chat === def.id && e.de === def.de);
      const ultimo = suyos.at(-1);
      if (!ultimo) return [];
      if (actual.tipo === "interrupcion" && actual.id === def.id) {
        this.#interrupcionesVistas.set(def.id, suyos.length);
      }
      return [
        {
          id: def.id,
          de: def.de,
          texto: ultimo.texto,
          minuto: ultimo.minuto,
          costoAtender: def.costoAtender,
          pendiente: pendientes.has(def.id),
          sinLeer: suyos.length - (this.#interrupcionesVistas.get(def.id) ?? 0),
        },
      ];
    });

    const escribiendo = p.escribiendo();
    this.#firmaTipeo = firma(escribiendo);

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
      escribiendo,
      audiosEscuchados: eventos.flatMap((e) => (e.audio && p.escuchado(e.audio.id) ? [e.audio.id] : [])),
      calmar: p.accionCalmar,
      terminada: p.terminada,
    };
  }
}

function firma(tipeo: readonly Tipeo[]): string {
  return tipeo.map((t) => t.chat).join("|");
}

export function mismaPantalla(a: Pantalla, b: Pantalla): boolean {
  if (a.tipo !== b.tipo) return false;
  return !("id" in a) || !("id" in b) || a.id === b.id;
}

export const juego = new Juego();
