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
  type VistaContacto,
  type VistaPuesto,
  type VistaRoster,
} from "../../core/partida.js";
import {
  cerrarFecha,
  nuevaCampana,
  rivalDe,
  type Campana,
  type CierreFecha,
} from "../../core/campana.js";
import { charlaDeInscripcion, type PasoInscripcion } from "../../core/inscripcion.js";
import { FORMATO_ARCHIVO, nombreDeArchivo, esMarca, type Build, type MarcaVista, type ViernesArchivado } from "../../core/archivo.js";
import type { Tipeo } from "../../core/pulso.js";
import { FORMATO_GUARDADO, huella, leerGuardado, Registro, type Guardado, type Paso } from "../../core/registro.js";
import { resolver, type Resolucion } from "../../core/resolucion.js";
import { formatearHora } from "../../core/tiempo.js";
import type { Contenido } from "../../datos/cargar.js";
import { opcionesDeViernes } from "../../core/viernes.js";
import { nombreDelGrupo, type Apodos } from "../../core/apodos.js";
import { COMPETENCIAS, configDeViernes, FORMATOS, type Competencia, type Formato, type Modo } from "../../core/modo.js";
import { agendaDe } from "../../core/perfiles.js";
import { pesos } from "../mensajeria/rotulos.js";
import { grupo } from "./grupo.svelte.js";
import type { MotivoFin, PerfilId, Rol } from "../../core/tipos.js";
import { vistaPrevia } from "../mensajeria/rotulos.js";
import { Leidos } from "./leidos.js";

/** Dónde está parado el jugador adentro del teléfono. El juego abre en el grupo. */
export type Pantalla =
  | { readonly tipo: "grupo" }
  | { readonly tipo: "chats" }
  | { readonly tipo: "contacto"; readonly id: string }
  | { readonly tipo: "interrupcion"; readonly id: string }
  /** El nombre del grupo, cómo te dicen y los apodos. */
  | { readonly tipo: "info" }
  /** Después de las 21:00: el partido, contado. */
  | { readonly tipo: "partido" }
  /** Entre una fecha y otra: el teléfono bloqueado el viernes siguiente, un momento antes de las 19. */
  | { readonly tipo: "semana" }
  /** La campaña terminó: por moral, por deuda o porque el equipo se disolvió. */
  | { readonly tipo: "fin" };

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

/** Un personaje de la agenda, para ponerle el apodo de un amigo. */
export interface Personaje {
  readonly id: string;
  /** Cómo se llama el personaje: lo que se ve si no le ponés apodo. */
  readonly personaje: string;
  readonly retrato: string;
  readonly rol: Rol;
  /** El apodo que le pusiste, o vacío. */
  readonly apodo: string;
}

/** "Info del grupo": el nombre, cómo te dicen y quién es quién. */
export interface InfoDelGrupo {
  readonly nombre: string;
  readonly vos: string;
  readonly personajes: readonly Personaje[];
  /** Los apodos se cambian antes de jugar el viernes: con el viernes empezado, solo se miran. */
  readonly editable: boolean;
}

/**
 * Antes del primer viernes: la charla con la cancha, que pregunta qué buscan,
 * de cuánto es la cancha y cómo van a pagar, y después "Info del grupo" para
 * poner los apodos. Todavía no hay partida: se arma al final, con todo elegido.
 */
export interface Eleccion {
  /** El chat de la interrupción de la cancha, que es donde sigue la charla. */
  readonly chat: string;
  readonly de: string;
  readonly hora: string;
  readonly restante: number;
  readonly eventos: readonly EventoFeed[];
  readonly paso: PasoInscripcion | "grupo";
  /** Las respuestas del paso: lo que contestás y, debajo, qué implica. */
  readonly opciones: readonly { readonly id: string; readonly texto: string; readonly titulo: string; readonly resumen: string }[];
  readonly nota: string;
  /** En el último paso: el grupo, para poner los apodos. */
  readonly grupo: InfoDelGrupo | null;
}

