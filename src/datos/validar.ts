import type { DefinicionGrupo, MensajeGrupo } from "../core/grupo.js";
import type { DefinicionInscripcion } from "../core/inscripcion.js";
import type { DefinicionInterrupcion } from "../core/interrupciones.js";
import { PARES_EN_ROCE } from "../core/roster.js";
import type { Config, DefinicionContacto, DefinicionPerfil } from "../core/tipos.js";

export interface ProblemaContenido {
  readonly archivo: string;
  readonly detalle: string;
}

/**
 * Chequeos que un schema por sí solo no puede hacer: que los links entre nodos
 * resuelvan, que no haya nodos huérfanos y que todo árbol tenga una salida.
 * Un link roto tiene que romper el build, no la partida.
 */
export function revisarGrafo(contacto: DefinicionContacto, archivo: string): ProblemaContenido[] {
  const problemas: ProblemaContenido[] = [];
  const ids = new Set(Object.keys(contacto.nodos));

  if (!ids.has(contacto.nodoInicial)) {
    problemas.push({
      archivo,
      detalle: `nodoInicial "${contacto.nodoInicial}" no existe entre los nodos definidos`,
    });
  }

  const alcanzables = new Set<string>();
  const pendientes = [contacto.nodoInicial];
  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    if (alcanzables.has(actual) || !ids.has(actual)) continue;
    alcanzables.add(actual);
    for (const opcion of contacto.nodos[actual]!.opciones) {
      if (opcion.siguiente !== null) pendientes.push(opcion.siguiente);
    }
  }

  for (const [nodoId, nodo] of Object.entries(contacto.nodos)) {
    const idsOpciones = new Set<string>();
    for (const opcion of nodo.opciones) {
      if (idsOpciones.has(opcion.id)) {
        problemas.push({ archivo, detalle: `nodo "${nodoId}": opción duplicada "${opcion.id}"` });
      }
      idsOpciones.add(opcion.id);

      if (opcion.siguiente !== null && !ids.has(opcion.siguiente)) {
        problemas.push({
          archivo,
          detalle: `nodo "${nodoId}", opción "${opcion.id}": apunta a "${opcion.siguiente}", que no existe`,
        });
      }
    }

    const esTerminal = nodo.opciones.length === 0;
    const cierra = nodo.opciones.some(
      (o) => o.siguiente === null || o.efectos.estado === "confirmado" || o.efectos.estado === "rechazado",
    );
    if (!esTerminal && !cierra) {
      const salidaEventual = nodo.opciones.some((o) => o.siguiente !== null);
      if (!salidaEventual) {
        problemas.push({ archivo, detalle: `nodo "${nodoId}": no tiene forma de cerrar la charla` });
      }
    }

    if (!alcanzables.has(nodoId)) {
      problemas.push({ archivo, detalle: `nodo "${nodoId}" es inalcanzable desde el nodoInicial` });
    }
  }

  const puedeConfirmar = Object.values(contacto.nodos).some((nodo) =>
    nodo.opciones.some((o) => o.efectos.estado === "confirmado"),
  );
  if (!puedeConfirmar) {
    problemas.push({ archivo, detalle: `no hay ninguna rama que lleve a "confirmado"` });
  }

  return problemas;
}

/**
 * Lo que el schema del grupo no puede ver solo: que quien habla exista en la
 * agenda, que cada roce sea un cruce que de verdad puede pasar, que los ids de
 * los audios no se repitan y que una respuesta que pide haber escuchado un
 * audio apunte a uno que existe.
 */
