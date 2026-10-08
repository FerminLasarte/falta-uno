/**
 * El viernes guardado como lo que hiciste, no como quedó.
 *
 * Un viernes a medias se guarda como la semilla más la lista de comandos, y se
 * retoma jugándolos de nuevo. La partida es determinista, así que da lo mismo
 * que guardar el estado, sin tener que acordarse de serializar cada campo
 * nuevo: un campo olvidado desfasaría la partida cargada sin avisar. Y el
 * guardado de un jugador es, tal cual, la reproducción de su bug.
 *
 * El tiempo real entra como `transcurrir` unas diez veces por segundo. Varios
 * seguidos equivalen a uno solo con la suma, así que se anotan juntos: un
 * viernes entero son unos cientos de pasos. Para que la suma sea exacta, el
 * tiempo se anota en milisegundos enteros.
 */
import { Partida, type OpcionesPartida, type ResultadoComando } from "./partida.js";
import { hashTexto } from "./rng.js";
import type { Apodos } from "./apodos.js";
import { FINES_CAMPANA, type Campana, type FechaJugada } from "./campana.js";
import { COMPETENCIAS, FORMATOS, MODO_POR_DEFECTO, type Modo } from "./modo.js";
import { PERFILES, ROLES, type Rol } from "./tipos.js";

export type Paso =
  | readonly ["t", number]
  | readonly ["escribir", string]
  | readonly ["responder", string, string]
  | readonly ["llamar", string]
  | readonly ["pagar", Rol]
  | readonly ["atender", string]
  | readonly ["escuchar", string]
  | readonly ["calmar"]
  | readonly ["cerrar"]
  | readonly ["esperar", number];

function aplicar(partida: Partida, paso: Paso): ResultadoComando {
  switch (paso[0]) {
    case "t":
      return partida.transcurrir(paso[1]);
    case "escribir":
      return partida.escribir(paso[1]);
    case "responder":
      return partida.responder(paso[1], paso[2]);
    case "llamar":
      return partida.llamar(paso[1]);
    case "pagar":
      return partida.pagarVacante(paso[1]);
    case "atender":
      return partida.atender(paso[1]);
    case "escuchar":
      return partida.escuchar(paso[1]);
    case "calmar":
      return partida.calmar();
    case "cerrar":
      return partida.cerrarLista();
    case "esperar":
      return partida.esperar(paso[1]);
  }
}

/** Una partida y lo que se hizo en ella. Todo comando que se quiera guardar pasa por acá. */
export class Registro {
  private readonly lista: Paso[] = [];
  private msJugados = 0;

  constructor(readonly partida: Partida) {}

  get pasos(): readonly Paso[] {
    return this.lista;
  }

  /** Milisegundos reales jugados: la suma de todo el tiempo que pasó. Con esto se fecha lo que hace la vista. */
  get ms(): number {
    return this.msJugados;
  }

  /**
   * Ejecuta un comando y lo anota si salió bien. Un comando que falla no cambia
   * nada en la partida, así que no hace falta recordarlo.
   */
  hacer(paso: Paso): ResultadoComando {
    if (paso[0] === "t" && !Number.isInteger(paso[1])) {
      return { ok: false, error: "El tiempo real se anota en milisegundos enteros.", nuevos: [] };
    }
    const resultado = aplicar(this.partida, paso);
    if (resultado.ok) this.anotar(paso);
    return resultado;
  }

  private anotar(paso: Paso): void {
    if (paso[0] !== "t") {
      this.lista.push(paso);
      return;
    }
    if (paso[1] === 0) return;
    this.msJugados += paso[1];
    const ultimo = this.lista.at(-1);
    if (ultimo?.[0] === "t") this.lista[this.lista.length - 1] = ["t", ultimo[1] + paso[1]];
    else this.lista.push(paso);
  }

  /**
   * Arma la partida de nuevo jugando los pasos en orden. Si el contenido cambió
   * desde que se guardó, algún paso puede no tener sentido: se juega hasta el
   * primero que falla y se sigue desde ahí. `aplicados` dice hasta dónde llegó.
   */
  static reproducir(opciones: OpcionesPartida, pasos: readonly Paso[]): { registro: Registro; aplicados: number } {
    const registro = new Registro(new Partida(opciones));
    let aplicados = 0;
    try {
      for (const paso of pasos) {
        if (!registro.hacer(paso).ok) break;
        aplicados++;
      }
    } catch {
      // Un paso que nombra algo que ya no existe puede explotar a mitad de
      // camino y dejar la partida a medio cambiar: se arma de nuevo con los
      // pasos que sí anduvieron, que ya se sabe que andan.
      return Registro.reproducir(opciones, pasos.slice(0, aplicados));
    }
    return { registro, aplicados };
  }
}

