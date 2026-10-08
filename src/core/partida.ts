import { Bitacora } from "./bitacora.js";
import {
  costoDeEscuchar,
  GRUPO_QUIETO,
  VOZ_POR_DEFECTO,
  type DefinicionAudio,
  type DefinicionGrupo,
  type Disparador,
  type MensajeGrupo,
  type PlantillaRoce,
} from "./grupo.js";
import { FRASES_POR_DEFECTO, type Frases } from "./frases.js";
import type { InscripcionResuelta } from "./inscripcion.js";
import type { DefinicionInterrupcion, InterrupcionActiva } from "./interrupciones.js";
import { Pulso, type Rango, type Tipeo } from "./pulso.js";
import { Rng } from "./rng.js";
import { faltantes, habilidadPromedio, rocesAlSumar, type Roce } from "./roster.js";
import { COSTO, formatearHora, Reloj } from "./tiempo.js";
import type {
  Condicion,
  Config,
  DefinicionContacto,
  DefinicionPerfil,
  Efectos,
  EstadoDeContacto,
  Invitado,
  MotivoFin,
  OpcionDialogo,
  Rasgo,
  Rol,
} from "./tipos.js";

export interface OpcionesPartida {
  readonly perfil: DefinicionPerfil;
  readonly agenda: readonly DefinicionContacto[];
  readonly interrupciones: readonly DefinicionInterrupcion[];
  readonly config: Config;
  readonly semilla: number | string;
  /** La vida propia del grupo. Sin ella, el grupo solo anuncia. */
  readonly grupo?: DefinicionGrupo;
  /** La charla con la cancha con la que arranca la campaña. Solo el primer viernes la tiene. */
  readonly inscripcion?: InscripcionResuelta;
  /** La plata con la que llegás al viernes, si no es la inicial del perfil. Negativa es deuda. */
  readonly dineroInicial?: number;
  /** Tu voz: el saludo, la llamada, la baja genérica. */
  readonly frases?: Frases;
}

/** El chat del grupo del equipo, donde se arma la lista. */
export const CHAT_GRUPO = "grupo";

export interface EventoFeed {
  readonly minuto: number;
  readonly de: string;
  readonly texto: string;
  readonly clase: "mensaje" | "propio" | "sistema" | "alerta";
  /**
   * La conversación a la que pertenece: el id de un contacto, el de una
   * interrupción o CHAT_GRUPO. Sin chat es un aviso de la partida entera.
   */
  readonly chat?: string;
  /** Es un audio: lo que dice está en `texto`, pero recién se sabe escuchándolo. */
  readonly audio?: {
    readonly id: string;
    readonly segundos: number;
    /** Minutos de reloj que cuesta escucharlo. */
    readonly costo: number;
    /** La voz de quien lo mandó, en Hz. */
    readonly voz: number;
  };
  /** El mensaje al que contesta citándolo. */
  readonly cita?: { readonly de: string; readonly texto: string };
  /** Es parte de una pelea en el grupo. */
  readonly roce?: true;
  /** Las 21:00: se cerró la lista y el chat no se mueve más. */
  readonly cierre?: true;
}

export interface ResultadoComando {
  readonly ok: boolean;
  readonly error?: string;
  /** Eventos generados por este comando, en orden. */
  readonly nuevos: readonly EventoFeed[];
}

export interface VistaOpcion {
  readonly id: string;
  readonly texto: string;
  readonly costoReloj: number;
}

export interface VistaContacto {
  readonly id: string;
  readonly nombre: string;
  readonly rol: Rol;
  readonly estado: EstadoDeContacto["estado"];
  /** Lo último que dijo, para el preview de la lista. */
  readonly ultimoMensaje: string | null;
  readonly minutoUltimo: number | null;
  /** Te está por llegar algo suyo: está pensando o escribiendo. */
  readonly enCamino: boolean;
  readonly opciones: readonly VistaOpcion[];
}

/** Un lugar ocupado en la lista, en el orden en que se anotó. */
export interface VistaPuesto {
  readonly id: string;
  readonly nombre: string;
  readonly rol: Rol;
  /** Alguien que entró pagando, no un contacto de la agenda. */
  readonly relleno: boolean;
  /** Si lo trajo alguien de la agenda, quién. */
  readonly traidoPor?: string;
}

export interface VistaRoster {
  readonly confirmados: number;
  readonly necesarios: number;
  readonly faltantes: readonly { rol: Rol; faltan: number }[];
  /** Cuántos suplentes faltan, además de los puestos. */
  readonly suplentes: number;
}

/**
 * Lo que está en camino por el pulso. Hasta que llega, no existe para el juego:
 * no se le puede contestar, no drena y no cuesta leerlo.
 */
type Entrega =
  | { readonly tipo: "mensaje"; readonly contacto: string; readonly texto: string }
  | { readonly tipo: "interrupcion"; readonly id: string }
  | { readonly tipo: "insistencia"; readonly id: string; readonly indice: number }
  | { readonly tipo: "baja"; readonly contacto: string; readonly texto: string; readonly porque?: string }
  /** El que trajo alguien avisa que no viene. */
  | { readonly tipo: "falta"; readonly invitado: string; readonly texto: string }
  /** Un confirmado avisa que se está por bajar. */
  | { readonly tipo: "duda"; readonly contacto: string; readonly texto: string }
  /** Un mensaje suelto de alguien que no está en la agenda, como la cancha. */
  | { readonly tipo: "texto"; readonly chat: string; readonly de: string; readonly texto: string }
  | {
      readonly tipo: "grupo";
      /** Id de quien escribe. */
      readonly de: string;
      readonly texto: string;
      readonly audio?: DefinicionAudio;
      readonly cita?: { readonly de: string; readonly texto: string };
      /** Un aviso del sistema que cae justo después de este mensaje. */
      readonly aviso?: string;
      readonly roce?: true;
    };

/** Una interrupción no cae en el mismo instante que tu toque: llega un rato después. */
const LLEGADA_INTERRUPCION: Rango = [1500, 5000];

const CLAMP_MORAL = { min: 0, max: 100 } as const;

/** Moral que cuesta una pelea en el grupo. Se cobra una vez por confirmación. */
const COSTO_MORAL_POR_ROCE = 3;

/**
 * Cuánta espera cuenta como una acción: lo que cuesta mandar un mensaje. Así
 * esperar media hora con Sofi reclamando drena como quince mensajes, no como uno.
 */
const ESPERA_POR_ACCION = COSTO.mensaje;

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

