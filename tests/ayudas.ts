import type { DefinicionInterrupcion } from "../src/core/interrupciones.js";
import type {
  Config,
  DefinicionContacto,
  DefinicionPerfil,
  Efectos,
  Rasgo,
  Rol,
} from "../src/core/tipos.js";

export const CONFIG: Config = {
  horaInicio: 1140,
  horaCorte: 1260,
  jugadoresNecesarios: 10,
  senaCancha: 15000,
  costoVacante: 5000,
  umbralBaja: 80,
  minutoRevision: 1230,
};

export const PERFIL: DefinicionPerfil = {
  id: "oficinista",
  nombre: "El Oficinista",
  moralInicial: 70,
  dineroInicial: 20000,
  ventaja: "-",
  desventaja: "-",
  contactoUnico: "el_sindicalista",
};

interface OpcionesContacto {
  rol?: Rol;
  habilidad?: number;
  rasgos?: Rasgo[];
  probabilidadBajaInicial?: number;
  /** Efectos extra que aplica la opción "si". */
  alConfirmar?: Efectos;
  /** Mensajes del NPC al abrir la charla. */
  mensajes?: string[];
}

/** Contacto mínimo: un nodo, una opción que confirma y una que rechaza. */
export function contacto(id: string, opciones: OpcionesContacto = {}): DefinicionContacto {
  return {
    id,
    nombre: id,
    rol: opciones.rol ?? "mediocampista",
    habilidad: opciones.habilidad ?? 60,
    rasgos: opciones.rasgos ?? [],
    probabilidadBajaInicial: opciones.probabilidadBajaInicial ?? 0,
    nodoInicial: "abre",
    nodos: {
      abre: {
        mensajes: opciones.mensajes ?? ["¿A qué hora?"],
        opciones: [
          {
            id: "si",
            texto: "21:00",
            costoReloj: 2,
            efectos: { estado: "confirmado", ...opciones.alConfirmar },
            siguiente: null,
          },
          {
            id: "no",
            texto: "Nada, olvidate",
            costoReloj: 1,
            efectos: { estado: "rechazado" },
            siguiente: null,
          },
          {
            id: "apurar",
            texto: "Dale que no tengo todo el día",
            costoReloj: 4,
            efectos: { probabilidadBaja: 90, estado: "confirmado", registrar: "apuro", moral: -5 },
            siguiente: null,
          },
        ],
      },
    },
  };
}

/** Doce contactos con la composición justa para completar el plantel. */
export function agendaCompleta(): DefinicionContacto[] {
  const reparto: Rol[] = [
    "arquero",
    "arquero",
    "defensor",
    "defensor",
    "defensor",
    "mediocampista",
    "mediocampista",
    "mediocampista",
    "delantero",
    "delantero",
    "defensor",
    "mediocampista",
  ];
  return reparto.map((rol, i) => contacto(`c${i}`, { rol, alConfirmar: { dineroAportado: 1500 } }));
}

export const SIN_INTERRUPCIONES: DefinicionInterrupcion[] = [];

export function interrupcionSegura(
  id: string,
  minuto: number,
  insistencias: DefinicionInterrupcion["insistencias"] = [],
): DefinicionInterrupcion {
  return {
    id,
    de: "Sofi",
    texto: "¿Vas a estar con el teléfono toda la noche?",
    minutoDesde: minuto,
    minutoHasta: minuto + 60,
    probabilidad: 100,
    drenajePorAccion: 2,
    costoAtender: 15,
    efectosAtender: { moral: 5 },
    registrarSiIgnorada: "pareja_ignorada",
    insistencias,
  };
}

