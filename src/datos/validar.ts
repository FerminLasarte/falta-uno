import type { DefinicionContacto } from "../core/tipos.js";

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