export interface Vista {
  /** La hora de la barra de estado. */
  readonly hora: string;
  /** La misma, en minutos del día: después del partido no es la del reloj del viernes. */
  readonly minutosEnBarra: number;
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
  /** Cerrar la lista: con los diez, o cuando ya no queda nada por hacer. Cuesta lo que falta para las 21:00. */
  readonly cerrar: { readonly texto: string; readonly costoReloj: number; readonly completa: boolean } | null;
  readonly terminada: boolean;
  /** Por qué terminó el viernes, si terminó. */
  readonly motivoFin: MotivoFin | null;
  /** El partido, cuando el viernes ya terminó. */
  readonly resolucion: Resolucion | null;
  /** Cuántos momentos del relato ya viste: al volver, no se repiten. */
  readonly relatoVisto: number;
  /** Ya fuiste a la cancha esta fecha: lo que pasó a las 21:00 ya se vio. */
  readonly fuisteALaCancha: boolean;
  /** Si ya viste cómo terminó la campaña: al volver, se va directo al resumen. */
  readonly finVisto: boolean;
  /** Terminado el viernes, cómo cerraría la fecha: lo que se paga, lo que se gana y cómo queda la campaña. */
  readonly cierre: CierreFecha | null;
  readonly campana: Campana;
  /** "Info del grupo", para mirar o cambiar los apodos. */
  readonly infoDelGrupo: InfoDelGrupo;
  /** Un partido suelto: termina esta noche, no hay fecha que viene. */
  readonly partidoSuelto: boolean;
  /** A qué hora arrancó el viernes: depende del formato. */
  readonly horaInicio: number;
  /** El chat con la cancha y quién escribe en él: el de la inscripción y el de "¿confirman la 21?". */
  readonly cancha: { readonly chat: string; readonly de: string };
  /** Lo que sale la cancha en el formato que se juega. */
  readonly sena: number;
  /** El torneo que se juega, con el rival de esta fecha. */
  readonly torneo: { readonly nombre: string; readonly fecha: string; readonly cancha: string; readonly complejo: string; readonly rival: string };
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

/** Lo que tardan en arrancar después de las 21:00, y lo que dura el partido más volver a mirar el teléfono. */
const MINUTOS_HASTA_ARRANCAR = 5;
const MINUTOS_DE_PARTIDO = 45;

/** Cuánto del relato ya viste, y si viste cómo terminó la campaña. Se guarda con lo leído, como un chat más. */
const RELATO = "partido";
const FIN = "fin";

/** El único archivo de guardado. Viaja por Steam Cloud. */
const ARCHIVO = "partida.json";

class Juego {
  contenido = $state<Contenido | null>(null);
  vista = $state<Vista | null>(null);
  eleccion = $state<Eleccion | null>(null);
  /** El menú está abierto: el tiempo real no corre. */
  pausado = $state(false);
  error = $state<string | null>(null);
  pantalla = $state<Pantalla>({ tipo: "grupo" });

  #registro: Registro | null = null;
  #campana: Campana | null = null;
  /** La fecha y la plata con las que arrancó el viernes en curso: con eso se arma igual al retomarlo. */
  #viernes: { readonly fecha: number; readonly dinero: number } | null = null;
  /** La semilla de la próxima campaña, mientras se elige el perfil. */
  #semillaNueva = "";
  /** Lo que se va eligiendo en la charla con la cancha, antes de que haya campaña. */
  #elegido: { modo: Partial<Modo>; perfil: PerfilId | null } = { modo: {}, perfil: null };
  /** Huella del contenido con el que se juega este viernes. */
  #huella = "";
  #anterior: Pantalla = { tipo: "grupo" };
  #leidos = new Leidos();
  #ultimoLatido = 0;
  /** Lo que sobró de milisegundo en el último latido: el tiempo se le pasa al núcleo entero. */
  #resto = 0;
  /** El partido, resuelto una sola vez cuando termina el viernes. */
  #resolucion: Resolucion | null = null;
  /** Ya fuiste a la cancha: la hora no vuelve a las 21:00 aunque vuelvas al grupo. */
  #fuisteALaCancha = false;
  /** Quién estaba escribiendo en el último refresco, para no redibujar de más. */
  #firmaTipeo = "";
  #oyentes = new Set<(llegada: Llegada) => void>();
  /** Qué pantalla se estaba mirando y desde cuándo, para el archivo de viernes jugados. */
  #marcas: MarcaVista[] = [];
  /** Cuándo empezó el viernes en curso, en la hora de la máquina. */
  #empezado = "";
  #build: Build = { version: "?", commit: "?", plataforma: "?" };

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
      const v = await window.faltaUno.versiones();
      this.#build = { version: v.app, commit: v.commit, plataforma: `${v.plataforma}-${v.arquitectura}` };

