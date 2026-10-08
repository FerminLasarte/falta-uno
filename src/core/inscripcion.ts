/**
 * La inscripción al torneo: la charla con la cancha con la que arranca una
 * campaña. Pregunta cómo van a pagar la seña, y lo que contestás es el perfil.
 *
 * Es el mismo chat de la interrupción de la cancha: cuando más tarde pregunte
 * si confirman, lo hace debajo de esto.
 */
import { formatearPesos } from "./formato.js";
import type { Config } from "./tipos.js";

export interface DefinicionInscripcion {
  /** El id de la interrupción cuyo chat comparte. */
  readonly chat: string;
  /** Lo que escribe la cancha antes de que elijas. `{sena}` es la seña. */
  readonly mensajes: readonly string[];
  /** Lo que contesta la cancha después de que elegís. */
  readonly respuesta: string;
}

/** Los mensajes de la cancha, con la seña ya escrita. */
export function textosDeInscripcion(inscripcion: DefinicionInscripcion, config: Config): string[] {
  return inscripcion.mensajes.map((m) => m.replaceAll("{sena}", formatearPesos(config.senaCancha)));
}