/**
 * Lo que cuesta leer un mensaje. Según el diseño, la moral se va con los
 * mensajes LARGOS y con las quejas, no con cualquier mensaje: si leer siempre
 * costara, el juego castigaría al jugador por hacer justo lo que le pide.
 */
const LARGO_TOLERABLE = 80;

export function costoDeLeer(
  mensaje: string,
  definicion: DefinicionContacto,
  estado: EstadoDeContacto,
): number {
  const exceso = mensaje.length - LARGO_TOLERABLE;
  if (exceso <= 0) return 0;
  const base = Math.min(2, Math.ceil(exceso / 100));
  const recargo = definicion.rasgos.includes("quejoso") || estado.enojo > 40 ? 1 : 0;
  return base + recargo;
}

export class Partida {
  readonly perfil: DefinicionPerfil;
  readonly config: Config;
  readonly reloj: Reloj;
  readonly bitacora = new Bitacora();

  private readonly agenda = new Map<string, DefinicionContacto>();
  private readonly estados = new Map<string, EstadoDeContacto>();
  private readonly interrupcionesPosibles: readonly DefinicionInterrupcion[];
  private readonly disparadas = new Set<string>();
  private readonly atendidas = new Set<string>();
  private readonly rng: Rng;
  private readonly pulso: Pulso<Entrega>;
  private readonly feed: EventoFeed[] = [];
  private readonly sintéticos: DefinicionContacto[] = [];
  /** Los que trajo alguien de la agenda, y quién: juegan si él juega. */
  private readonly traidos = new Map<string, string>();
  /** Cómo es cada invitado, para saber si a las 20:30 viene. */
  private readonly invitados = new Map<string, Invitado>();
  /** Los invitados que al final no vinieron. */
  private readonly faltaron = new Set<string>();
  /** Ids en el orden en que entraron a la lista. Puede tener bajas: lista() las filtra. */
  private readonly ordenLista: string[] = [];
  private readonly grupo: DefinicionGrupo;
  private readonly frases: Frases;
  private readonly charlasDisparadas = new Set<string>();
  /** Los audios que ya llegaron al grupo: quién los mandó y si los escuchaste. */
  private readonly audios = new Map<string, { readonly definicion: DefinicionAudio; readonly de: string; escuchado: boolean }>();
  /** Los que se están peleando en el grupo hasta que alguien los calme. */
  private rocesActivos: Roce[] = [];
  /** Los confirmados que ya avisaron que dudan, o tienen el aviso en camino. Avisa una vez cada uno. */
  private readonly dudosos = new Set<string>();
  /** Los avisos que ya llegaron: lo que el jugador pudo leer. */
  private readonly _avisaron: string[] = [];

  private _moral: number;
  private _dinero: number;
  private _terminada = false;
  private _motivoFin: MotivoFin | null = null;
  private _revisionHecha = false;

  interrupcionesActivas: InterrupcionActiva[] = [];

  constructor(opciones: OpcionesPartida) {
    this.perfil = opciones.perfil;
    this.config = opciones.config;
    this.rng = new Rng(opciones.semilla);
    this.pulso = new Pulso(opciones.semilla);
    this.reloj = new Reloj(opciones.config.horaInicio, opciones.config.horaCorte);
    this.interrupcionesPosibles = opciones.interrupciones;
    this.grupo = opciones.grupo ?? GRUPO_QUIETO;
    this.frases = opciones.frases ?? FRASES_POR_DEFECTO;
    this._moral = opciones.perfil.moralInicial;
    this._dinero = opciones.dineroInicial ?? opciones.perfil.dineroInicial;

    for (const contacto of opciones.agenda) {
      this.agenda.set(contacto.id, contacto);
      this.estados.set(contacto.id, {
        id: contacto.id,
        estado: "sin_contactar",
        probabilidadBaja: contacto.probabilidadBajaInicial,
        enojo: 0,
        dineroAportado: 0,
        nodoActual: null,
        elegidas: [],
        historial: [],
      });
    }

    if (opciones.inscripcion) this.inscribir(opciones.inscripcion);
    this.emitir(
      "sistema",
      `Son las ${this.reloj}. Tenés ${this.config.jugadoresNecesarios} lugares que llenar.`,
      "Sistema",
      CHAT_GRUPO,
    );
    // El grupo ya está hablando cuando abrís el teléfono.
    this.dispararCharlas();
  }

  // ---------------------------------------------------------------- lecturas

  get moral(): number {
    return this._moral;
  }
  get dinero(): number {
    return this._dinero;
  }
  get terminada(): boolean {
    return this._terminada;
  }
  get motivoFin(): MotivoFin | null {
    return this._motivoFin;
  }
  get semillaActual(): number {
    return this.rng.serializar();
  }

  definicion(id: string): DefinicionContacto {
    const d = this.agenda.get(id);
    if (!d) throw new Error(`No existe el contacto "${id}"`);
    return d;
  }

  estadoDe(id: string): EstadoDeContacto {
    const e = this.estados.get(id);
    if (!e) throw new Error(`No existe el contacto "${id}"`);
    return e;
  }

  /** Plantel confirmado: contactos reales, los cubiertos con plata y los que trajo alguien que viene. */
  plantel(): DefinicionContacto[] {
    const reales = [...this.estados.values()]
      .filter((e) => e.estado === "confirmado")
      .map((e) => this.definicion(e.id));
    return [...reales, ...this.sintéticos.filter((s) => this.vieneSintetico(s.id))];
  }

  /** Un pagado viene siempre; uno que trajo alguien, solo si ese alguien viene y él no faltó. */
  private vieneSintetico(id: string): boolean {
    const quien = this.traidos.get(id);
    return quien === undefined || (this.estados.get(quien)?.estado === "confirmado" && !this.faltaron.has(id));
  }

  roster(): VistaRoster {
    const plantel = this.plantel();
    const { porPuesto, suplentes } = faltantes(plantel, this.config.composicion, this.config.jugadoresNecesarios);
    return {
      confirmados: plantel.length,
      necesarios: this.config.jugadoresNecesarios,
      faltantes: porPuesto,
      suplentes,
    };
  }

