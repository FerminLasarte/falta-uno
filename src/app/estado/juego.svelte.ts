/**
 * El puente entre el núcleo y la vista. La vista nunca calcula nada del juego:
 * lee esta instantánea, que es un objeto plano. Cada comando la recalcula.
 *
 * También guarda: cada comando pasa por el registro, que anota lo que hiciste,
 * y después de cada uno el viernes se escribe entero. Al abrir, si hay un
 * viernes a medias, se retoma donde quedó.
 */
import {
  CHAT_GRUPO,
  Partida,
  type EventoFeed,
  type OpcionesPartida,
  type VistaContacto,
  type VistaPuesto,
  type VistaRoster,
} from "../../core/partida.js";
import { textosDeInscripcion } from "../../core/inscripcion.js";
import { agendaDe } from "../../core/perfiles.js";
import type { Tipeo } from "../../core/pulso.js";
import { FORMATO_GUARDADO, huella, leerGuardado, Registro, type Guardado, type Paso } from "../../core/registro.js";
import { formatearHora } from "../../core/tiempo.js";
import type { Contenido } from "../../datos/cargar.js";
import type { DefinicionPerfil, PerfilId, Rol } from "../../core/tipos.js";
import { vistaPrevia } from "../mensajeria/rotulos.js";
import { Leidos } from "./leidos.js";

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
  /** Llegó y la atendiste. Antes de llegar, el chat puede tener otra charla: la inscripción. */
  readonly atendida: boolean;
  readonly sinLeer: number;
}

/** Un contacto con lo que te escribió y todavía no viste. */
export interface ContactoEnVista extends VistaContacto {
  readonly sinLeer: number;
}

/**
 * Antes del primer viernes: la charla con la cancha que pregunta cómo van a
 * pagar. Cada respuesta es un perfil, y todavía no hay partida.
 */
export interface Eleccion {
  /** El chat de la interrupción de la cancha, que es donde sigue la charla. */
  readonly chat: string;
  readonly de: string;
  readonly hora: string;
  readonly restante: number;
  readonly eventos: readonly EventoFeed[];
  readonly perfiles: readonly { readonly id: PerfilId; readonly texto: string; readonly titulo: string; readonly resumen: string }[];
}

export interface Vista {
  readonly hora: string;
  readonly minutos: number;
  readonly restante: number;
  readonly moral: number;
  readonly dinero: number;
  readonly roster: VistaRoster;
  readonly lista: readonly VistaPuesto[];
  readonly contactos: readonly ContactoEnVista[];
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

/** El único archivo de guardado. Viaja por Steam Cloud. */
const ARCHIVO = "partida.json";

class Juego {
  contenido = $state<Contenido | null>(null);
  vista = $state<Vista | null>(null);
  eleccion = $state<Eleccion | null>(null);
  error = $state<string | null>(null);
  pantalla = $state<Pantalla>({ tipo: "grupo" });

  #registro: Registro | null = null;
  #semilla = "";
  /** Huella del contenido con el que se juega este viernes. */
  #huella = "";
  #anterior: Pantalla = { tipo: "grupo" };
  #leidos = new Leidos();
  #ultimoLatido = 0;
  /** Lo que sobró de milisegundo en el último latido: el tiempo se le pasa al núcleo entero. */
  #resto = 0;
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

  get #partida(): Partida | null {
    return this.#registro?.partida ?? null;
  }

