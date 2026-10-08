import type { DefinicionGrupo, MensajeGrupo } from "../core/grupo.js";
import type { DefinicionInscripcion } from "../core/inscripcion.js";
import type { DefinicionInterrupcion } from "../core/interrupciones.js";
import { PARES_EN_ROCE } from "../core/roster.js";
import { MARCAS_FIJAS, marcasDe } from "../core/apodos.js";
import type { ConfigContenido } from "../core/modo.js";
import { CLAVES_DEL_RELATO, MARCAS_DEL_RELATO, type Relato } from "../core/relato.js";
import { destinos, type Condicion, type DefinicionContacto, type DefinicionPerfil } from "../core/tipos.js";

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

  for (const apertura of contacto.aperturas ?? []) {
    if (!ids.has(apertura.nodo)) {
      problemas.push({ archivo, detalle: `apertura: el nodo "${apertura.nodo}" no existe` });
    }
  }

  const alcanzables = new Set<string>();
  const pendientes = [contacto.nodoInicial, ...(contacto.aperturas ?? []).map((a) => a.nodo)];
  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    if (alcanzables.has(actual) || !ids.has(actual)) continue;
    alcanzables.add(actual);
    for (const opcion of contacto.nodos[actual]!.opciones) {
      for (const destino of destinos(opcion)) if (destino !== null) pendientes.push(destino);
    }
  }

  for (const [nodoId, nodo] of Object.entries(contacto.nodos)) {
    const idsOpciones = new Set<string>();
    for (const opcion of nodo.opciones) {
      if (idsOpciones.has(opcion.id)) {
        problemas.push({ archivo, detalle: `nodo "${nodoId}": opción duplicada "${opcion.id}"` });
      }
      idsOpciones.add(opcion.id);

      for (const destino of destinos(opcion)) {
        if (destino !== null && !ids.has(destino)) {
          problemas.push({
            archivo,
            detalle: `nodo "${nodoId}", opción "${opcion.id}": apunta a "${destino}", que no existe`,
          });
        }
      }
      if (Array.isArray(opcion.siguiente) && opcion.siguiente.at(-1)?.si !== undefined) {
        problemas.push({
          archivo,
          detalle: `nodo "${nodoId}", opción "${opcion.id}": el último desvío tiene que ir sin condición, para cuando no se cumple ninguno`,
        });
      }
    }

    const esTerminal = nodo.opciones.length === 0;
    const cierra = nodo.opciones.some(
      (o) => destinos(o).includes(null) || o.efectos.estado === "confirmado" || o.efectos.estado === "rechazado",
    );
    if (!esTerminal && !cierra) {
      const salidaEventual = nodo.opciones.some((o) => destinos(o).some((d) => d !== null));
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

  // `elegiste` habla de este mismo contacto: tiene que nombrar una respuesta suya.
  const idsOpciones = new Set(Object.values(contacto.nodos).flatMap((n) => n.opciones.map((o) => o.id)));
  for (const { donde, condicion } of condicionesDe(contacto)) {
    if (condicion.elegiste !== undefined && !idsOpciones.has(condicion.elegiste)) {
      problemas.push({ archivo, detalle: `${donde}: elegiste "${condicion.elegiste}", y no hay ninguna respuesta con ese id` });
    }
  }

  return problemas;
}

/** Todas las condiciones de un contacto, con dónde está cada una para poder decirlo. */
export function condicionesDe(contacto: DefinicionContacto): { donde: string; condicion: Condicion }[] {
  const salida: { donde: string; condicion: Condicion }[] = [];
  contacto.aperturas?.forEach((a, i) => salida.push({ donde: `apertura ${i + 1}`, condicion: a.si }));
  contacto.bajas?.forEach((b, i) => b.si && salida.push({ donde: `baja ${i + 1}`, condicion: b.si }));
  for (const [nodoId, nodo] of Object.entries(contacto.nodos)) {
    for (const opcion of nodo.opciones) {
      const donde = `nodo "${nodoId}", opción "${opcion.id}"`;
      if (opcion.requiere) salida.push({ donde, condicion: opcion.requiere });
      if (Array.isArray(opcion.siguiente)) {
        opcion.siguiente.forEach((d, i) => d.si && salida.push({ donde: `${donde}, desvío ${i + 1}`, condicion: d.si }));
      }
    }
  }
  return salida;
}

/**
 * Lo que un contacto nombra de otro tiene que existir: los contactos de
 * `confirmado`, `noConfirmado` y `elegidoA` (y la respuesta que nombra), y a
 * quién le llega un efecto. Si el otro no está en la agenda de un perfil, la
 * condición no se cumple y el efecto no hace nada; si no existe en ningún
 * lado, es un error de tipeo.
 */
export function revisarCondiciones(contactos: readonly DefinicionContacto[]): ProblemaContenido[] {
  const problemas: ProblemaContenido[] = [];
  const porId = new Map(contactos.map((c) => [c.id, c]));
  for (const contacto of contactos) {
    const archivo = `${contacto.id}.json`;
    const existe = (otro: string | undefined, donde: string): boolean => {
      if (otro === undefined || porId.has(otro)) return true;
      problemas.push({ archivo, detalle: `${donde}: el contacto "${otro}" no existe` });
      return false;
    };
    for (const { donde, condicion } of condicionesDe(contacto)) {
      existe(condicion.confirmado, donde);
      existe(condicion.noConfirmado, donde);
      const elegido = condicion.elegidoA;
      if (elegido && existe(elegido.contacto, donde)) {
        const otro = porId.get(elegido.contacto)!;
        const tiene = Object.values(otro.nodos).some((n) => n.opciones.some((o) => o.id === elegido.opcion));
        if (!tiene) problemas.push({ archivo, detalle: `${donde}: ${otro.id} no tiene ninguna respuesta "${elegido.opcion}"` });
      }
    }
    for (const [nodoId, nodo] of Object.entries(contacto.nodos)) {
      for (const opcion of nodo.opciones) {
        for (const otro of opcion.efectos.otros ?? []) existe(otro.contacto, `nodo "${nodoId}", opción "${opcion.id}"`);
      }
    }
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
  config: Pick<ConfigContenido, "horaInicio" | "horaCorte">,
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
    for (const { donde, condicion } of condicionesDe(contacto)) {
      const pedido = condicion.escuchado;
      if (pedido !== undefined && !audios.has(pedido)) {
        problemas.push({
          archivo: `${contacto.id}.json`,
          detalle: `${donde}: pide escuchar "${pedido}", y ese audio no existe`,
        });
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
    for (const id of perfil.excluidos ?? []) {
      if (!contactos.some((c) => c.id === id)) problemas.push({ archivo, detalle: `${perfil.id}: excluye a "${id}", que no existe` });
    }
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

/**
 * Las marcas de los textos ({el_tano}, {voc:santi_el_goleador}, {vos}, {grupo})
 * tienen que nombrar algo que exista: si no, en el chat aparece la marca cruda.
 * En las peleas valen además {a} y {b}, que son los que se pelean.
 */
export function revisarMarcas(
  contactos: readonly DefinicionContacto[],
  grupo: DefinicionGrupo,
  interrupciones: readonly DefinicionInterrupcion[],
): ProblemaContenido[] {
  const problemas: ProblemaContenido[] = [];
  const validas = new Set<string>([...contactos.map((c) => c.id), ...MARCAS_FIJAS]);
  const revisar = (texto: string, archivo: string, donde: string, extra: readonly string[] = []): void => {
    for (const id of marcasDe(texto)) {
      if (!validas.has(id) && !extra.includes(id)) problemas.push({ archivo, detalle: `${donde}: la marca {${id}} no nombra a nadie` });
    }
  };
  for (const c of contactos) {
    const archivo = `${c.id}.json`;
    for (const [nodoId, nodo] of Object.entries(c.nodos)) {
      for (const m of nodo.mensajes) revisar(m, archivo, `nodo "${nodoId}"`);
      for (const o of nodo.opciones) revisar(o.texto, archivo, `nodo "${nodoId}", opción "${o.id}"`);
    }
    for (const b of c.bajas ?? []) revisar(b.texto, archivo, "baja");
  }
  const textosDe = (m: MensajeGrupo): string[] => [m.texto ?? "", m.audio?.transcripcion ?? ""];
  for (const ch of grupo.charlas) for (const m of ch.mensajes) for (const t of textosDe(m)) revisar(t, "grupo.json", `charla "${ch.id}"`);
  grupo.roces.forEach((r, i) => {
    for (const m of r.mensajes) for (const t of textosDe(m)) revisar(t, "grupo.json", `roce ${i + 1}`, ["a", "b"]);
    if (r.calmar) revisar(r.calmar, "grupo.json", `roce ${i + 1}`, ["a", "b"]);
  });
  for (const t of [grupo.calmar.mensaje, grupo.cerrar.mensaje, grupo.cerrar.sinDiez]) revisar(t, "grupo.json", "calmar/cerrar");
  for (const m of grupo.calmar.respuestas) for (const t of textosDe(m)) revisar(t, "grupo.json", "calmar", ["a", "b"]);
  for (const i of interrupciones) {
    for (const t of [i.de, i.texto, ...(i.insistencias ?? []).map((x) => x.texto)]) revisar(t, "interrupciones.json", `"${i.id}"`);
  }
  return problemas;
}

/** Cada fraseo del relato usa solo las marcas de su clave: si no, en la app aparece la marca cruda. */
export function revisarRelato(relato: Relato): ProblemaContenido[] {
  const problemas: ProblemaContenido[] = [];
  for (const clave of CLAVES_DEL_RELATO) {
    const validas: readonly string[] = MARCAS_DEL_RELATO[clave];
    for (const texto of relato[clave]) {
      for (const marca of marcasDe(texto)) {
        if (!validas.includes(marca)) {
          problemas.push({
            archivo: "relato.json",
            detalle: `"${clave}" usa {${marca}}, que no existe ahí (${validas.length > 0 ? validas.map((m) => `{${m}}`).join(", ") : "no lleva marcas"})`,
          });
        }
      }
    }
  }
  return problemas;
}
