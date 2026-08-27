import { Bitacora } from "./bitacora.js";
import type { DefinicionInterrupcion, InterrupcionActiva } from "./interrupciones.js";
import { Rng } from "./rng.js";
import { habilidadPromedio, rocesAlSumar } from "./roster.js";
import { COSTO, formatearHora, Reloj } from "./tiempo.js";
import type {
  Config,
  DefinicionContacto,
  DefinicionPerfil,
  Efectos,
  EstadoDeContacto,
  MotivoFin,
  OpcionDialogo,
  Rol,
} from "./tipos.js";

export interface OpcionesPartida {
  readonly perfil: DefinicionPerfil;
  readonly agenda: readonly DefinicionContacto[];
  readonly interrupciones: readonly DefinicionInterrupcion[];
  readonly config: Config;
  readonly semilla: number | string;
}

export interface EventoFeed {
  readonly minuto: number;
  readonly de: string;
  readonly texto: string;
  readonly clase: "mensaje" | "propio" | "sistema" | "alerta";
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
  readonly sinLeer: number;
  /** Lo último que dijo, para el preview de la lista. */
  readonly ultimoMensaje: string | null;
  readonly minutoUltimo: number | null;
  readonly opciones: readonly VistaOpcion[];
}

export interface VistaRoster {
  readonly confirmados: number;
  readonly necesarios: number;
  readonly faltantes: readonly { rol: Rol; faltan: number }[];
}

const CLAMP_MORAL = { min: 0, max: 100 } as const;