  /** La lista del grupo: los que confirmaron, en el orden en que se anotaron. */
  lista(): VistaPuesto[] {
    const rellenos = new Map(this.sintéticos.map((s) => [s.id, s]));
    return this.ordenLista.flatMap((id): VistaPuesto[] => {
      const relleno = rellenos.get(id);
      if (relleno) {
        if (!this.vieneSintetico(id)) return [];
        const quien = this.traidos.get(id);
        return quien === undefined
          ? [{ id, nombre: relleno.nombre, rol: relleno.rol, relleno: true }]
          : [{ id, nombre: relleno.nombre, rol: relleno.rol, relleno: false, traidoPor: this.definicion(quien).nombre }];
      }
      if (this.estadoDe(id).estado !== "confirmado") return [];
      const d = this.definicion(id);
      return [{ id, nombre: d.nombre, rol: d.rol, relleno: false }];
    });
  }

  contactos(): VistaContacto[] {
    return [...this.agenda.values()].map((d) => {
      const e = this.estadoDe(d.id);
      const ultimo = e.historial.at(-1);
      return {
        id: d.id,
        nombre: d.nombre,
        rol: d.rol,
        estado: e.estado,
        ultimoMensaje: ultimo?.texto ?? null,
        minutoUltimo: ultimo?.minuto ?? null,
        enCamino: this.enCamino(d.id),
        opciones: this.opcionesDisponibles(d.id).map((o) => ({
          id: o.id,
          texto: o.texto,
          costoReloj: o.costoReloj,
        })),
      };
    });
  }

  opcionesDisponibles(id: string): OpcionDialogo[] {
    const estado = this.estadoDe(id);
    if (this._terminada || estado.nodoActual === null) return [];
    // No se contesta lo que todavía no llegó.
    if (this.pulso.enCamino(id)) return [];
    const nodo = this.definicion(id).nodos[estado.nodoActual];
    if (!nodo) return [];
    return nodo.opciones.filter((o) => !o.requiere || this.cumple(o.requiere, id));
  }

  eventos(): readonly EventoFeed[] {
    return this.feed;
  }

  /** Si esa interrupción llegó y la atendiste. */
  atendida(interrupcionId: string): boolean {
    return this.atendidas.has(interrupcionId);
  }

  /** Si ya escuchaste ese audio del grupo. */
  escuchado(audioId: string): boolean {
    return this.audios.get(audioId)?.escuchado ?? false;
  }

  /** Los audios que llegaron y todavía no escuchaste, del más viejo al más nuevo. */
  audiosSinEscuchar(): { id: string; de: string; segundos: number; costo: number }[] {
    return [...this.audios.entries()]
      .filter(([, a]) => !a.escuchado)
      .map(([id, a]) => ({
        id,
        de: this.definicion(a.de).nombre,
        segundos: a.definicion.segundos,
        costo: costoDeEscuchar(a.definicion.segundos),
      }));
  }

  /** Calmar al grupo, si hay alguien peleándose, y quiénes son. Null si no hay nada que calmar. */
  /** Los que te escribieron que no saben si llegan, en el orden en que avisaron. */
  get avisaron(): readonly string[] {
    return this._avisaron;
  }

  get accionCalmar(): { texto: string; costoReloj: number; entre: string[] } | null {
    if (this.rocesActivos.length === 0) return null;
    const ids = new Set(this.rocesActivos.flatMap((r) => [r.a, r.b]));
    return {
      texto: this.grupo.calmar.texto,
      costoReloj: this.grupo.calmar.costoReloj,
      entre: [...ids].map((id) => this.definicion(id).nombre),
    };
  }

  /**
   * Cerrar la lista: con los diez, o cuando ya no queda nada por hacer para
   * llegar (nadie a quien escribirle, nadie con quien seguir, ni plata para un
   * reemplazo). Cuesta lo que falta para las 21:00. Null si todavía no se puede.
   */
  get accionCerrar(): { texto: string; costoReloj: number; completa: boolean } | null {
    if (this._terminada) return null;
    const completa = this.roster().confirmados >= this.config.jugadoresNecesarios;
    if (!completa && this.quedaAlgoPorHacer()) return null;
    return { texto: this.grupo.cerrar.texto, costoReloj: this.reloj.restante, completa };
  }

  /** Si todavía se puede hacer algo para llenar la lista. */
  private quedaAlgoPorHacer(): boolean {
    if (this._dinero >= this.config.costoVacante) return true;
    return [...this.estados.values()].some(
      (e) => e.estado === "sin_contactar" || this.enCamino(e.id) || this.opcionesDisponibles(e.id).length > 0,
    );
  }

  /** Quién se ve escribiendo ahora, un renglón por chat. Terminado el viernes, ya nadie. */
  escribiendo(): Tipeo[] {
    return this._terminada ? [] : this.pulso.escribiendo();
  }

  /** Si hay algo de ese chat que todavía no llegó. Terminado el viernes, ya no va a llegar. */
  enCamino(chat: string): boolean {
    return !this._terminada && this.pulso.enCamino(chat);
  }

  /** Cuántos ms reales faltan para que llegue algo. Null si no hay nada en camino. */
  msHastaProximaEntrega(): number | null {
    return this.pulso.msHastaProxima();
  }

  habilidadDelPlantel(): number {
    return habilidadPromedio(this.plantel());
  }

  // --------------------------------------------------------------- comandos

  /** Le escribís por primera vez: abre la conversación. */
  escribir(id: string): ResultadoComando {
    return this.ejecutar(() => {
      const estado = this.estadoDe(id);
      if (estado.estado !== "sin_contactar") {
        return this.fallo(`Ya le escribiste a ${this.definicion(id).nombre}.`);
      }
      const definicion = this.definicion(id);
      this.emitir("propio", this.frases.saludo, definicion.nombre, id);
      this.consumir(COSTO.mensaje);
      estado.estado = "esperando";
      estado.nodoActual = definicion.aperturas?.find((a) => this.cumple(a.si, id))?.nodo ?? definicion.nodoInicial;
      this.entregarNodo(id);
      return this.exito();
    });
  }

  /** Elegís una respuesta rápida del árbol de diálogo. */
  responder(id: string, opcionId: string): ResultadoComando {
    return this.ejecutar(() => {
      const opcion = this.opcionesDisponibles(id).find((o) => o.id === opcionId);
      if (!opcion) return this.fallo(`Esa respuesta no está disponible.`);

      const definicion = this.definicion(id);
      const estado = this.estadoDe(id);

      this.emitir("propio", opcion.texto, definicion.nombre, id);
      estado.elegidas.push(opcion.id);
      this.consumir(opcion.costoReloj);
      this.aplicarEfectos(id, opcion.efectos);

      if (estado.estado === "confirmado") {
        this.registrarConfirmacion(id);
      } else if (estado.estado === "rechazado") {
        this.emitir("alerta", `${definicion.nombre} no viene.`, "Sistema", id);
      }

      // La charla sigue por el primer desvío que se cumpla, ya con lo que provocó esta respuesta.
      estado.nodoActual = Array.isArray(opcion.siguiente)
        ? (opcion.siguiente.find((d) => !d.si || this.cumple(d.si, id))?.nodo ?? null)
        : (opcion.siguiente as string | null);
      if (estado.nodoActual !== null) this.entregarNodo(id);
      return this.exito();
    });
  }

