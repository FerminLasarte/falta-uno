/**
 * La inscripción: la charla con la cancha con la que arranca todo. Te pregunta
 * qué buscan (un partido suelto o el torneo), de cuánto es la cancha y cómo la
 * van a pagar: lo que contestás es el modo y el perfil.
 *
 * Es el mismo chat de la interrupción de la cancha: cuando más tarde pregunte
 * si confirman, lo hace debajo de esto.
 */
import { formatearPesos } from "./formato.js";
import type { Competencia, Formato, Modo } from "./modo.js";
import type { Config } from "./tipos.js";

/** Lo que contestás en un paso, y lo que implica, debajo. */
export interface RespuestaInscripcion {
  readonly respuesta: string;
  readonly titulo: string;
  readonly resumen: string;
}

/** La charla tal como está en `contenido/inscripcion.json`. `{sena}` es la seña. */
export interface DefinicionInscripcion {
  /** El id de la interrupción cuyo chat comparte. */
  readonly chat: string;
  readonly saludo: string;
  readonly competencias: Readonly<Record<Competencia, RespuestaInscripcion>>;
  readonly preguntaFormato: Readonly<Record<Competencia, string>>;
  /** Lo que contestás para cada cancha. */
  readonly formatos: Readonly<Record<Formato, string>>;
  /** Lo que dice la cancha ya con el modo elegido, y la pregunta de cómo pagan. */
  readonly confirmacion: Readonly<Record<Competencia, readonly string[]>>;
  /** Lo que contesta la cancha después de que elegís cómo pagan. */
  readonly respuesta: string;
}

/** Un renglón de la charla: de la cancha, o tuyo. */
export interface RenglonInscripcion {
  readonly tuyo: boolean;
  readonly texto: string;
}

/** La charla ya resuelta para un modo: lo que el viernes muestra en el chat de la cancha. */
export interface InscripcionResuelta {
  readonly chat: string;
  readonly charla: readonly RenglonInscripcion[];
  readonly respuesta: string;
}

/** Hasta qué pregunta va la charla: la de qué buscan, la de la cancha o la de cómo pagan. */
export type PasoInscripcion = "competencia" | "formato" | "perfil";

/**
 * La charla hasta un paso. En "competencia" solo saluda y pregunta; en
 * "formato" ya contestaste qué buscan (si se pasa `modo`); en "perfil" ya
 * contestaste todo menos cómo pagan.
 */
export function charlaDeInscripcion(
  def: DefinicionInscripcion,
  paso: PasoInscripcion,
  modo?: Partial<Modo>,
  config?: Pick<Config, "senaCancha">,
): RenglonInscripcion[] {
  const charla: RenglonInscripcion[] = [{ tuyo: false, texto: def.saludo }];
  if (paso === "competencia" || !modo?.competencia) return charla;
  charla.push({ tuyo: true, texto: def.competencias[modo.competencia].respuesta });
  charla.push({ tuyo: false, texto: def.preguntaFormato[modo.competencia] });
  if (paso === "formato" || !modo.formato) return charla;
  charla.push({ tuyo: true, texto: def.formatos[modo.formato] });
  const sena = config ? formatearPesos(config.senaCancha) : "";
  for (const texto of def.confirmacion[modo.competencia]) charla.push({ tuyo: false, texto: texto.replaceAll("{sena}", sena) });
  return charla;
}