// ------------------------------------------------------------------ el archivo

export const FORMATO_GUARDADO = 2;

/**
 * El viernes en curso. Guarda lo que necesita para armarse igual que la
 * primera vez, aunque la campaña ya haya cerrado la fecha y cambiado su plata.
 */
export interface ViernesGuardado {
  readonly fecha: number;
  /** La plata con la que arrancó. */
  readonly dinero: number;
  /** Huella del contenido con el que se jugó. Si no coincide, la reproducción puede cortarse antes. */
  readonly contenido: string;
  readonly pasos: readonly Paso[];
}

export interface Guardado {
  readonly formato: typeof FORMATO_GUARDADO;
  readonly campana: Campana;
  readonly viernes: ViernesGuardado;
  /** Lo que la vista quiere recordar: dónde estabas y qué ya viste. El núcleo no lo interpreta. */
  readonly vista?: unknown;
}

/** Una huella corta del contenido, para saber si el juego se actualizó en medio de un viernes. */
export function huella(texto: string): string {
  return hashTexto(texto).toString(16).padStart(8, "0");
}

export const esTexto = (x: unknown): x is string => typeof x === "string";
const esEntero = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;

function esPaso(x: unknown): x is Paso {
  if (!Array.isArray(x)) return false;
  const [tipo, a, b] = x as unknown[];
  switch (tipo) {
    case "t":
    case "esperar":
      return x.length === 2 && esEntero(a);
    case "escribir":
    case "llamar":
    case "atender":
    case "escuchar":
      return x.length === 2 && esTexto(a);
    case "responder":
      return x.length === 3 && esTexto(a) && esTexto(b);
    case "pagar":
      return x.length === 2 && (ROLES as readonly unknown[]).includes(a);
    case "calmar":
    case "cerrar":
      return x.length === 1;
    default:
      return false;
  }
}

const esNumero = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
export const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

function esFechaJugada(x: unknown): x is FechaJugada {
  if (!esObjeto(x)) return false;
  return (
    esEntero(x["fecha"]) &&
    typeof x["hayPartido"] === "boolean" &&
    typeof x["gano"] === "boolean" &&
    esEntero(x["golesFavor"]) &&
    esEntero(x["golesContra"])
  );
}

export function esModo(x: unknown): x is Modo {
  return esObjeto(x) && (FORMATOS as readonly unknown[]).includes(x["formato"]) && (COMPETENCIAS as readonly unknown[]).includes(x["competencia"]);
}

export function esApodos(x: unknown): x is Apodos {
  if (!esObjeto(x)) return false;
  const { contactos, vos, grupo } = x;
  const textos = contactos === undefined || (esObjeto(contactos) && Object.values(contactos).every(esTexto));
  return textos && (vos === undefined || esTexto(vos)) && (grupo === undefined || esTexto(grupo));
}

/** Los guardados de antes del modo no lo traen: son del torneo de fútbol 5. */
function esCampana(x: unknown): x is Campana {
  if (!esObjeto(x)) return false;
  return (
    (x["modo"] === undefined || esModo(x["modo"])) &&
    (x["apodos"] === undefined || esApodos(x["apodos"])) &&
    (PERFILES as readonly unknown[]).includes(x["perfil"]) &&
    esTexto(x["semilla"]) &&
    esEntero(x["fecha"]) &&
    (x["fecha"] as number) >= 1 &&
    esNumero(x["dinero"]) &&
    esNumero(x["prestigio"]) &&
    esEntero(x["fechasSinPartido"]) &&
    esEntero(x["fechasConDeuda"]) &&
    Array.isArray(x["jugadas"]) &&
    x["jugadas"].every(esFechaJugada) &&
    (x["fin"] === null || (FINES_CAMPANA as readonly unknown[]).includes(x["fin"]))
  );
}

export function esViernes(x: unknown): x is ViernesGuardado {
  if (!esObjeto(x)) return false;
  return (
    esEntero(x["fecha"]) &&
    esNumero(x["dinero"]) &&
    esTexto(x["contenido"]) &&
    Array.isArray(x["pasos"]) &&
    x["pasos"].every(esPaso)
  );
}

/** Lee un guardado. Si está roto o es de otro formato, devuelve null y el juego arranca de cero. */
export function leerGuardado(texto: string): Guardado | null {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!esObjeto(crudo)) return null;
  const { formato, campana, viernes, vista } = crudo;
  if (formato !== FORMATO_GUARDADO || !esCampana(campana) || !esViernes(viernes)) return null;
  const conModo: Campana = { ...campana, modo: campana.modo ?? MODO_POR_DEFECTO };
  return { formato, campana: conModo, viernes, ...(vista !== undefined ? { vista } : {}) };
}
