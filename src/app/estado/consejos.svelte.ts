/**
 * Los avisos de primera vez: una tarjeta en el hilo del chat, la primera vez que pasa lo que
 * explica (abrís el grupo, contestás, alguien duda, se acerca la revisión). Se ve una vez por
 * computadora, no por campaña: lo que ya aprendiste no vuelve. La referencia entera está en la
 * pizarra de la tele.
 *
 * Una vez dado, queda en su lugar del hilo mientras dure la ventana: después de los mensajes
 * que había en ese chat cuando apareció.
 */
import type { Reglas } from "./reglas.js";

const CLAVE = "falta-uno:consejos";

export type IdConsejo = "lista" | "sena" | "reloj" | "moral" | "duda" | "revision";

export interface Consejo {
  readonly titulo: string;
  readonly texto: string;
}

export interface ConsejoEnHilo extends Consejo {
  readonly id: IdConsejo;
  readonly chat: string;
  /** Va después de esta cantidad de mensajes del chat. */
  readonly despuesDe: number;
}

/** Lo que dice cada uno, con los números del modo que se juega. */
function textoDe(id: IdConsejo, reglas: Reglas): Consejo {
  switch (id) {
    case "lista":
      return {
        titulo: "Cómo se llena la lista",
        texto: `Los que te confirman entran arriba, en su puesto. Las etiquetas dicen qué falta. A las ${reglas.corte} se juega con los que haya.`,
      };
    case "sena":
      return {
        titulo: "La seña",
        texto: "Cada uno que confirma pone su parte. Lo que llevás está arriba, a la derecha: se paga antes de entrar, con lo tuyo y lo guardado de la campaña.",
      };
    case "reloj":
      return {
        titulo: "Cada respuesta cuesta minutos",
        texto: "Lo ves al lado de cada una, antes de tocar. El reloj de arriba corre solo cuando hacés algo: leer no lo mueve.",
      };
    case "moral":
      return {
        titulo: "Te estás calentando",
        texto: "Las quejas, las peleas y los mensajes largos te bajan la moral, y se nota en el celu. Atender al que te reclama la recupera, pero cuesta reloj. En cero, lo apagás.",
      };
    case "duda":
      return {
        titulo: "Está dudando",
        texto: `Si no hacés nada, se baja ${reglas.plazoDuda === null ? `a las ${reglas.revision}` : `en ${reglas.plazoDuda} minutos`}. Llamarlo lo calma; si no, buscá a otro.`,
      };
    case "revision":
      return {
        titulo: `A las ${reglas.revision}, la revisión`,
        texto: "La cancha revisa la lista. Los que siguen dudando y los invitados que no vienen se caen ahí.",
      };
  }
}

function leerVistos(): Set<IdConsejo> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE) ?? "[]") as IdConsejo[]);
  } catch {
    return new Set();
  }
}

class Consejos {
  /** Los que ya aparecieron en esta ventana, cada uno en su chat. */
  enHilo = $state<ConsejoEnHilo[]>([]);
  #vistos = leerVistos();

  /** Lo da si nunca se vio en esta computadora. Llamarlo de más no hace nada. */
  dar(id: IdConsejo, chat: string, despuesDe: number, reglas: Reglas): void {
    if (this.#vistos.has(id)) return;
    this.#vistos.add(id);
    this.enHilo.push({ id, chat, despuesDe, ...textoDe(id, reglas) });
    try {
      localStorage.setItem(CLAVE, JSON.stringify([...this.#vistos]));
    } catch {
      // Sin almacenamiento, vuelven a aparecer la próxima vez que se abra el juego.
    }
  }

  /** Un viernes nuevo trae chats nuevos: los avisos del anterior no tienen dónde quedar. */
  empezarViernes(): void {
    this.enHilo = [];
  }

  del(chat: string): readonly ConsejoEnHilo[] {
    return this.enHilo.filter((c) => c.chat === chat);
  }
}

export const consejos = new Consejos();