      if (!this.#retomar(contenido, await window.faltaUno.cargar(ARCHIVO))) {
        this.#semillaNueva = semilla;
        this.#elegido = { modo: {}, perfil: null };
        this.eleccion = eleccionDe(contenido, this.#elegido);
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
   * Contestaste algo en la charla con la cancha: qué buscan, de cuánto es la
   * cancha o cómo pagan (el perfil). Después del perfil viene "Info del grupo".
   */
  elegir(id: string): void {
    const contenido = this.contenido;
    const eleccion = this.eleccion;
    if (!contenido || !eleccion) return;
    const { modo } = this.#elegido;
    if (eleccion.paso === "competencia" && (COMPETENCIAS as readonly string[]).includes(id)) {
      this.#elegido = { modo: { competencia: id as Competencia }, perfil: null };
    } else if (eleccion.paso === "formato" && (FORMATOS as readonly string[]).includes(id)) {
      this.#elegido = { modo: { ...modo, formato: id as Formato }, perfil: null };
    } else if (eleccion.paso === "perfil" && contenido.perfiles.some((p) => p.id === id)) {
      this.#elegido = { modo, perfil: id as PerfilId };
    } else return;
    this.eleccion = eleccionDe(contenido, this.#elegido);
  }

  /**
   * Listo el grupo: con el modo, el perfil y los apodos se arma la campaña.
   * Arranca el viernes y te quedás en la charla con la cancha, que te contesta.
   */
  empezar(apodos: Apodos): void {
    const contenido = this.contenido;
    const { modo, perfil: perfilId } = this.#elegido;
    const perfil = contenido?.perfiles.find((p) => p.id === perfilId);
    if (!contenido || !perfil || !modo.competencia || !modo.formato || this.eleccion?.paso !== "grupo") return;
    const campana = nuevaCampana(perfil, this.#semillaNueva, {
      modo: { competencia: modo.competencia, formato: modo.formato },
      apodos,
    });
    this.#arrancar(contenido, campana);
    this.#mostrar({ tipo: "interrupcion", id: contenido.inscripcion.chat });
    this.eleccion = null;
    this.#ultimoLatido = performance.now();
    this.#refrescar();
    this.#guardar();
  }

  /**
   * Cambiás los apodos desde "Info del grupo". Solo antes de jugar el viernes:
   * con el viernes empezado, los textos ya salieron con los nombres de antes.
   * El viernes se arma de nuevo con los nombres nuevos.
   */
  cambiarApodos(apodos: Apodos): void {
    const contenido = this.contenido;
    const campana = this.#campana;
    if (!contenido || !campana || !this.#puedeCambiarApodos()) return;
    const pantalla = this.pantalla;
    this.#arrancar(contenido, { ...campana, apodos });
    this.pantalla = pantalla;
    this.#refrescar();
    this.#guardar();
  }

  /** Si todavía no hiciste nada este viernes: lo único que pasó es tiempo. */
  #puedeCambiarApodos(): boolean {
    const p = this.#partida;
    return !!p && !p.terminada && (this.#registro?.pasos.every((paso) => paso[0] === "t") ?? false);
  }

  /**
   * Cerrás la fecha que se jugó: se paga la cancha, se cobra el premio y la
   * campaña pasa al viernes siguiente, o termina.
   */
  siguienteFecha(): void {
    const contenido = this.contenido;
    const campana = this.#campana;
    const p = this.#partida;
    const resolucion = this.#resolucion;
    if (!contenido || !campana || !p?.terminada || !resolucion || campana.fin) return;
    const cierre = cerrarFecha(campana, p, resolucion, p.config);
    if (cierre.campana.fin) {
      this.#campana = cierre.campana;
      this.#mostrar({ tipo: "fin" });
    } else {
      this.#arrancar(contenido, cierre.campana);
      this.#mostrar({ tipo: "semana" });
    }
    this.#refrescar();
    this.#guardar();
  }

  /**
   * Empieza otra campaña: vuelve la charla con la cancha. La que estaba se
   * pisa recién cuando elegís el perfil; hasta ahí, cerrar el juego la conserva.
   */
  campanaNueva(): void {
    const contenido = this.contenido;
    if (!contenido) return;
    this.#registro = null;
    this.#campana = null;
    this.#viernes = null;
    this.vista = null;
    this.pausado = false;
    this.#semillaNueva = String(Date.now());
    this.#elegido = { modo: {}, perfil: null };
    this.eleccion = eleccionDe(contenido, this.#elegido);
  }

  /** Arma el viernes de la fecha en la que está la campaña, desde cero. */
  #arrancar(contenido: Contenido, campana: Campana): void {
    const perfil = contenido.perfiles.find((p) => p.id === campana.perfil);
    if (!perfil) throw new Error(`no existe el perfil "${campana.perfil}"`);
    this.#campana = campana;
    this.#viernes = { fecha: campana.fecha, dinero: campana.dinero };
    this.#registro = new Registro(new Partida(opcionesDeViernes(contenido, perfil, campana.semilla, this.#viernes, campana)));
    this.#resolucion = null;
    this.#marcas = [];
    this.#empezado = new Date().toISOString();
    this.#fuisteALaCancha = false;
    this.#leidos = new Leidos();
    this.#anterior = { tipo: "grupo" };
    this.#ultimoLatido = performance.now();
  }

  /** Retoma la campaña guardada, con su viernes donde quedó. */
  #retomar(contenido: Contenido, archivo: { contenido: string | null }): boolean {
    const guardado = archivo.contenido === null ? null : leerGuardado(archivo.contenido);
    if (!guardado) return false;
    const { campana, viernes } = guardado;
    const perfil = contenido.perfiles.find((p) => p.id === campana.perfil);
    if (!perfil) return false;

    const { registro, aplicados } = Registro.reproducir(
      opcionesDeViernes(contenido, perfil, campana.semilla, viernes, campana),
      viernes.pasos,
    );
    if (aplicados < viernes.pasos.length) {
      console.info(
        `[guardado] el contenido cambió (${viernes.contenido} → ${this.#huella}): ` +
          `se retomó en el paso ${aplicados} de ${viernes.pasos.length}`,
      );
    }
    this.#registro = registro;
    this.#campana = campana;
    this.#viernes = { fecha: viernes.fecha, dinero: viernes.dinero };
    this.#resolucion = null;
    this.#restaurarVista(guardado.vista, contenido);
    if (campana.fin) this.pantalla = { tipo: "fin" };
    // Se retomó: desde acá, lo que se ve es lo que quedó abierto.
    this.#marcar();
    return true;
  }

  #restaurarVista(crudo: unknown, contenido: Contenido): void {
    if (typeof crudo !== "object" || crudo === null) return;
    const { pantalla, leidos, cancha, marcas, empezado } = crudo as Record<string, unknown>;
    this.#leidos = Leidos.desde(leidos);
    this.#fuisteALaCancha = cancha === true;
    this.#marcas = Array.isArray(marcas) ? marcas.filter(esMarca) : [];
    if (typeof empezado === "string") this.#empezado = empezado;
    if (typeof pantalla !== "object" || pantalla === null) return;
    const { tipo, id } = pantalla as Record<string, unknown>;
    if (tipo === "grupo" || tipo === "chats" || tipo === "partido") this.pantalla = { tipo };
    // Si se cerró con el teléfono bloqueado entre fechas, se abre ya desbloqueado.
    else if (tipo === "semana") this.pantalla = { tipo: "grupo" };
    else if (tipo === "contacto" && contenido.contactos.some((c) => c.id === id)) this.pantalla = { tipo, id: id as string };
    else if (tipo === "interrupcion" && contenido.interrupciones.some((i) => i.id === id)) this.pantalla = { tipo, id: id as string };
  }

  /** Escribe el viernes entero. `ya` espera a que termine: es para cuando se cierra la ventana. */
  #guardar(ya = false): void {
    const registro = this.#registro;
    const campana = this.#campana;
    const viernes = this.#viernes;
    if (!registro || !campana || !viernes) return;
    const guardado: Guardado = {
      formato: FORMATO_GUARDADO,
      campana,
      viernes: { ...viernes, contenido: this.#huella, pasos: registro.pasos },
      vista: {
        pantalla: this.pantalla,
        leidos: this.#leidos.serializar(),
        cancha: this.#fuisteALaCancha,
        marcas: this.#marcas,
        empezado: this.#empezado,
      },
    };
    const texto = JSON.stringify(guardado);
    if (ya) window.faltaUno.guardarYa(ARCHIVO, texto);
    else void window.faltaUno.guardar(ARCHIVO, texto);

    // El mismo viernes, en su propio archivo: el guardado lo pisa al pasar de fecha, este queda.
    const archivado: ViernesArchivado = {
      formato: FORMATO_ARCHIVO,
      build: this.#build,
      campana: {
        semilla: campana.semilla,
        perfil: campana.perfil,
        modo: campana.modo,
        ...(campana.apodos ? { apodos: campana.apodos } : {}),
      },
      viernes: guardado.viernes,
      marcas: this.#marcas,
      empezado: this.#empezado,
      actualizado: new Date().toISOString(),
      terminado: registro.partida.terminada,
    };
    const nombre = nombreDeArchivo(campana.semilla, viernes.fecha);
    if (ya) window.faltaUno.archivarYa(nombre, JSON.stringify(archivado));
    else void window.faltaUno.archivar(nombre, JSON.stringify(archivado));
  }

  /** Cambia de pantalla y lo anota. */
  #mostrar(destino: Pantalla): void {
    this.pantalla = destino;
    this.#marcar();
  }