  /** Llamarlo por teléfono: caro en reloj y en moral, pero lo asegura. */
  llamar(id: string): ResultadoComando {
    return this.ejecutar(() => {
      const estado = this.estadoDe(id);
      const definicion = this.definicion(id);
      if (estado.estado === "rechazado" || estado.estado === "bajado") {
        return this.fallo(`${definicion.nombre} ya te dijo que no.`);
      }
      this.emitir("propio", this.frases.llamada.tuya.replaceAll("{nombre}", definicion.nombre), definicion.nombre, id);
      // Lo que se arregla en la llamada vale desde que atiende: si la llamada
      // cruza las 20:30, la revisión ya lo encuentra tranquilo.
      estado.probabilidadBaja = limitar(estado.probabilidadBaja - 30, 0, 100);
      this.consumir(COSTO.llamar);
      this.ajustarMoral(-3);
      estado.enojo = limitar(estado.enojo + 10, 0, 100);
      this.bitacora.registrar("apuro", this.reloj.minutos, id, "lo llamaste por teléfono");
      this.emitir("mensaje", this.frases.llamada.respuesta, definicion.nombre, id);
      return this.exito();
    });
  }

  /** Pagás para tapar un agujero: entra un desconocido. */
  pagarVacante(rol: Rol): ResultadoComando {
    return this.ejecutar(() => {
      if (this._dinero < this.config.costoVacante) {
        return this.fallo(`No te alcanza. Necesitás $${this.config.costoVacante}.`);
      }
      this._dinero -= this.config.costoVacante;
      this.consumir(COSTO.pagarVacante);
      const numero = this.sintéticos.length + 1;
      const relleno: DefinicionContacto = {
        id: `relleno_${numero}`,
        nombre: `Un amigo de un amigo (${rol})`,
        rol,
        habilidad: this.rng.entero(35, 55),
        rasgos: [],
        probabilidadBajaInicial: 0,
        nodoInicial: "",
        nodos: {},
      };
      this.sintéticos.push(relleno);
      this.ordenLista.push(relleno.id);
      this.bitacora.registrar("plata", this.reloj.minutos, relleno.id, `pagaste un ${rol}`);
      this.emitir(
        "sistema",
        `Pagaste $${this.config.costoVacante}. Entra ${relleno.nombre}.`,
        "Sistema",
        CHAT_GRUPO,
      );
      return this.exito();
    });
  }

  /** Atendés una interrupción pendiente: cuesta reloj, frena el drenaje y la insistencia. */
  atender(interrupcionId: string): ResultadoComando {
    return this.ejecutar(() => {
      const indice = this.interrupcionesActivas.findIndex(
        (i) => i.definicion.id === interrupcionId,
      );
      if (indice === -1) return this.fallo("Eso ya no está pendiente.");
      const activa = this.interrupcionesActivas[indice]!;
      this.interrupcionesActivas.splice(indice, 1);
      this.atendidas.add(interrupcionId);
      this.pulso.descartar((e) => e.tipo === "insistencia" && e.id === interrupcionId);
      this.consumir(activa.definicion.costoAtender);
      this.aplicarEfectosGlobales(activa.definicion.efectosAtender);
      this.emitir(
        "sistema",
        `Atendiste a ${activa.definicion.de}. Te comió ${activa.definicion.costoAtender} minutos.`,
        "Sistema",
        activa.definicion.id,
      );
      return this.exito();
    });
  }

  /** Escuchás un audio del grupo: cuesta reloj, y recién ahí sabés qué dijo. */
  escuchar(audioId: string): ResultadoComando {
    return this.ejecutar(() => {
      const audio = this.audios.get(audioId);
      // Lo que no llegó no existe: no se escucha un audio que todavía se está grabando.
      if (!audio) return this.fallo("Ese audio todavía no llegó.");
      if (audio.escuchado) return this.fallo("Ese audio ya lo escuchaste.");
      audio.escuchado = true;
      this.consumir(costoDeEscuchar(audio.definicion.segundos));
      if (audio.definicion.alEscuchar) this.aplicarEfectos(audio.de, audio.definicion.alEscuchar);
      return this.exito();
    });
  }

  /** Bajás un cambio en el grupo: cuesta reloj y los que se peleaban dejan de calentarse. */
  calmar(): ResultadoComando {
    return this.ejecutar(() => {
      const roces = this.rocesActivos;
      const primero = roces[0];
      if (!primero) return this.fallo("No hay nadie peleándose en el grupo.");
      this.rocesActivos = [];
      const { calmar } = this.grupo;
      const { plantilla, a, b } = this.plantillaDe(primero);
      this.emitir("propio", plantilla?.calmar ?? calmar.mensaje, "Vos", CHAT_GRUPO);
      this.consumir(calmar.costoReloj);
      for (const roce of roces) {
        this.bitacora.registrar(
          "roce_calmado",
          this.reloj.minutos,
          roce.b,
          `${this.definicion(roce.a).nombre} y ${this.definicion(roce.b).nombre}`,
          roce.a,
        );
      }
      this.programarEnGrupo(calmar.respuestas, { a, b });
      return this.exito();
    });
  }

  /** Dejás pasar el tiempo a propósito. Cada dos minutos de espera cuentan como una acción. */
  esperar(minutos: number): ResultadoComando {
    return this.ejecutar(() => {
      if (minutos <= 0) return this.fallo("Tenés que esperar al menos un minuto.");
      this.esperarPorTramos(minutos);
      return this.exito();
    });
  }

