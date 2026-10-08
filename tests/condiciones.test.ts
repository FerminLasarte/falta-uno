import { describe, expect, it } from "vitest";
import { alDia, CHAT_GRUPO, Partida } from "../src/core/partida.js";
import { resolver } from "../src/core/resolucion.js";
import { rocesAlSumar } from "../src/core/roster.js";
import { revisarCondiciones, revisarGrafo } from "../src/datos/validar.js";
import { GRUPO_QUIETO, type DefinicionGrupo } from "../src/core/grupo.js";
import type { DefinicionContacto, OpcionDialogo } from "../src/core/tipos.js";
import { agendaCompleta, CONFIG, contacto, PERFIL, SIN_INTERRUPCIONES } from "./ayudas.js";

const confirma = (id: string, extra: Partial<OpcionDialogo> = {}): OpcionDialogo => ({
  id,
  texto: id,
  costoReloj: 2,
  efectos: { estado: "confirmado" },
  siguiente: null,
  ...extra,
});

/**
 * El que miente sobre el Tano: temprano y tarde abre distinto, si el Tano ya
 * está te descubre, y si confirma después de la mentira se baja a las 20:30.
 */
const mentiroso: DefinicionContacto = {
  ...contacto("fede"),
  nodoInicial: "abre",
  aperturas: [{ si: { horaDesde: 1200 }, nodo: "tarde" }],
  nodos: {
    abre: {
      mensajes: ["depende quién va"],
      opciones: [
        {
          id: "negar",
          texto: "no va",
          costoReloj: 2,
          efectos: {},
          siguiente: [{ si: { confirmado: "tano" }, nodo: "pillado" }, { nodo: "cierra" }],
        },
        { id: "contar", texto: "son varios", costoReloj: 2, efectos: {}, siguiente: [{ si: { confirmadosMin: 2 }, nodo: "cierra" }, { nodo: null }] },
      ],
    },
    tarde: { mensajes: ["uh recién me escribís"], opciones: [confirma("si")] },
    cierra: { mensajes: ["bueno voy"], opciones: [confirma("si")] },
    pillado: { mensajes: ["está en la lista"], opciones: [{ id: "bueno", texto: "[Bueno]", costoReloj: 1, efectos: { estado: "rechazado" }, siguiente: null }] },
  },
  bajas: [
    { si: { elegiste: "negar", confirmado: "tano" }, texto: "me mentiste forro", porque: "Le dijiste que el Tano no venía" },
    { texto: "me surgió algo" },
  ],
};

function partida(agenda: DefinicionContacto[], grupo: DefinicionGrupo = GRUPO_QUIETO): Partida {
  return new Partida({ perfil: PERFIL, agenda, interrupciones: SIN_INTERRUPCIONES, config: CONFIG, semilla: "cond", grupo });
}

/** Le escribe, deja llegar lo que dice y le contesta. */
function charlar(p: Partida, id: string, ...opciones: string[]): void {
  if (p.estadoDe(id).estado === "sin_contactar") p.escribir(id);
  alDia(p);
  for (const o of opciones) {
    expect(p.responder(id, o).ok, `${id}: ${o}`).toBe(true);
    alDia(p);
  }
}

const dijo = (p: Partida, id: string): string[] => p.eventos().filter((e) => e.chat === id && e.clase !== "propio").map((e) => e.texto);