export function revisarGrupo(
  grupo: DefinicionGrupo,
  contactos: readonly DefinicionContacto[],
  config: Config,
): ProblemaContenido[] {
  const archivo = "grupo.json";
  const problemas: ProblemaContenido[] = [];
  const ids = new Set(contactos.map((c) => c.id));
  const audios = new Set<string>();

  /* Una cita muestra lo que dijo el otro, y lo que dice un audio no se sabe hasta escucharlo. */
  const revisarCitas = (mensajes: readonly MensajeGrupo[], donde: string): void => {
    mensajes.forEach((m, i) => {
      if (m.cita && mensajes[i - 1]?.audio) problemas.push({ archivo, detalle: `${donde}: no se puede citar un audio` });
      if (m.cita && i === 0) problemas.push({ archivo, detalle: `${donde}: el primer mensaje no tiene a quién citar` });
    });
  };

  const revisarAudio = (m: MensajeGrupo, donde: string): void => {
    if (!m.audio) return;
    if (audios.has(m.audio.id)) problemas.push({ archivo, detalle: `${donde}: el audio "${m.audio.id}" está repetido` });
    audios.add(m.audio.id);
  };

  for (const charla of grupo.charlas) {
    const donde = `charla "${charla.id}"`;
    revisarCitas(charla.mensajes, donde);
    for (const m of charla.mensajes) {
      if (!ids.has(m.de)) problemas.push({ archivo, detalle: `${donde}: "${m.de}" no está en la agenda` });
      revisarAudio(m, donde);
    }
    const { cuando } = charla;
    if ("alConfirmar" in cuando && !ids.has(cuando.alConfirmar)) {
      problemas.push({ archivo, detalle: `${donde}: alConfirmar "${cuando.alConfirmar}" no está en la agenda` });
    }
    if ("desde" in cuando && (cuando.hasta < config.horaInicio || cuando.desde >= config.horaCorte)) {
      problemas.push({ archivo, detalle: `${donde}: la franja cae fuera del viernes, nunca arranca` });
    }
  }

  grupo.roces.forEach((roce, i) => {
    const [x, y] = roce.entre;
    const existe = PARES_EN_ROCE.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
    if (!existe) problemas.push({ archivo, detalle: `roce ${i + 1}: ${x} y ${y} no se pelean nunca, no va a aparecer` });
    revisarCitas(roce.mensajes, `roce ${i + 1}`);
    for (const m of roce.mensajes) revisarAudio(m, `roce ${i + 1}`);
  });
  revisarCitas(grupo.calmar.respuestas, "calmar");
  for (const m of grupo.calmar.respuestas) revisarAudio(m, "calmar");

  for (const contacto of contactos) {
    for (const [nodoId, nodo] of Object.entries(contacto.nodos)) {
      for (const opcion of nodo.opciones) {
        const pedido = opcion.requiere?.escuchado;
        if (pedido !== undefined && !audios.has(pedido)) {
          problemas.push({
            archivo: `${contacto.id}.json`,
            detalle: `nodo "${nodoId}", opción "${opcion.id}": pide escuchar "${pedido}", y ese audio no existe`,
          });
        }
      }
    }
  }

  return problemas;
}

/**
 * Los perfiles y la inscripción, que es donde se eligen. Cada perfil tiene que
 * nombrar en su resumen al contacto que trae, porque eso es lo que el jugador
 * lee para elegir; y la inscripción comparte el chat de una interrupción que
 * existe.
 */
export function revisarPerfiles(
  perfiles: readonly DefinicionPerfil[],
  contactos: readonly DefinicionContacto[],
  interrupciones: readonly DefinicionInterrupcion[],
  inscripcion: DefinicionInscripcion,
): ProblemaContenido[] {
  const problemas: ProblemaContenido[] = [];
  const archivo = "perfiles.json";
  const unicos = new Set<string>();
  for (const perfil of perfiles) {
    const unico = contactos.find((c) => c.id === perfil.contactoUnico);
    if (!unico) {
      problemas.push({ archivo, detalle: `${perfil.id}: el contacto único "${perfil.contactoUnico}" no existe` });
    } else if (!perfil.resumen.includes(unico.nombre)) {
      problemas.push({ archivo, detalle: `${perfil.id}: el resumen no nombra a ${unico.nombre}, su contacto único` });
    }
    if (unicos.has(perfil.contactoUnico)) {
      problemas.push({ archivo, detalle: `${perfil.id}: "${perfil.contactoUnico}" ya es el contacto único de otro perfil` });
    }
    unicos.add(perfil.contactoUnico);
    for (const id of Object.keys(perfil.probabilidadInterrupciones ?? {})) {
      if (!interrupciones.some((i) => i.id === id)) {
        problemas.push({ archivo, detalle: `${perfil.id}: la interrupción "${id}" no existe` });
      }
    }
  }
  if (!interrupciones.some((i) => i.id === inscripcion.chat)) {
    problemas.push({ archivo: "inscripcion.json", detalle: `chat "${inscripcion.chat}" no es el de ninguna interrupción` });
  }
  return problemas;
}