  /**
   * Arranca el juego. Si hay un viernes guardado, lo retoma donde quedó; si no,
   * abre la charla con la cancha para elegir el perfil.
   */
  async iniciar(semilla = String(Date.now())): Promise<void> {
    try {
      const contenido = await window.faltaUno.contenido();
      if (!contenido) throw new Error("el proceso principal no devolvió contenido");
      this.contenido = contenido;
      this.#huella = huella(JSON.stringify(contenido));

      if (!this.#retomar(contenido, await window.faltaUno.cargar(ARCHIVO))) {
        this.#semilla = semilla;
        this.eleccion = eleccionDe(contenido);
      }
      this.#refrescar();
      this.#ultimoLatido = performance.now();
      setInterval(() => this.#latir(), LATIDO_MS);
      // Al ocultar la ventana se guarda lo que pasó desde el último comando. Al
      // cerrarla, igual, pero esperando a que termine: después ya no hay a quién avisar.
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.#guardar();
      });
      addEventListener("pagehide", () => this.#guardar(true));
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Elegiste cómo pagar la seña: ese es tu perfil. Arranca el viernes y te
   * quedás en la charla con la cancha, que te contesta.
   */
  elegir(perfilId: PerfilId): void {
    const contenido = this.contenido;
    const perfil = contenido?.perfiles.find((p) => p.id === perfilId);
    if (!contenido || !perfil || !this.eleccion) return;
    this.#registro = new Registro(new Partida(opcionesDe(contenido, perfil, this.#semilla)));
    this.pantalla = { tipo: "interrupcion", id: contenido.inscripcion.chat };
    this.eleccion = null;
    this.#ultimoLatido = performance.now();
    this.#refrescar();
    this.#guardar();
  }

  /** Retoma el viernes guardado, si hay uno que se pueda leer. */
  #retomar(contenido: Contenido, archivo: { contenido: string | null }): boolean {
    const guardado = archivo.contenido === null ? null : leerGuardado(archivo.contenido);
    if (!guardado) return false;
    const { viernes } = guardado;
    const perfil = contenido.perfiles.find((p) => p.id === viernes.perfil);
    if (!perfil) return false;

    const { registro, aplicados } = Registro.reproducir(opcionesDe(contenido, perfil, viernes.semilla), viernes.pasos);
    if (aplicados < viernes.pasos.length) {
      console.info(
        `[guardado] el contenido cambió (${viernes.contenido} → ${this.#huella}): ` +
          `se retomó en el paso ${aplicados} de ${viernes.pasos.length}`,
      );
    }
    this.#registro = registro;
    this.#semilla = viernes.semilla;
    this.#restaurarVista(guardado.vista, contenido);
    return true;
  }

  #restaurarVista(crudo: unknown, contenido: Contenido): void {
    if (typeof crudo !== "object" || crudo === null) return;
    const { pantalla, leidos } = crudo as Record<string, unknown>;
    this.#leidos = Leidos.desde(leidos);
    if (typeof pantalla !== "object" || pantalla === null) return;
    const { tipo, id } = pantalla as Record<string, unknown>;
    if (tipo === "grupo" || tipo === "chats") this.pantalla = { tipo };
    else if (tipo === "contacto" && contenido.contactos.some((c) => c.id === id)) this.pantalla = { tipo, id: id as string };
    else if (tipo === "interrupcion" && contenido.interrupciones.some((i) => i.id === id)) this.pantalla = { tipo, id: id as string };
  }

  /** Escribe el viernes entero. `ya` espera a que termine: es para cuando se cierra la ventana. */
  #guardar(ya = false): void {
    const p = this.#partida;
    const registro = this.#registro;
    if (!p || !registro) return;
    const guardado: Guardado = {
      formato: FORMATO_GUARDADO,
      viernes: { perfil: p.perfil.id, semilla: this.#semilla, contenido: this.#huella, pasos: registro.pasos },
      vista: { pantalla: this.pantalla, leidos: this.#leidos.serializar() },
    };
    const texto = JSON.stringify(guardado);
    if (ya) window.faltaUno.guardarYa(ARCHIVO, texto);
    else void window.faltaUno.guardar(ARCHIVO, texto);
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
    this.#comando(["escribir", id]);
  }

  responder(id: string, opcionId: string): void {
    this.#comando(["responder", id, opcionId]);
  }

  llamar(id: string): void {
    this.#comando(["llamar", id]);
  }

  atender(interrupcionId: string): void {
    this.#comando(["atender", interrupcionId]);
  }

  pagarReemplazo(rol: Rol): void {
    this.#comando(["pagar", rol]);
  }

  escuchar(audioId: string): void {
    this.#comando(["escuchar", audioId]);
  }

  calmar(): void {
    this.#comando(["calmar"]);
  }

  /** Todo lo que hace el jugador pasa por acá: se anota, se dibuja y se guarda. */
  #comando(paso: Paso): void {
    const resultado = this.#registro?.hacer(paso);
    this.#refrescar();
    if (resultado?.ok) this.#guardar();
  }