  /**
   * Cerrás la lista: lo avisás en el grupo y el reloj corre hasta las 21:00. Se
   * frena si en el camino algo te reclama: la revisión de las 20:30 encuentra a
   * alguien que se va a bajar (la baja llega y la lista se vuelve a abrir) o cae
   * una interrupción. La espera es un solo toque: si no se frenara, no habría
   * cómo atender lo que llega en el medio.
   */
  cerrarLista(): ResultadoComando {
    return this.ejecutar(() => {
      const accion = this.accionCerrar;
      if (!accion) return this.fallo("Todavía no se puede cerrar la lista.");
      const { cerrar } = this.grupo;
      this.emitir("propio", accion.completa ? cerrar.mensaje : cerrar.sinDiez, "Vos", CHAT_GRUPO);
      this.esperarPorTramos(this.reloj.restante, () =>
        this.pulso.alguna((e) => e.tipo === "baja" || e.tipo === "falta" || e.tipo === "duda" || e.tipo === "interrupcion"),
      );
      return this.exito();
    });
  }

  /**
   * Pasa tiempo real. No mueve el reloj del viernes ni toca recursos por sí
   * mismo: entrega lo que estaba en camino. Es el único lugar por donde el
   * tiempo real entra al núcleo, como un comando más, así que la partida sigue
   * siendo reproducible y el bot puede jugarla.
   */
  transcurrir(ms: number): ResultadoComando {
    return this.ejecutar(() => {
      if (!Number.isFinite(ms) || ms < 0) return this.fallo("El tiempo real no retrocede.");
      const hasta = this.pulso.ms + ms;
      for (let p = this.pulso.tomarHasta(hasta); p; p = this.pulso.tomarHasta(hasta)) {
        this.entregar(p.carga);
        this.verificarFin();
        if (this._terminada) return this.exito();
      }
      this.pulso.avanzarHasta(hasta);
      return this.exito();
    });
  }

  // ----------------------------------------------------------------- interno

  /**
   * La charla con la cancha que ya estaba antes del viernes, con lo que le
   * contestaste: el modo y, al final, el perfil. La cancha contesta por el pulso, como todos.
   */
  private inscribir(inscripcion: InscripcionResuelta): void {
    const { chat, respuesta } = inscripcion;
    const { de } = this.interrupcion(chat);
    for (const r of inscripcion.charla) this.emitir(r.tuyo ? "propio" : "mensaje", r.texto, r.tuyo ? "Vos" : de, chat);
    this.emitir("propio", this.perfil.respuesta, "Vos", chat);
    this.pulso.tipear(chat, de, respuesta, { tipo: "texto", chat, de, texto: respuesta });
  }

  private ejecutar(accion: () => ResultadoComando): ResultadoComando {
    if (this._terminada) {
      return { ok: false, error: "La partida ya terminó.", nuevos: [] };
    }
    const desde = this.feed.length;
    const resultado = accion();
    this.avisarDudas();
    this.verificarFin();
    return { ...resultado, nuevos: this.feed.slice(desde) };
  }

  private exito(): ResultadoComando {
    return { ok: true, nuevos: [] };
  }

  private fallo(error: string): ResultadoComando {
    return { ok: false, error, nuevos: [] };
  }

  /** Si la condición es cierta ahora. `id` es el contacto del que se habla: el de `elegiste`. */
  private cumple(c: Condicion, id: string): boolean {
    const confirmado = (otro: string): boolean => this.estados.get(otro)?.estado === "confirmado";
    if (c.dineroMin !== undefined && this._dinero < c.dineroMin) return false;
    if (c.moralMin !== undefined && this._moral < c.moralMin) return false;
    if (c.horaDesde !== undefined && this.reloj.minutos < c.horaDesde) return false;
    if (c.horaHasta !== undefined && this.reloj.minutos > c.horaHasta) return false;
    if (c.escuchado !== undefined && !this.escuchado(c.escuchado)) return false;
    if (c.confirmado !== undefined && !confirmado(c.confirmado)) return false;
    if (c.noConfirmado !== undefined && confirmado(c.noConfirmado)) return false;
    if (c.confirmadosMin !== undefined && this.roster().confirmados < c.confirmadosMin) return false;
    if (c.faltanMin !== undefined && this.config.jugadoresNecesarios - this.roster().confirmados < c.faltanMin) return false;
    if (c.elegiste !== undefined && !this.estadoDe(id).elegidas.includes(c.elegiste)) return false;
    if (c.elegidoA !== undefined && !this.estados.get(c.elegidoA.contacto)?.elegidas.includes(c.elegidoA.opcion)) return false;
    return true;
  }

  /** El contacto se pone a escribir los mensajes del nodo. Llegan por el pulso. */
  private entregarNodo(id: string): void {
    const estado = this.estadoDe(id);
    if (estado.nodoActual === null) return;
    const nodo = this.definicion(id).nodos[estado.nodoActual];
    if (!nodo) throw new Error(`Nodo "${estado.nodoActual}" inexistente en "${id}"`);
    const definicion = this.definicion(id);
    for (const texto of nodo.mensajes) {
      this.pulso.tipear(id, definicion.nombre, texto, { tipo: "mensaje", contacto: id, texto });
    }
  }