describe("condiciones en los contactos", () => {
  it("abre distinto según la hora a la que le escribís", () => {
    const temprano = partida([mentiroso, contacto("tano")]);
    charlar(temprano, "fede");
    expect(dijo(temprano, "fede")).toEqual(["depende quién va"]);

    const tarde = partida([mentiroso, contacto("tano")]);
    tarde.esperar(60);
    charlar(tarde, "fede");
    expect(dijo(tarde, "fede")).toEqual(["uh recién me escribís"]);
  });

  it("la lista es pública: si el Tano ya está, la mentira se descubre en el momento", () => {
    const p = partida([mentiroso, contacto("tano")]);
    charlar(p, "tano", "si");
    charlar(p, "fede", "negar");
    expect(dijo(p, "fede")).toContain("está en la lista");
  });

  it("si el Tano confirma después de la mentira, se baja a las 20:30 aunque esté tranquilo", () => {
    const p = partida([mentiroso, contacto("tano")]);
    charlar(p, "fede", "negar", "si");
    charlar(p, "tano", "si");
    expect(p.estadoDe("fede").probabilidadBaja).toBeLessThan(CONFIG.umbralBaja);
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(p.estadoDe("fede").estado).toBe("bajado");
    expect(dijo(p, "fede")).toContain("me mentiste forro");
    // Y la narración cuenta por qué.
    p.esperar(CONFIG.horaCorte - p.reloj.minutos);
    const motivo = resolver(p).porQueNo.find((m) => m.texto.startsWith("fede"));
    expect(motivo?.porque).toBe("Le dijiste que el Tano no venía");
  });

  it("sin la mentira, se baja solo si quedó caliente, con su texto propio", () => {
    const p = partida([{ ...mentiroso, probabilidadBajaInicial: 90 }, contacto("tano")]);
    charlar(p, "tano", "si");
    p.esperar(60);
    charlar(p, "fede", "si");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(dijo(p, "fede")).toContain("me surgió algo");
  });

  it("un desvío puede depender de cuántos hay en la lista", () => {
    const pocos = partida([mentiroso, contacto("tano")]);
    charlar(pocos, "fede", "contar");
    expect(pocos.estadoDe("fede").nodoActual).toBeNull();

    const agenda = [mentiroso, ...agendaCompleta().slice(0, 2)];
    const muchos = partida(agenda);
    charlar(muchos, "c0", "si");
    charlar(muchos, "c1", "si");
    charlar(muchos, "fede", "contar");
    expect(muchos.estadoDe("fede").nodoActual).toBe("cierra");
  });
});

describe("el validador revisa las condiciones", () => {
  const problemas = (c: DefinicionContacto): string[] =>
    [...revisarGrafo(c, "x.json"), ...revisarCondiciones([c])].map((p) => p.detalle);

  it("acepta un contacto bien armado", () => {
    expect(revisarGrafo(mentiroso, "x.json")).toEqual([]);
  });

  it("el último desvío va sin condición", () => {
    const roto: DefinicionContacto = {
      ...mentiroso,
      nodos: {
        ...mentiroso.nodos,
        abre: { mensajes: ["?"], opciones: [{ ...mentiroso.nodos["abre"]!.opciones[0]!, siguiente: [{ si: { confirmado: "tano" }, nodo: "cierra" }] }] },
      },
    };
    expect(problemas(roto).some((p) => p.includes("último desvío"))).toBe(true);
  });

  it("nombrar algo que no existe rompe la validación", () => {
    const roto: DefinicionContacto = {
      ...mentiroso,
      aperturas: [{ si: { horaDesde: 1200 }, nodo: "no_existe" }],
      bajas: [{ si: { elegiste: "mentir", confirmado: "tano" }, texto: "x" }],
    };
    const p = problemas(roto);
    expect(p.some((x) => x.includes(`"no_existe" no existe`))).toBe(true);
    expect(p.some((x) => x.includes(`elegiste "mentir"`))).toBe(true);
    expect(p.some((x) => x.includes(`el contacto "tano" no existe`))).toBe(true);
  });
});

describe("los roces", () => {
  const de = (id: string, ...rasgos: DefinicionContacto["rasgos"]): DefinicionContacto => ({ ...contacto(id), rasgos });

  it("dos que chocan por dos lados se pelean una sola vez, por la política", () => {
    const roces = rocesAlSumar([de("beto", "capitan", "kuka")], de("carlos", "quejoso", "gorila"));
    expect(roces).toEqual([{ a: "beto", b: "carlos", rasgos: ["kuka", "gorila"] }]);
  });

  it("una pelea puede traer su propio mensaje para calmarla", () => {
    const grupo: DefinicionGrupo = {
      ...GRUPO_QUIETO,
      roces: [{ entre: ["kuka", "libertario"], mensajes: [{ de: "a", texto: "x" }], calmar: "de política no se habla" }],
    };
    const p = partida([de("beto", "kuka"), de("santi", "libertario")], grupo);
    charlar(p, "beto", "si");
    charlar(p, "santi", "si");
    expect(p.calmar().ok).toBe(true);
    expect(p.eventos().some((e) => e.chat === CHAT_GRUPO && e.clase === "propio" && e.texto === "de política no se habla")).toBe(true);
  });
});