  /** Anota qué se está mirando desde ahora. Fuera de un viernes no hay nada que anotar. */
  #marcar(): void {
    const registro = this.#registro;
    if (!registro) return;
    const pantalla = "id" in this.pantalla ? `${this.pantalla.tipo}:${this.pantalla.id}` : this.pantalla.tipo;
    if (this.#marcas.at(-1)?.pantalla === pantalla) return;
    this.#marcas.push({ ms: registro.ms, paso: registro.pasos.length, pantalla });
  }

  // ------------------------------------------------------------ navegación

  ir(destino: Pantalla): void {
    if (destino.tipo === "partido") this.#fuisteALaCancha = true;
    this.#anterior = this.pantalla;
    this.#mostrar(destino);
    this.#refrescar();
  }

  /** Vuelve a donde estabas. Desde el grupo, la bandeja; desde la bandeja, el grupo. */
  volver(): void {
    const actual = this.pantalla;
    let destino = this.#anterior;
    if (mismaPantalla(destino, actual)) {
      destino = actual.tipo === "grupo" ? { tipo: "chats" } : { tipo: "grupo" };
    }
    this.#mostrar(destino);
    this.#anterior = { tipo: "grupo" };
    this.#refrescar();
  }

  /** Pasó la semana: el teléfono se desbloquea en el grupo, a las 19. */
  desbloquear(): void {
    this.#anterior = { tipo: "grupo" };
    this.#mostrar({ tipo: "grupo" });
    this.#ultimoLatido = performance.now();
    this.#refrescar();
    this.#guardar();
  }