  /** Llega algo que estaba en camino. Recién ahí existe para el juego. */
  private entregar(entrega: Entrega): void {
    switch (entrega.tipo) {
      case "mensaje": {
        const definicion = this.definicion(entrega.contacto);
        const estado = this.estadoDe(entrega.contacto);
        if (estado.estado === "esperando") estado.estado = "hablando";
        estado.historial.push({ texto: entrega.texto, minuto: this.reloj.minutos });
        this.emitir("mensaje", entrega.texto, definicion.nombre, entrega.contacto);
        this.ajustarMoral(-costoDeLeer(entrega.texto, definicion, estado));
        return;
      }
      case "interrupcion": {
        const definicion = this.interrupcion(entrega.id);
        this.interrupcionesActivas.push({
          definicion,
          minutoLlegada: this.reloj.minutos,
          drenajeAcumulado: 0,
        });
        this.emitir("alerta", definicion.texto, definicion.de, definicion.id);
        this.programarInsistencia(definicion, 0);
        return;
      }
      case "insistencia": {
        const definicion = this.interrupcion(entrega.id);
        const texto = definicion.insistencias?.[entrega.indice]?.texto;
        if (!texto || !this.interrupcionesActivas.some((a) => a.definicion.id === entrega.id)) return;
        this.emitir("mensaje", texto, definicion.de, definicion.id);
        this.programarInsistencia(definicion, entrega.indice + 1);
        return;
      }
      case "grupo": {
        const definicion = this.definicion(entrega.de);
        const { audio, cita, roce } = entrega;
        if (audio) this.audios.set(audio.id, { definicion: audio, de: entrega.de, escuchado: false });
        this.emitir("mensaje", entrega.texto, definicion.nombre, CHAT_GRUPO, {
          ...(audio && {
            audio: {
              id: audio.id,
              segundos: audio.segundos,
              costo: costoDeEscuchar(audio.segundos),
              voz: definicion.voz ?? VOZ_POR_DEFECTO,
            },
          }),
          ...(cita && { cita }),
          ...(roce && { roce }),
        });
        if (entrega.aviso) this.emitir("alerta", entrega.aviso, "Sistema", CHAT_GRUPO);
        return;
      }
      case "texto":
        this.emitir("mensaje", entrega.texto, entrega.de, entrega.chat);
        return;
      case "baja": {
        const estado = this.estadoDe(entrega.contacto);
        if (estado.estado !== "confirmado") return;
        const definicion = this.definicion(entrega.contacto);
        estado.estado = "bajado";
        this.bitacora.registrar("baja_tardia", this.reloj.minutos, estado.id, entrega.porque);
        this.emitir("alerta", entrega.texto, definicion.nombre, estado.id);
        this.emitir("alerta", `${definicion.nombre} se bajó de la lista.`, "Sistema", CHAT_GRUPO);
        this.ajustarMoral(-4);
        // La última baja en llegar cierra la revisión con el conteo que quedó.
        if (!this.pulso.alguna((e) => e.tipo === "baja" || e.tipo === "falta")) this.anunciarRevision();
        return;
      }
      case "duda": {
        if (this.estadoDe(entrega.contacto).estado !== "confirmado") return;
        this._avisaron.push(entrega.contacto);
        this.bitacora.registrar("duda", this.reloj.minutos, entrega.contacto);
        this.emitir("mensaje", entrega.texto, this.definicion(entrega.contacto).nombre, entrega.contacto);
        return;
      }
      case "falta": {
        const quien = this.traidos.get(entrega.invitado);
        if (!quien || !this.vieneSintetico(entrega.invitado)) return;
        const invitado = this.invitados.get(entrega.invitado)!;
        this.faltaron.add(entrega.invitado);
        this.bitacora.registrar("no_vino", this.reloj.minutos, quien, invitado.nombre);
        const de = this.definicion(quien).nombre;
        this.emitir("alerta", entrega.texto, de, quien);
        this.emitir("alerta", `${invitado.nombre} no viene.`, "Sistema", CHAT_GRUPO);
        this.ajustarMoral(-3);
        if (!this.pulso.alguna((e) => e.tipo === "baja" || e.tipo === "falta")) this.anunciarRevision();
        return;
      }
    }
  }

  private interrupcion(id: string): DefinicionInterrupcion {
    const definicion = this.interrupcionesPosibles.find((d) => d.id === id);
    if (!definicion) throw new Error(`No existe la interrupción "${id}"`);
    return definicion;
  }

  private programarInsistencia(definicion: DefinicionInterrupcion, indice: number): void {
    const siguiente = definicion.insistencias?.[indice];
    if (!siguiente) return;
    const espera = siguiente.segundos * 1000;
    this.pulso.tipear(
      definicion.id,
      definicion.de,
      siguiente.texto,
      { tipo: "insistencia", id: definicion.id, indice },
      [espera, espera],
    );
  }

  private aplicarEfectos(id: string, efectos: Efectos): void {
    const estado = this.estadoDe(id);
    if (efectos.probabilidadBaja !== undefined) {
      estado.probabilidadBaja = limitar(estado.probabilidadBaja + efectos.probabilidadBaja, 0, 100);
    }
    if (efectos.enojo !== undefined) {
      estado.enojo = limitar(estado.enojo + efectos.enojo, 0, 100);
    }
    if (efectos.dineroAportado !== undefined) {
      estado.dineroAportado += efectos.dineroAportado;
      this._dinero += efectos.dineroAportado;
    }
    if (efectos.estado !== undefined) estado.estado = efectos.estado;
    // El que trae va primero en la lista, y los suyos después.
    if (efectos.trae?.length && estado.estado === "confirmado" && !this.ordenLista.includes(id)) this.ordenLista.push(id);
    for (const [i, invitado] of (efectos.trae ?? []).entries()) {
      const traido: DefinicionContacto = {
        id: `${id}_trae_${estado.elegidas.length}_${i}`,
        nombre: invitado.nombre,
        rol: invitado.rol,
        habilidad: invitado.habilidad,
        rasgos: [],
        probabilidadBajaInicial: 0,
        nodoInicial: "",
        nodos: {},
      };
      this.sintéticos.push(traido);
      this.traidos.set(traido.id, id);
      this.invitados.set(traido.id, invitado);
      this.ordenLista.push(traido.id);
      this.bitacora.registrar("trajo", this.reloj.minutos, id, invitado.nombre, traido.id);
    }
    // Lo que le llega a otro: Beto se entera de que los equipos los arma Carlos.
    for (const otro of efectos.otros ?? []) {
      const suyo = this.estados.get(otro.contacto);
      if (!suyo) continue;
      if (otro.probabilidadBaja !== undefined) suyo.probabilidadBaja = limitar(suyo.probabilidadBaja + otro.probabilidadBaja, 0, 100);
      if (otro.enojo !== undefined) suyo.enojo = limitar(suyo.enojo + otro.enojo, 0, 100);
    }
    if (efectos.registrar !== undefined) {
      this.bitacora.registrar(efectos.registrar, this.reloj.minutos, id);
    }
    this.aplicarEfectosGlobales(efectos);
  }

  private aplicarEfectosGlobales(efectos: Efectos): void {
    if (efectos.moral !== undefined) this.ajustarMoral(efectos.moral);
    if (efectos.dinero !== undefined) this._dinero += efectos.dinero;
  }

