import { describe, expect, it } from "vitest";
import { completar, personalizar } from "../src/core/apodos.js";
import { nuevaCampana } from "../src/core/campana.js";
import { configDeViernes, MODO_POR_DEFECTO, type Modo } from "../src/core/modo.js";
import { alDia, Partida } from "../src/core/partida.js";
import { FORMATO_GUARDADO, leerGuardado } from "../src/core/registro.js";
import { faltantes, formacion, quimica } from "../src/core/roster.js";
import { opcionesDeViernes } from "../src/core/viernes.js";
import { cargarContenido } from "../src/datos/cargar.js";
import { contacto, PERFIL } from "./ayudas.js";

const contenido = await cargarContenido();
const config = (modo: Modo) => configDeViernes(contenido.config, modo);

describe("los modos", () => {
  it("en un partido van los titulares; en el torneo, tres más", () => {
    expect(config({ formato: "f5", competencia: "partido" }).jugadoresNecesarios).toBe(5);
    expect(config({ formato: "f6", competencia: "partido" }).jugadoresNecesarios).toBe(6);
    expect(config({ formato: "f8", competencia: "partido" }).jugadoresNecesarios).toBe(8);
    expect(config({ formato: "f5", competencia: "torneo" }).jugadoresNecesarios).toBe(8);
    expect(config({ formato: "f8", competencia: "torneo" }).jugadoresNecesarios).toBe(11);
  });

  it("la cancha más grande sale más cara, se juegue partido o torneo", () => {
    const f5 = config({ formato: "f5", competencia: "partido" }).senaCancha;
    expect(config({ formato: "f5", competencia: "torneo" }).senaCancha).toBe(f5);
    expect(config({ formato: "f8", competencia: "partido" }).senaCancha).toBeGreaterThan(f5);
  });

  it("los que sobran de un puesto cubierto cuentan como suplentes", () => {
    const { composicion, jugadoresNecesarios } = config(MODO_POR_DEFECTO);
    const arquero = contacto("arq", { rol: "arquero" });
    const defensores = Array.from({ length: 4 }, (_, i) => contacto(`d${i}`, { rol: "defensor" }));
    const r = faltantes([arquero, ...defensores], composicion, jugadoresNecesarios);
    // Faltan el 5 y el 9; de los cuatro defensores sobran dos, que ya son suplentes: falta uno.
    expect(r.porPuesto).toEqual([{ rol: "mediocampista", faltan: 1 }, { rol: "delantero", faltan: 1 }]);
    expect(r.suplentes).toBe(1);
  });

  it("con un arquero alcanza: es tu equipo, no los dos", () => {
    const { composicion } = config(MODO_POR_DEFECTO);
    const campo = [
      contacto("d1", { rol: "defensor" }),
      contacto("d2", { rol: "defensor" }),
      contacto("m", { rol: "mediocampista" }),
      contacto("f", { rol: "delantero" }),
    ];
    const conArquero = [contacto("arq", { rol: "arquero" }), ...campo];
    const sinArquero = [contacto("d3", { rol: "defensor" }), ...campo];
    const todo = (plantel: typeof campo) => [...formacion(plantel, composicion), ...quimica(plantel, composicion)];
    expect(todo(conArquero).some((d) => d.concepto.includes("arquero") && d.valor < 0)).toBe(false);
    expect(todo(sinArquero).some((d) => d.concepto.includes("Ningún arquero"))).toBe(true);
  });

  it("un partido de fútbol 5 se puede cerrar con cinco", () => {
    const modo: Modo = { formato: "f5", competencia: "partido" };
    const p = new Partida(opcionesDeViernes(contenido, contenido.perfiles[2]!, "partido", { fecha: 1, dinero: 9000 }, { modo }));
    for (const c of p.contactos()) {
      if (p.roster().confirmados >= 5) break;
      p.escribir(c.id);
      alDia(p);
      for (let i = 0; i < 6; i++) {
        const o = p.opcionesDisponibles(c.id);
        const elegida = o.find((x) => x.efectos.estado === "confirmado") ?? o.find((x) => x.siguiente !== null && !x.efectos.estado);
        if (!elegida) break;
        p.responder(c.id, elegida.id);
        alDia(p);
      }
    }
    expect(p.roster().confirmados).toBeGreaterThanOrEqual(5);
    expect(p.accionCerrar?.completa).toBe(true);
  });
});

describe("los apodos", () => {
  const nombres = { contactos: new Map([["el_tano", "El Tano"], ["fede", "Colo"]]), vos: "Fermo", grupo: "Los Galácticos" };

  it("completa las marcas en minúscula y contrae «a el» y «de el»", () => {
    expect(completar("vi a {el_tano} en la lista", nombres)).toBe("vi al tano en la lista");
    expect(completar("el kukardo de {el_tano}", nombres)).toBe("el kukardo del tano");
    expect(completar("{voc:el_tano} es un picado", nombres)).toBe("tano es un picado");
    expect(completar("{vos} hoy se juega?", nombres)).toBe("fermo hoy se juega?");
    expect(completar("si va {fede} no voy", nombres)).toBe("si va colo no voy");
  });

  it("en un título, el nombre va como lo escribiste", () => {
    expect(completar("Grupo {grupo}", nombres, false)).toBe("Grupo Los Galácticos");
  });

  it("deja tranquilas las marcas que no son suyas: las de las peleas", () => {
    expect(completar("si viene {b} me voy", nombres)).toBe("si viene {b} me voy");
  });

  it("el viernes sale con los nombres de tus amigos", () => {
    const perfil = contenido.perfiles.find((p) => p.id === "oficinista")!;
    const opciones = opcionesDeViernes(contenido, perfil, "apodos", { fecha: 1, dinero: 9000 }, {
      apodos: { contactos: { el_tano: "Pepe", fede_el_habilidoso: "El Colo" }, vos: "Fermo", grupo: "Los del Jueves" },
    });
    const fede = opciones.agenda.find((c) => c.id === "fede_el_habilidoso")!;
    expect(fede.nombre).toBe("El Colo");
    expect(fede.nodos["abre"]!.mensajes.join(" ")).toContain("si va pepe ni en pedo");
    expect(fede.nodos["abre"]!.opciones.find((o) => o.id === "cagon")!.texto).toBe("colo no seas cagón, es un picado");
    expect(opciones.interrupciones.find((i) => i.id === "grupo_incendiado")!.de).toBe("Grupo Los del Jueves");
  });

  it("sin apodos, todo queda con los nombres de los personajes", () => {
    const { agenda } = personalizar({ agenda: contenido.contactos, grupo: contenido.grupo, interrupciones: contenido.interrupciones }, undefined, MODO_POR_DEFECTO);
    const fede = agenda.find((c) => c.id === "fede_el_habilidoso")!;
    expect(fede.nodos["abre"]!.mensajes.join(" ")).toContain("si va el tano ni en pedo");
  });
});

describe("la campaña recuerda el modo y los apodos", () => {
  it("y un guardado de antes, sin modo, es del torneo de fútbol 5", () => {
    const viejo = { ...nuevaCampana(PERFIL, "s") } as Record<string, unknown>;
    delete viejo["modo"];
    const leido = leerGuardado(
      JSON.stringify({ formato: FORMATO_GUARDADO, campana: viejo, viernes: { fecha: 1, dinero: 0, contenido: "x", pasos: [] } }),
    );
    expect(leido?.campana.modo).toEqual(MODO_POR_DEFECTO);
  });
});