describe("lo que le llega a otro", () => {
  /** Carlos pide armar los equipos; Beto se entera. */
  const carlos: DefinicionContacto = {
    ...contacto("carlos"),
    nodos: {
      abre: {
        mensajes: ["quién arma?"],
        opciones: [
          confirma("arma_carlos", { efectos: { estado: "confirmado", otros: [{ contacto: "beto", probabilidadBaja: 30 }, { contacto: "no_esta", enojo: 10 }] } }),
          confirma("arma_beto"),
        ],
      },
    },
  };
  const beto: DefinicionContacto = {
    ...contacto("beto"),
    bajas: [{ si: { elegidoA: { contacto: "carlos", opcion: "arma_carlos" } }, texto: "no juego para la oligarquía", porque: "Le diste a Carlos los equipos" }],
  };

  it("una respuesta puede mover a otro de la agenda; a uno que no está, nada", () => {
    const p = partida([carlos, beto]);
    charlar(p, "carlos", "arma_carlos");
    expect(p.estadoDe("beto").probabilidadBaja).toBe(30);
  });

  it("y otro puede bajarse por lo que le contestaste a alguien más", () => {
    const p = partida([carlos, beto]);
    charlar(p, "beto", "si");
    charlar(p, "carlos", "arma_carlos");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(dijo(p, "beto")).toContain("no juego para la oligarquía");

    const sinEso = partida([carlos, beto]);
    charlar(sinEso, "beto", "si");
    charlar(sinEso, "carlos", "arma_beto");
    sinEso.esperar(CONFIG.minutoRevision - sinEso.reloj.minutos);
    alDia(sinEso);
    expect(sinEso.estadoDe("beto").estado).toBe("confirmado");
  });

  it("el validador avisa si el otro no existe o no tiene esa respuesta", () => {
    const roto: DefinicionContacto = { ...beto, bajas: [{ si: { elegidoA: { contacto: "carlos", opcion: "inventada" } }, texto: "x" }] };
    const detalles = revisarCondiciones([carlos, roto]).map((p) => p.detalle);
    expect(detalles.some((d) => d.includes(`"no_esta" no existe`))).toBe(true);
    expect(detalles.some((d) => d.includes(`ninguna respuesta "inventada"`))).toBe(true);
  });
});

describe("tu voz sale del contenido", () => {
  it("el saludo y la llamada", () => {
    const p = new Partida({
      perfil: PERFIL,
      agenda: [contacto("tano")],
      interrupciones: SIN_INTERRUPCIONES,
      config: CONFIG,
      semilla: "voz",
      frases: { saludo: "q onda, jugás?", llamada: { tuya: "📞 a {nombre}", respuesta: "ya voy pesado" }, baja: "chau", duda: "ni idea" },
    });
    p.escribir("tano");
    p.llamar("tano");
    const textos = p.eventos().filter((e) => e.chat === "tano").map((e) => e.texto);
    expect(textos).toEqual(expect.arrayContaining(["q onda, jugás?", "📞 a tano", "ya voy pesado"]));
  });

  it("adentro de una pelea, los nombres van en minúscula", () => {
    const grupo: DefinicionGrupo = {
      ...GRUPO_QUIETO,
      roces: [{ entre: ["kuka", "libertario"], mensajes: [{ de: "b", texto: "el kukardo de {a}" }] }],
    };
    const beto = { ...contacto("Beto_x"), id: "beto", nombre: "Beto", rasgos: ["kuka" as const] };
    const santi = { ...contacto("santi"), nombre: "Santi", rasgos: ["libertario" as const] };
    const p = partida([beto, santi], grupo);
    charlar(p, "beto", "si");
    charlar(p, "santi", "si");
    expect(p.eventos().some((e) => e.chat === CHAT_GRUPO && e.texto === "el kukardo de beto")).toBe(true);
  });
});