  private registrarConfirmacion(id: string): void {
    const definicion = this.definicion(id);
    const estado = this.estadoDe(id);
    const plantelPrevio = this.plantel().filter((c) => c.id !== id);
    // Todos los roces quedan registrados (los usa la química y la narración),
    // pero el costo de moral se cobra una sola vez por confirmación: alguien que
    // entra al grupo se pelea una vez, no una vez con cada uno. Sin este tope el
    // costo escala al cuadrado y los cruces se comen el juego entero.
    const roces = rocesAlSumar(plantelPrevio, definicion);
    if (!this.ordenLista.includes(id)) this.ordenLista.push(id);
    for (const roce of roces) {
      const otro = this.definicion(roce.a);
      this.bitacora.registrar(
        "roce",
        this.reloj.minutos,
        id,
        `${otro.nombre} y ${definicion.nombre}`,
        roce.a,
      );
    }
    const primero = roces[0];
    if (primero) {
      const otro = this.definicion(primero.a);
      this.ajustarMoral(-COSTO_MORAL_POR_ROCE);
      this.rocesActivos.push(...roces);
      const aviso =
        roces.length === 1
          ? `${otro.nombre} y ${definicion.nombre} se están cruzando en el grupo.`
          : `Se armó en el grupo: ${definicion.nombre} se está cruzando con ${roces.length} más.`;
      // La pelea se ve en el grupo, y el aviso cae cuando terminan de cruzarse.
      const { plantilla, a, b } = this.plantillaDe(primero);
      this.programarEnGrupo(plantilla?.mensajes ?? [], { a, b }, aviso, true);
    }
    if (estado.enojo < 30) {
      this.bitacora.registrar("confirmacion_limpia", this.reloj.minutos, id);
    }
    const roster = this.roster();
    this.emitir(
      "sistema",
      `${definicion.nombre} confirmó. Van ${roster.confirmados}/${roster.necesarios}.`,
      "Sistema",
      CHAT_GRUPO,
    );
    this.dispararCharlas(id);
  }

  private ajustarMoral(delta: number): void {
    this._moral = limitar(this._moral + delta, CLAMP_MORAL.min, CLAMP_MORAL.max);
  }

  /** Deja correr el reloj de a una acción por tramo, hasta que se acabe, se agote la moral o `frenar` diga basta. */
  private esperarPorTramos(minutos: number, frenar: () => boolean = () => false): void {
    for (let falta = minutos; falta > 0 && !this.reloj.agotado && this._moral > 0; ) {
      const tramo = Math.min(ESPERA_POR_ACCION, falta);
      this.consumir(tramo);
      falta -= tramo;
      if (frenar()) return;
    }
  }

  /** Toda acción que consume reloj pasa por acá: dispara triggers y drenajes. */
  private consumir(minutos: number): void {
    this.reloj.avanzar(minutos);
    this.drenarPorInterrupciones();
    this.enfriarPorEspera();
    this.dispararInterrupciones();
    this.dispararCharlas();
    this.avisarDudas();
    this.revisarBajas();
  }

  /**
   * Lo que se enfría con cada acción tuya: quien mandó un audio que no
   * escuchaste y los que se pelean en el grupo sin que nadie los calme. Se cobra
   * por acción y nunca por segundo: el que lee lento no pierde jugadores.
   */
  private enfriarPorEspera(): void {
    for (const audio of this.audios.values()) {
      const enfria = audio.definicion.enfriaPorAccion;
      if (!audio.escuchado && enfria) this.subirProbabilidadBaja(audio.de, enfria);
    }
    const calienta = this.grupo.calmar.calientaPorAccion;
    for (const roce of this.rocesActivos) {
      this.subirProbabilidadBaja(roce.a, calienta);
      this.subirProbabilidadBaja(roce.b, calienta);
    }
  }

  private subirProbabilidadBaja(id: string, cuanto: number): void {
    const estado = this.estadoDe(id);
    estado.probabilidadBaja = limitar(estado.probabilidadBaja + cuanto, 0, 100);
  }

  /** Arranca las charlas del grupo cuyo momento llegó. `confirmo` es quien acaba de confirmar. */
  private dispararCharlas(confirmo?: string): void {
    const confirmados = this.roster().confirmados;
    for (const charla of this.grupo.charlas) {
      if (this.charlasDisparadas.has(charla.id)) continue;
      // Cada perfil trae su propia agenda: si alguien de la charla no está, esa charla no pasa.
      if (!charla.mensajes.every((m) => this.agenda.has(m.de))) continue;
      if (!this.llego(charla.cuando, confirmados, confirmo)) continue;
      this.charlasDisparadas.add(charla.id);
      this.programarEnGrupo(charla.mensajes);
    }
  }

  private llego(cuando: Disparador, confirmados: number, confirmo?: string): boolean {
    if ("desde" in cuando) return this.reloj.minutos >= cuando.desde && this.reloj.minutos <= cuando.hasta;
    if ("alConfirmar" in cuando) return cuando.alConfirmar === confirmo;
    return confirmados >= cuando.conConfirmados;
  }

  /** La plantilla con la que se pelean los dos de un roce, y quién es "a" y quién "b" en ella. */
  private plantillaDe(roce: Roce): { plantilla: PlantillaRoce | null; a: string; b: string } {
    const tiene = (id: string, rasgo: Rasgo): boolean => this.definicion(id).rasgos.includes(rasgo);
    const [r1, r2] = roce.rasgos;
    for (const plantilla of this.grupo.roces) {
      const [x, y] = plantilla.entre;
      const mismoPar = (x === r1 && y === r2) || (x === r2 && y === r1);
      if (!mismoPar) continue;
      if (tiene(roce.a, x) && tiene(roce.b, y)) return { plantilla, a: roce.a, b: roce.b };
      if (tiene(roce.b, x) && tiene(roce.a, y)) return { plantilla, a: roce.b, b: roce.a };
    }
    return { plantilla: null, a: roce.a, b: roce.b };
  }

  /**
   * Pone a escribir en el grupo una tanda de mensajes, uno detrás del otro.
   * Llegan por el pulso, como todo. En un roce, `par` dice quién es "a" y quién
   * "b". El aviso, si hay, cae después del último. `roce` marca los mensajes de una pelea.
   */
  private programarEnGrupo(
    mensajes: readonly MensajeGrupo[],
    par?: { readonly a: string; readonly b: string },
    aviso?: string,
    roce = false,
  ): void {
    if (mensajes.length === 0) {
      if (aviso !== undefined) this.emitir("alerta", aviso, "Sistema", CHAT_GRUPO);
      return;
    }
    // Adentro de lo que escriben, los nombres van como se escriben en un grupo: en minúscula.
    const nombres = par && {
      a: this.definicion(par.a).nombre.toLowerCase(),
      b: this.definicion(par.b).nombre.toLowerCase(),
    };
    const completar = (texto: string): string =>
      nombres ? texto.replaceAll("{a}", nombres.a).replaceAll("{b}", nombres.b) : texto;
    let anterior: { de: string; texto: string } | undefined;
    mensajes.forEach((m, i) => {
      const de = par ? (m.de === "a" ? par.a : par.b) : m.de;
      const nombre = this.definicion(de).nombre;
      const texto = completar(m.audio?.transcripcion ?? m.texto ?? "");
      const ultimo = i === mensajes.length - 1;
      this.pulso.tipear(CHAT_GRUPO, nombre, texto, {
        tipo: "grupo",
        de,
        texto,
        ...(m.audio ? { audio: m.audio } : {}),
        ...(m.cita && anterior ? { cita: anterior } : {}),
        ...(ultimo && aviso !== undefined ? { aviso } : {}),
        ...(roce ? { roce: true as const } : {}),
      });
      anterior = { de: nombre, texto };
    });
  }