/** Moral que cuesta una pelea en el grupo. Se cobra una vez por confirmación. */
const COSTO_MORAL_POR_ROCE = 3;

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
  private readonly rng: Rng;
  private readonly feed: EventoFeed[] = [];
  private readonly sintéticos: DefinicionContacto[] = [];

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
    this.reloj = new Reloj(opciones.config.horaInicio, opciones.config.horaCorte);
    this.interrupcionesPosibles = opciones.interrupciones;
    this._moral = opciones.perfil.moralInicial;
    this._dinero = opciones.perfil.dineroInicial;

    for (const contacto of opciones.agenda) {
      this.agenda.set(contacto.id, contacto);
      this.estados.set(contacto.id, {
        id: contacto.id,
        estado: "sin_contactar",
        probabilidadBaja: contacto.probabilidadBajaInicial,
        enojo: 0,
        dineroAportado: 0,
        nodoActual: null,
        historial: [],
        leidoHasta: 0,
      });
    }

    this.emitir("sistema", `Son las ${this.reloj}. Tenés ${this.config.jugadoresNecesarios} lugares que llenar.`);
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

  /** Plantel confirmado: contactos reales más los cubiertos con plata. */
  plantel(): DefinicionContacto[] {
    const reales = [...this.estados.values()]
      .filter((e) => e.estado === "confirmado")
      .map((e) => this.definicion(e.id));
    return [...reales, ...this.sintéticos];
  }

  roster(): VistaRoster {
    const plantel = this.plantel();
    const conteo: Record<Rol, number> = {
      arquero: 0,
      defensor: 0,
      mediocampista: 0,
      delantero: 0,
    };
    for (const c of plantel) conteo[c.rol]++;
    const ideal: Record<Rol, number> = {
      arquero: 2,
      defensor: 3,
      mediocampista: 3,
      delantero: 2,
    };
    const faltantes = (Object.keys(ideal) as Rol[])
      .map((rol) => ({ rol, faltan: ideal[rol] - conteo[rol] }))
      .filter((f) => f.faltan > 0);
    return {
      confirmados: plantel.length,
      necesarios: this.config.jugadoresNecesarios,
      faltantes,
    };
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
        sinLeer: Math.max(0, e.historial.length - e.leidoHasta),
        ultimoMensaje: ultimo?.texto ?? null,
        minutoUltimo: ultimo?.minuto ?? null,
        opciones: this.opcionesDisponibles(d.id).map((o) => ({
          id: o.id,
          texto: o.texto,
          costoReloj: o.costoReloj,
        })),
      };
    });
  }

  /** Abrir el chat marca lo recibido como visto. No consume reloj: mirar es gratis. */
  marcarLeido(id: string): void {
    const estado = this.estadoDe(id);
    estado.leidoHasta = estado.historial.length;
  }

  opcionesDisponibles(id: string): OpcionDialogo[] {
    const estado = this.estadoDe(id);
    if (this._terminada || estado.nodoActual === null) return [];
    const nodo = this.definicion(id).nodos[estado.nodoActual];
    if (!nodo) return [];
    return nodo.opciones.filter((o) => this.cumpleRequisitos(o));
  }

  eventos(): readonly EventoFeed[] {
    return this.feed;
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
      this.emitir("propio", `Che, ¿jugás hoy a las 21?`, definicion.nombre);
      this.consumir(COSTO.mensaje);
      estado.estado = "hablando";
      estado.nodoActual = definicion.nodoInicial;
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

      this.emitir("propio", opcion.texto, definicion.nombre);
      this.consumir(opcion.costoReloj);
      this.aplicarEfectos(id, opcion.efectos);

      if (estado.estado === "confirmado") {
        this.registrarConfirmacion(id);
      } else if (estado.estado === "rechazado") {
        this.emitir("alerta", `${definicion.nombre} no viene.`);
      }

      estado.nodoActual = opcion.siguiente;
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
      this.emitir("propio", `📞 Lo llamás a ${definicion.nombre}.`, definicion.nombre);
      this.consumir(COSTO.llamar);
      this.ajustarMoral(-3);
      estado.probabilidadBaja = limitar(estado.probabilidadBaja - 30, 0, 100);
      estado.enojo = limitar(estado.enojo + 10, 0, 100);
      this.bitacora.registrar("apuro", this.reloj.minutos, id, "lo llamaste por teléfono");
      this.emitir("mensaje", `Bueno, bueno, ya te dije que voy. Cortá.`, definicion.nombre);
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
      this.bitacora.registrar("plata", this.reloj.minutos, relleno.id, `pagaste un ${rol}`);
      this.emitir("sistema", `Pagaste $${this.config.costoVacante}. Entra ${relleno.nombre}.`);
      return this.exito();
    });
  }

  /** Atendés una interrupción pendiente: cuesta reloj, frena el drenaje. */
  atender(interrupcionId: string): ResultadoComando {
    return this.ejecutar(() => {
      const indice = this.interrupcionesActivas.findIndex(
        (i) => i.definicion.id === interrupcionId,
      );
      if (indice === -1) return this.fallo("Eso ya no está pendiente.");
      const activa = this.interrupcionesActivas[indice]!;
      this.interrupcionesActivas.splice(indice, 1);
      this.consumir(activa.definicion.costoAtender);
      this.aplicarEfectosGlobales(activa.definicion.efectosAtender);
      this.emitir("sistema", `Atendiste a ${activa.definicion.de}. Te comió ${activa.definicion.costoAtender} minutos.`);
      return this.exito();
    });
  }

  /** Dejás pasar el tiempo a propósito. */
  esperar(minutos: number): ResultadoComando {
    return this.ejecutar(() => {
      if (minutos <= 0) return this.fallo("Tenés que esperar al menos un minuto.");
      this.consumir(minutos);
      return this.exito();
    });
  }

  // ----------------------------------------------------------------- interno

  private ejecutar(accion: () => ResultadoComando): ResultadoComando {
    if (this._terminada) {
      return { ok: false, error: "La partida ya terminó.", nuevos: [] };
    }
    const desde = this.feed.length;
    const resultado = accion();
    this.verificarFin();
    return { ...resultado, nuevos: this.feed.slice(desde) };
  }

  private exito(): ResultadoComando {
    return { ok: true, nuevos: [] };
  }

  private fallo(error: string): ResultadoComando {
    return { ok: false, error, nuevos: [] };
  }

  private cumpleRequisitos(opcion: OpcionDialogo): boolean {
    const r = opcion.requiere;
    if (!r) return true;
    if (r.dineroMin !== undefined && this._dinero < r.dineroMin) return false;
    if (r.moralMin !== undefined && this._moral < r.moralMin) return false;
    if (r.horaDesde !== undefined && this.reloj.minutos < r.horaDesde) return false;
    if (r.horaHasta !== undefined && this.reloj.minutos > r.horaHasta) return false;
    return true;
  }

  private entregarNodo(id: string): void {
    const estado = this.estadoDe(id);
    if (estado.nodoActual === null) return;
    const nodo = this.definicion(id).nodos[estado.nodoActual];
    if (!nodo) throw new Error(`Nodo "${estado.nodoActual}" inexistente en "${id}"`);
    const definicion = this.definicion(id);
    for (const mensaje of nodo.mensajes) {
      estado.historial.push({ texto: mensaje, minuto: this.reloj.minutos });
      this.emitir("mensaje", mensaje, definicion.nombre);
      this.ajustarMoral(-costoDeLeer(mensaje, definicion, estado));
    }
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
    for (const roce of roces) {
      const otro = this.definicion(roce.a);
      this.bitacora.registrar(
        "roce",
        this.reloj.minutos,
        id,
        `${otro.nombre} y ${definicion.nombre} se cruzaron en el grupo`,
      );
    }
    const primero = roces[0];
    if (primero) {
      const otro = this.definicion(primero.a);
      this.ajustarMoral(-COSTO_MORAL_POR_ROCE);
      this.emitir(
        "alerta",
        roces.length === 1
          ? `${otro.nombre} y ${definicion.nombre} se están cruzando en el grupo.`
          : `Se armó en el grupo: ${definicion.nombre} se está cruzando con ${roces.length} más.`,
      );
    }
    if (estado.enojo < 30) {
      this.bitacora.registrar("confirmacion_limpia", this.reloj.minutos, id);
    }
    const roster = this.roster();
    this.emitir(
      "sistema",
      `${definicion.nombre} confirmó. Van ${roster.confirmados}/${roster.necesarios}.`,
    );
  }

  private ajustarMoral(delta: number): void {
    this._moral = limitar(this._moral + delta, CLAMP_MORAL.min, CLAMP_MORAL.max);
  }

  /** Toda acción que consume reloj pasa por acá: dispara triggers y drenajes. */
  private consumir(minutos: number): void {
    this.reloj.avanzar(minutos);
    this.drenarPorInterrupciones();
    this.dispararInterrupciones();
    this.revisarBajas();
  }

  private drenarPorInterrupciones(): void {
    for (const activa of this.interrupcionesActivas) {
      const drenaje = activa.definicion.drenajePorAccion;
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
      if (!this.rng.ocurre(definicion.probabilidad)) continue;
      this.disparadas.add(definicion.id);
      this.interrupcionesActivas.push({
        definicion,
        minutoLlegada: this.reloj.minutos,
        drenajeAcumulado: 0,
      });
      this.emitir("alerta", definicion.texto, definicion.de);
    }
  }

  /** A las 20:30 los que quedaron calientes se bajan. */
  private revisarBajas(): void {
    if (this._revisionHecha) return;
    if (this.reloj.minutos < this.config.minutoRevision) return;
    this._revisionHecha = true;

    for (const estado of this.estados.values()) {
      if (estado.estado !== "confirmado") continue;
      if (estado.probabilidadBaja <= this.config.umbralBaja) continue;
      estado.estado = "bajado";
      const definicion = this.definicion(estado.id);
      this.bitacora.registrar("baja_tardia", this.reloj.minutos, estado.id);
      this.emitir(
        "alerta",
        `Perdón, me surgió algo. No voy a poder llegar.`,
        definicion.nombre,
      );
      this.ajustarMoral(-6);
    }
    const roster = this.roster();
    this.emitir(
      "sistema",
      `${formatearHora(this.reloj.minutos)} — última revisión. Van ${roster.confirmados}/${roster.necesarios}.`,
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
      this.emitir("sistema", "21:00. Se corta el chat.");
    }
  }

  private emitir(clase: EventoFeed["clase"], texto: string, de = "Sistema"): void {
    this.feed.push({ minuto: this.reloj.minutos, de, texto, clase });
  }
}
