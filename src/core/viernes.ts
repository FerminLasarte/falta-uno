/**
 * Cómo se arma un viernes a partir del contenido. Es lo mismo al empezarlo, al
 * retomarlo y al reproducirlo para analizarlo: si cambiara en alguno de los
 * tres, el mismo registro daría otra partida.
 */
import { personalizar, type Apodos } from "./apodos.js";
import { rivalDeFecha, semillaDeFecha, type DefinicionTorneo } from "./campana.js";
import { configDeViernes, MODO_POR_DEFECTO, type ConfigContenido, type Modo } from "./modo.js";
import type { Frases } from "./frases.js";
import type { Relato } from "./relato.js";
import type { DefinicionGrupo } from "./grupo.js";
import { charlaDeInscripcion, type DefinicionInscripcion } from "./inscripcion.js";
import type { DefinicionInterrupcion } from "./interrupciones.js";
import type { OpcionesPartida } from "./partida.js";
import { agendaDe } from "./perfiles.js";
import type { DefinicionContacto, DefinicionPerfil } from "./tipos.js";

/** Lo del contenido que hace falta para armar un viernes. */
export interface ContenidoDelViernes {
  readonly config: ConfigContenido;
  readonly perfiles: readonly DefinicionPerfil[];
  readonly contactos: readonly DefinicionContacto[];
  readonly interrupciones: readonly DefinicionInterrupcion[];
  readonly grupo: DefinicionGrupo;
  readonly inscripcion: DefinicionInscripcion;
  readonly frases: Frases;
  readonly relato: Relato;
  readonly torneo: DefinicionTorneo;
}

/** Lo que eligió quien juega al arrancar: el modo y los apodos de sus amigos. */
export interface Ajustes {
  readonly modo?: Modo;
  readonly apodos?: Apodos;
}

export function opcionesDeViernes(
  contenido: ContenidoDelViernes,
  perfil: DefinicionPerfil,
  semillaCampana: string,
  viernes: { readonly fecha: number; readonly dinero: number },
  ajustes: Ajustes = {},
): OpcionesPartida {
  const modo = ajustes.modo ?? MODO_POR_DEFECTO;
  const { agenda, grupo, interrupciones } = personalizar(
    { agenda: agendaDe(perfil, contenido.perfiles, contenido.contactos), grupo: contenido.grupo, interrupciones: contenido.interrupciones },
    ajustes.apodos,
    modo,
  );
  const config = { ...configDeViernes(contenido.config, modo), rival: rivalDeFecha(contenido.torneo, viernes.fecha) };
  const { inscripcion } = contenido;
  return {
    perfil,
    agenda,
    // La charla con la cancha es de la primera fecha: es cuando te anotás.
    ...(viernes.fecha === 1
      ? { inscripcion: { chat: inscripcion.chat, charla: charlaDeInscripcion(inscripcion, "perfil", modo, config), respuesta: inscripcion.respuesta } }
      : {}),
    // El viernes arranca con tu parte; lo de la campaña queda de colchón para la seña.
    dineroInicial: contenido.config.cuota,
    colchon: viernes.dinero,
    semilla: semillaDeFecha({ semilla: semillaCampana, fecha: viernes.fecha }),
    interrupciones,
    grupo,
    config,
    frases: contenido.frases,
    relato: contenido.relato,
  };
}