  /**
   * El tiempo real entra al núcleo como un comando más. Con la ventana oculta
   * no corre: lo que está en camino espera a que vuelvas.
   */
  #latir(): void {
    const ahora = performance.now();
    const delta = Math.min(ahora - this.#ultimoLatido, TOPE_LATIDO_MS);
    this.#ultimoLatido = ahora;
    const registro = this.#registro;
    const p = this.#partida;
    if (!registro || !p || p.terminada || document.hidden) return;
    // Milisegundos enteros: así se pueden sumar en el registro sin que el redondeo cambie nada.
    const ms = Math.floor(delta + this.#resto);
    this.#resto = delta + this.#resto - ms;
    const { nuevos } = registro.hacer(["t", ms]);
    if (nuevos.length > 0 || firma(p.escribiendo()) !== this.#firmaTipeo) this.#refrescar();
    for (const evento of nuevos) this.#avisar(evento);
    // Si el viernes terminó solo (te quedaste sin moral leyendo), se guarda como quedó.
    if (p.terminada) this.#guardar();
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
    const eventos = p.eventos();
    const llegados = llegadosPorChat(eventos);
    const cuantos = (chat: string): number => llegados.get(chat) ?? 0;
    const abierto = chatDe(this.pantalla);
    if (abierto !== null) this.#leidos.ver(abierto, cuantos(abierto));
    const sinLeer = (chat: string): number => this.#leidos.sinLeer(chat, cuantos(chat));

    const pendientes = new Set(p.interrupcionesActivas.map((i) => i.definicion.id));
    const interrupciones = contenido.interrupciones.flatMap((def): VistaInterrupcion[] => {
      const ultimo = eventos.findLast((e) => e.chat === def.id && e.de === def.de);
      if (!ultimo) return [];
      return [
        {
          id: def.id,
          de: def.de,
          texto: ultimo.texto,
          minuto: ultimo.minuto,
          costoAtender: def.costoAtender,
          pendiente: pendientes.has(def.id),
          atendida: p.atendida(def.id),
          sinLeer: sinLeer(def.id),
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
      contactos: p.contactos().map((c) => ({ ...c, sinLeer: sinLeer(c.id) })),
      interrupciones,
      eventos: [...eventos],
      grupoSinLeer: sinLeer(CHAT_GRUPO),
      escribiendo,
      audiosEscuchados: eventos.flatMap((e) => (e.audio && p.escuchado(e.audio.id) ? [e.audio.id] : [])),
      calmar: p.accionCalmar,
      terminada: p.terminada,
    };
  }
}

function eleccionDe(contenido: Contenido): Eleccion {
  const { inscripcion, config } = contenido;
  const de = contenido.interrupciones.find((i) => i.id === inscripcion.chat)?.de ?? "";
  return {
    chat: inscripcion.chat,
    de,
    hora: formatearHora(config.horaInicio),
    restante: config.horaCorte - config.horaInicio,
    eventos: textosDeInscripcion(inscripcion, config).map((texto) => ({
      minuto: config.horaInicio,
      de,
      texto,
      clase: "mensaje",
      chat: inscripcion.chat,
    })),
    perfiles: contenido.perfiles.map((p) => ({ id: p.id, texto: p.respuesta, titulo: p.nombre, resumen: p.resumen })),
  };
}

/**
 * Todo lo que hace falta para armar un viernes. Es lo mismo al empezarlo y al
 * retomarlo: si cambiara, el guardado no daría la misma partida.
 */
function opcionesDe(contenido: Contenido, perfil: DefinicionPerfil, semilla: string): OpcionesPartida {
  return {
    perfil,
    agenda: agendaDe(perfil, contenido.perfiles, contenido.contactos),
    inscripcion: contenido.inscripcion,
    interrupciones: contenido.interrupciones,
    grupo: contenido.grupo,
    config: contenido.config,
    semilla,
  };
}

/** El chat que se está leyendo en esa pantalla. La bandeja no es ninguno. */
function chatDe(pantalla: Pantalla): string | null {
  if (pantalla.tipo === "grupo") return CHAT_GRUPO;
  if (pantalla.tipo === "chats") return null;
  return pantalla.id;
}

/**
 * Cuánto llegó a cada chat. En el grupo cuenta todo, como siempre contó el
 * grupo; en los demás, lo que te escribió otro: ni lo tuyo ni los avisos.
 */
function llegadosPorChat(eventos: readonly EventoFeed[]): Map<string, number> {
  const llegados = new Map<string, number>();
  for (const e of eventos) {
    if (e.chat === undefined) continue;
    if (e.chat !== CHAT_GRUPO && (e.clase === "propio" || e.de === "Sistema")) continue;
    llegados.set(e.chat, (llegados.get(e.chat) ?? 0) + 1);
  }
  return llegados;
}

function firma(tipeo: readonly Tipeo[]): string {
  return tipeo.map((t) => t.chat).join("|");
}

export function mismaPantalla(a: Pantalla, b: Pantalla): boolean {
  if (a.tipo !== b.tipo) return false;
  return !("id" in a) || !("id" in b) || a.id === b.id;
}

export const juego = new Juego();
