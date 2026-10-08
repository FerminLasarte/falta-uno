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
import { ROLES, type Rol } from "./tipos.js";

export type Paso =
  | readonly ["t", number]
  | readonly ["escribir", string]
  | readonly ["responder", string, string]
  | readonly ["llamar", string]
  | readonly ["pagar", Rol]
  | readonly ["atender", string]
  | readonly ["escuchar", string]
  | readonly ["calmar"]
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
    case "esperar":
      return partida.esperar(paso[1]);
  }
}

/** Una partida y lo que se hizo en ella. Todo comando que se quiera guardar pasa por acá. */
export class Registro {
  private readonly lista: Paso[] = [];

  constructor(readonly partida: Partida) {}

  get pasos(): readonly Paso[] {
    return this.lista;
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

export const FORMATO_GUARDADO = 1;

export interface ViernesGuardado {
  readonly perfil: string;
  readonly semilla: string;
  /** Huella del contenido con el que se jugó. Si no coincide, la reproducción puede cortarse antes. */
  readonly contenido: string;
  readonly pasos: readonly Paso[];
}

export interface Guardado {
  readonly formato: typeof FORMATO_GUARDADO;
  readonly viernes: ViernesGuardado;
  /** Lo que la vista quiere recordar: dónde estabas y qué ya viste. El núcleo no lo interpreta. */
  readonly vista?: unknown;
}

/** Una huella corta del contenido, para saber si el juego se actualizó en medio de un viernes. */
export function huella(texto: string): string {
  return hashTexto(texto).toString(16).padStart(8, "0");
}

const esTexto = (x: unknown): x is string => typeof x === "string";
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
      return x.length === 1;
    default:
      return false;
  }
}

/** Lee un guardado. Si está roto o es de otro formato, devuelve null y el juego arranca de cero. */
export function leerGuardado(texto: string): Guardado | null {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof crudo !== "object" || crudo === null) return null;
  const { formato, viernes, vista } = crudo as Record<string, unknown>;
  if (formato !== FORMATO_GUARDADO || typeof viernes !== "object" || viernes === null) return null;
  const v = viernes as Record<string, unknown>;
  if (!esTexto(v["perfil"]) || !esTexto(v["semilla"]) || !esTexto(v["contenido"])) return null;
  const pasos = v["pasos"];
  if (!Array.isArray(pasos) || !pasos.every(esPaso)) return null;
  return {
    formato,
    viernes: { perfil: v["perfil"], semilla: v["semilla"], contenido: v["contenido"], pasos },
    ...(vista !== undefined ? { vista } : {}),
  };
}