  /**
   * Ya viste hasta ese momento del relato, o cómo terminó la campaña. Se guarda:
   * al retomar no se vuelve a contar.
   */
  marcarVisto(que: "relato" | "fin", cuantos = 1): void {
    this.#leidos.ver(que === "relato" ? RELATO : FIN, cuantos);
    this.#refrescar();
    this.#guardar();
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

  cerrarLista(): void {
    this.#comando(["cerrar"]);
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
    // Con el menú abierto o el teléfono bloqueado entre fechas, el tiempo real espera.
    if (!registro || !p || p.terminada || document.hidden || this.pausado || this.pantalla.tipo === "semana") return;
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
    const campana = this.#campana;
    if (!p || !contenido || !campana) return;
    grupo.nombre = nombreDelGrupo(campana.apodos, campana.modo);

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

    if (p.terminada && !this.#resolucion) this.#resolucion = resolver(p);
    const escribiendo = p.escribiendo();
    this.#firmaTipeo = firma(escribiendo);

    // Desde que fuiste a la cancha, la hora va con el relato: arranca un rato después
    // de las 21 y avanza con cada minuto contado. Volver al grupo no la atrasa.
    const minutos = this.#fuisteALaCancha
      ? horaDelPartido(contenido, this.#resolucion, this.#leidos.visto(RELATO))
      : p.reloj.minutos;
    this.vista = {
      hora: formatearHora(minutos),
      minutosEnBarra: minutos,
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
      cerrar: p.accionCerrar,
      terminada: p.terminada,
      motivoFin: p.motivoFin,
      resolucion: this.#resolucion,
      relatoVisto: this.#leidos.visto(RELATO),
      finVisto: this.#leidos.visto(FIN) > 0,
      fuisteALaCancha: this.#fuisteALaCancha,
      cierre: this.#resolucion ? cerrarFecha(campana, p, this.#resolucion, p.config) : null,
      campana,
      sena: p.config.senaCancha,
      infoDelGrupo: infoDelGrupo(contenido, campana, p.contactos().map((c) => c.id), this.#puedeCambiarApodos()),
      partidoSuelto: campana.modo.competencia === "partido",
      horaInicio: p.config.horaInicio,
      cancha: canchaDe(contenido),
      torneo: torneoDe(contenido, campana),
    };
  }
}

/** La charla con la cancha en el paso en que va, con las respuestas de ese paso. */
function eleccionDe(contenido: Contenido, elegido: { modo: Partial<Modo>; perfil: PerfilId | null }): Eleccion {
  const { inscripcion, config, perfiles } = contenido;
  const { de } = canchaDe(contenido);
  const { modo, perfil } = elegido;
  // Se anota antes de que arranque el viernes más temprano: el de la cancha grande.
  const hora = Math.min(config.horaInicio, ...FORMATOS.map((f) => config.formatos[f].horaInicio ?? config.horaInicio));
  const paso: Eleccion["paso"] = !modo.competencia ? "competencia" : !modo.formato ? "formato" : !perfil ? "perfil" : "grupo";
  const completo = modo.competencia && modo.formato ? { competencia: modo.competencia, formato: modo.formato } : null;
  const configModo = completo ? configDeViernes(config, completo) : undefined;
  const charla = charlaDeInscripcion(inscripcion, paso === "grupo" ? "perfil" : paso, modo, configModo);
  const eventos: EventoFeed[] = charla.map((r) => ({
    minuto: hora,
    de: r.tuyo ? "Vos" : de,
    texto: r.texto,
    clase: r.tuyo ? "propio" : "mensaje",
    chat: inscripcion.chat,
  }));

  let opciones: Eleccion["opciones"] = [];
  let nota = "";
  if (paso === "competencia") {
    opciones = COMPETENCIAS.map((c) => ({ id: c, texto: inscripcion.competencias[c].respuesta, titulo: inscripcion.competencias[c].titulo, resumen: inscripcion.competencias[c].resumen }));
    nota = "El partido es una noche; el torneo, fecha a fecha";
  } else if (paso === "formato" && modo.competencia) {
    const competencia = modo.competencia;
    opciones = FORMATOS.map((f) => {
      const c = configDeViernes(config, { competencia, formato: f });
      const cuantos = c.suplentes > 0 ? `van ${c.jugadoresNecesarios}: ${c.jugadoresNecesarios - c.suplentes} y ${c.suplentes} suplentes` : `van ${c.jugadoresNecesarios}`;
      const temprano = c.horaInicio < config.horaInicio ? ` · desde ${formatearHora(c.horaInicio)}` : "";
      return { id: f, texto: inscripcion.formatos[f], titulo: `${inscripcion.competencias[competencia].titulo} ${f.toUpperCase()}`, resumen: `${cuantos} · seña ${pesos(c.senaCancha)}${temprano}` };
    });
    nota = "Cuantos más van, más cuesta llenar la lista";
  } else if (paso === "perfil") {
    opciones = perfiles.map((p) => ({ id: p.id, texto: p.respuesta, titulo: p.nombre, resumen: p.resumen }));
    nota = "Lo elegís una vez por campaña";
  }

  const perfilElegido = perfiles.find((p) => p.id === perfil);
  const grupo =
    paso === "grupo" && perfilElegido && completo
      ? infoDelGrupo(contenido, { modo: completo }, agendaDe(perfilElegido, perfiles, contenido.contactos).map((c) => c.id), true)
      : null;
  return { chat: inscripcion.chat, de, hora: formatearHora(hora), restante: config.horaCorte - hora, eventos, paso, opciones, nota, grupo };
}

/** "Info del grupo" para una campaña: los personajes de su agenda, con los apodos que tengan. */
function infoDelGrupo(
  contenido: Contenido,
  campana: { readonly modo: Modo; readonly apodos?: Apodos },
  ids: readonly string[],
  editable: boolean,
): InfoDelGrupo {
  const { apodos, modo } = campana;
  const personajes = ids.flatMap((id): Personaje[] => {
    const c = contenido.contactos.find((x) => x.id === id);
    return c ? [{ id, personaje: c.nombre, retrato: c.retrato ?? "", rol: c.rol, apodo: apodos?.contactos?.[id] ?? "" }] : [];
  });
  // Por nombre, como una agenda: sin el artículo, "El Tano" va con la te.
  const clave = (p: Personaje): string => p.personaje.replace(/^(el|la)\s+/i, "");
  personajes.sort((a, b) => clave(a).localeCompare(clave(b), "es"));
  return { nombre: nombreDelGrupo(apodos, modo), vos: apodos?.vos ?? "", personajes, editable };
}

/** El chat con la cancha: la inscripción y la interrupción comparten el mismo. */
function canchaDe(contenido: Contenido): Vista["cancha"] {
  const { chat } = contenido.inscripcion;
  return { chat, de: contenido.interrupciones.find((i) => i.id === chat)?.de ?? "" };
}

/** El torneo como se lo ve en la app: su nombre, la fecha que se juega y contra quién. Un partido suelto es una sola noche. */
function torneoDe(contenido: Contenido, campana: Campana): Vista["torneo"] {
  const { torneo } = contenido;
  const fecha = campana.fecha;
  if (campana.modo.competencia === "partido") {
    return {
      nombre: "Partido",
      fecha: contenido.config.formatos[campana.modo.formato].nombre,
      cancha: `${torneo.complejo} · ${torneo.cancha}`,
      complejo: torneo.complejo,
      rival: rivalDe(torneo, fecha),
    };
  }
  return {
    nombre: torneo.nombre,
    fecha: `Fecha ${fecha}`,
    cancha: `${torneo.complejo} · ${torneo.cancha}`,
    complejo: torneo.complejo,
    rival: rivalDe(torneo, fecha),
  };
}

/** La hora mientras se cuenta el partido: la del último minuto que viste, o la del final. */
function horaDelPartido(contenido: Contenido, resolucion: Resolucion | null, visto: number): number {
  const { horaCorte } = contenido.config;
  const narracion = resolucion?.hayPartido ? resolucion.narracion : [];
  if (visto >= narracion.length) return horaCorte + MINUTOS_DE_PARTIDO;
  return horaCorte + MINUTOS_HASTA_ARRANCAR + (narracion[visto - 1]?.minuto ?? 0);
}

/** El chat que se está leyendo en esa pantalla. La bandeja, el partido y la info del grupo no son ninguno. */
function chatDe(pantalla: Pantalla): string | null {
  if (pantalla.tipo === "grupo") return CHAT_GRUPO;
  return pantalla.tipo === "contacto" || pantalla.tipo === "interrupcion" ? pantalla.id : null;
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