  private drenarPorInterrupciones(): void {
    for (const activa of this.interrupcionesActivas) {
      // Ignorada mucho tiempo, se rinde: deja de drenar. Lo que te costó, ya te costó.
      const tope = activa.definicion.drenajeMaximo ?? Number.POSITIVE_INFINITY;
      const drenaje = Math.min(activa.definicion.drenajePorAccion, tope - activa.drenajeAcumulado);
      if (drenaje <= 0) continue;
      activa.drenajeAcumulado += drenaje;
      this.ajustarMoral(-drenaje);
      if (activa.drenajeAcumulado >= 6 && this.bitacora.deContacto(activa.definicion.id).length === 0) {
        this.bitacora.registrar(
          activa.definicion.registrarSiIgnorada,
          this.reloj.minutos,
          activa.definicion.id,
          activa.definicion.de,
        );
      }
    }
  }

  private dispararInterrupciones(): void {
    for (const definicion of this.interrupcionesPosibles) {
      if (this.disparadas.has(definicion.id)) continue;
      if (this.reloj.minutos < definicion.minutoDesde) continue;
      if (this.reloj.minutos > definicion.minutoHasta) {
        this.disparadas.add(definicion.id);
        continue;
      }
      const factor = this.perfil.probabilidadInterrupciones?.[definicion.id] ?? 1;
      if (!this.rng.ocurre(Math.min(100, definicion.probabilidad * factor))) continue;
      this.disparadas.add(definicion.id);
      this.pulso.tipear(
        definicion.id,
        definicion.de,
        definicion.texto,
        { tipo: "interrupcion", id: definicion.id },
        LLEGADA_INTERRUPCION,
      );
    }
  }

  /**
   * El que ya se bajaría a las 20:30 te avisa antes, una sola vez y con su
   * texto: la baja se ve venir y queda tiempo para llamarlo. Las bajas por algo
   * que hiciste (la mentira que se descubre) no avisan: esas no son calentura.
   */
  private avisarDudas(): void {
    if (this._revisionHecha || this.reloj.minutos >= this.config.minutoRevision) return;
    for (const estado of this.estados.values()) {
      if (estado.estado !== "confirmado" || this.dudosos.has(estado.id)) continue;
      if (estado.probabilidadBaja <= this.config.umbralBaja) continue;
      const definicion = this.definicion(estado.id);
      const texto = definicion.duda ?? this.frases.duda;
      this.dudosos.add(estado.id);
      this.pulso.tipear(estado.id, definicion.nombre, texto, { tipo: "duda", contacto: estado.id, texto });
    }
  }

  /**
   * A las 20:30 los que quedaron calientes se bajan, y también los que tienen un
   * motivo propio que se cumplió (la mentira que se descubrió), aunque estén
   * tranquilos. Quién se baja se decide en ese minuto; el mensaje llega por el
   * pulso y la baja cuenta cuando llega.
   */
  private revisarBajas(): void {
    if (this._revisionHecha) return;
    if (this.reloj.minutos < this.config.minutoRevision) return;
    this._revisionHecha = true;

    let hayBajas = false;
    for (const estado of this.estados.values()) {
      if (estado.estado !== "confirmado") continue;
      const definicion = this.definicion(estado.id);
      const motivo = definicion.bajas?.find((b) => b.si && this.cumple(b.si, estado.id));
      if (!motivo && estado.probabilidadBaja <= this.config.umbralBaja) continue;
      const baja = motivo ?? definicion.bajas?.find((b) => !b.si);
      const texto = baja?.texto ?? this.frases.baja;
      this.pulso.tipear(estado.id, definicion.nombre, texto, {
        tipo: "baja",
        contacto: estado.id,
        texto,
        ...(baja?.porque ? { porque: baja.porque } : {}),
      });
      hayBajas = true;
    }
    // Los invitados de los que vienen: no los conocés, y alguno avisa que no viene.
    for (const [id, invitado] of this.invitados) {
      if (!invitado.noViene || !this.vieneSintetico(id)) continue;
      if (!this.rng.ocurre(invitado.noViene.probabilidad)) continue;
      const quien = this.traidos.get(id)!;
      this.pulso.tipear(quien, this.definicion(quien).nombre, invitado.noViene.texto, {
        tipo: "falta",
        invitado: id,
        texto: invitado.noViene.texto,
      });
      hayBajas = true;
    }
    if (!hayBajas) this.anunciarRevision();
  }

  private anunciarRevision(): void {
    const roster = this.roster();
    this.emitir(
      "sistema",
      `${formatearHora(this.reloj.minutos)} — última revisión. Van ${roster.confirmados}/${roster.necesarios}.`,
      "Sistema",
      CHAT_GRUPO,
    );
  }

  private verificarFin(): void {
    if (this._terminada) return;
    if (this._moral <= 0) {
      this._terminada = true;
      this._motivoFin = "moral_agotada";
      this.emitir("alerta", "No das más. Apagás el teléfono y te tirás en la cama.");
      return;
    }
    if (this.reloj.agotado) {
      this._terminada = true;
      this._motivoFin = "corte_horario";
      this.emitir("sistema", `${this.reloj} · Se cerró la lista`, "Sistema", CHAT_GRUPO, { cierre: true });
    }
  }

  private emitir(
    clase: EventoFeed["clase"],
    texto: string,
    de = "Sistema",
    chat?: string,
    extra: Pick<EventoFeed, "audio" | "cita" | "roce" | "cierre"> = {},
  ): void {
    const evento: EventoFeed = { minuto: this.reloj.minutos, de, texto, clase, ...extra };
    this.feed.push(chat === undefined ? evento : { ...evento, chat });
  }
}

/**
 * Deja pasar el tiempo real hasta que llegue todo lo que estaba en camino. Es
 * cómo juega quien no tiene pantalla: el bot, la consola y los tests.
 */
export function alDia(partida: Partida): void {
  for (let ms = partida.msHastaProximaEntrega(); ms !== null; ms = partida.msHastaProximaEntrega()) {
    if (!partida.transcurrir(ms).ok) return;
  }
}
