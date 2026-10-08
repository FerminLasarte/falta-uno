import { describe, expect, it } from "vitest";
import { cargarContenido } from "../src/datos/cargar.js";
import { revisarPerfiles } from "../src/datos/validar.js";
import { formatearPesos } from "../src/core/formato.js";
import type { DefinicionInscripcion } from "../src/core/inscripcion.js";
import { alDia, CHAT_GRUPO, Partida } from "../src/core/partida.js";
import { agendaDe } from "../src/core/perfiles.js";
import { agendaCompleta, CONFIG, contacto, interrupcionSegura, PERFIL, SIN_INTERRUPCIONES } from "./ayudas.js";

const contenido = await cargarContenido();

describe("la agenda de cada perfil", () => {
  it("tiene a su contacto único y a ninguno de los otros", () => {
    for (const perfil of contenido.perfiles) {
      const ids = agendaDe(perfil, contenido.perfiles, contenido.contactos).map((c) => c.id);
      expect(ids).toContain(perfil.contactoUnico);
      for (const otro of contenido.perfiles.filter((p) => p.id !== perfil.id)) {
        expect(ids, `${perfil.id} no tiene que ver a ${otro.contactoUnico}`).not.toContain(otro.contactoUnico);
      }
    }
  });

  it("los contactos comunes están en todas", () => {
    const unicos = new Set(contenido.perfiles.map((p) => p.contactoUnico));
    const comunes = contenido.contactos.filter((c) => !unicos.has(c.id)).map((c) => c.id);
    for (const perfil of contenido.perfiles) {
      const ids = agendaDe(perfil, contenido.perfiles, contenido.contactos).map((c) => c.id);
      expect(ids).toEqual(expect.arrayContaining(comunes));
    }
  });

  // El grupo ya está hablando cuando abrís el teléfono, sea cual sea tu perfil:
  // una charla de arranque que dependa de un contacto único lo deja mudo.
  it.each(contenido.perfiles.map((p) => [p.nombre, p] as const))("con %s, el grupo arranca hablando", (_, perfil) => {
    const partida = new Partida({
      perfil,
      agenda: agendaDe(perfil, contenido.perfiles, contenido.contactos),
      interrupciones: contenido.interrupciones,
      grupo: contenido.grupo,
      config: contenido.config,
      semilla: "arranque",
    });
    alDia(partida);
    const hablan = partida.eventos().filter((e) => e.chat === CHAT_GRUPO && e.de !== "Sistema");
    expect(hablan.length).toBeGreaterThan(0);
  });
});

describe("la inscripción", () => {
  const cancha = { ...interrupcionSegura("cancha", 1200), de: "Complejo" };
  const inscripcion: DefinicionInscripcion = {
    chat: "cancha",
    mensajes: ["Quedaron anotados.", "La seña son {sena}."],
    respuesta: "Anotado.",
  };
  const nueva = (): Partida =>
    new Partida({
      perfil: PERFIL,
      agenda: agendaCompleta(),
      interrupciones: [cancha],
      config: CONFIG,
      semilla: "insc",
      inscripcion,
    });

  it("la charla con la cancha ya está, con tu respuesta, en el chat de la interrupción", () => {
    const enCancha = nueva().eventos().filter((e) => e.chat === "cancha");
    expect(enCancha.map((e) => [e.clase, e.de, e.texto])).toEqual([
      ["mensaje", "Complejo", "Quedaron anotados."],
      ["mensaje", "Complejo", "La seña son $15.000."],
      ["propio", "Vos", PERFIL.respuesta],
    ]);
  });

  it("la cancha contesta por el pulso, como todos", () => {
    const p = nueva();
    expect(p.enCamino("cancha")).toBe(true);
    alDia(p);
    expect(p.eventos().filter((e) => e.chat === "cancha").at(-1)).toMatchObject({ de: "Complejo", texto: "Anotado." });
    expect(p.reloj.minutos).toBe(CONFIG.horaInicio);
  });

  it("sin inscripción, el viernes arranca como siempre", () => {
    const p = new Partida({ perfil: PERFIL, agenda: agendaCompleta(), interrupciones: [cancha], config: CONFIG, semilla: "insc" });
    expect(p.eventos().some((e) => e.chat === "cancha")).toBe(false);
  });
});

describe("lo que el perfil cambia de las interrupciones", () => {
  const jefe = { ...interrupcionSegura("jefe", 1140), probabilidad: 50 };
  const llegaElJefe = (factor: number | undefined, semilla: string): boolean => {
    const p = new Partida({
      perfil: { ...PERFIL, ...(factor !== undefined ? { probabilidadInterrupciones: { jefe: factor } } : {}) },
      agenda: [contacto("a")],
      interrupciones: [jefe],
      config: CONFIG,
      semilla,
    });
    p.esperar(1);
    alDia(p);
    return p.interrupcionesActivas.length > 0;
  };

  it("multiplica la probabilidad: al doble, la de 50 llega siempre; casi en cero, nunca", () => {
    for (let s = 0; s < 30; s++) {
      expect(llegaElJefe(2, `j${s}`)).toBe(true);
      expect(llegaElJefe(0.0001, `j${s}`)).toBe(false);
    }
  });

  it("al 1,5 llega más seguido que sin factor", () => {
    let con = 0;
    let sin = 0;
    for (let s = 0; s < 200; s++) {
      if (llegaElJefe(1.5, `j${s}`)) con++;
      if (llegaElJefe(undefined, `j${s}`)) sin++;
    }
    expect(con).toBeGreaterThan(sin);
  });

  it("recién cuenta como atendida cuando la atendés", () => {
    const p = new Partida({ perfil: PERFIL, agenda: [contacto("a")], interrupciones: [interrupcionSegura("x", 1140)], config: CONFIG, semilla: "at" });
    p.esperar(1);
    alDia(p);
    expect(p.atendida("x")).toBe(false);
    p.atender("x");
    expect(p.atendida("x")).toBe(true);
  });
});

describe("el validador atrapa perfiles mal escritos", () => {
  const inscripcion: DefinicionInscripcion = { chat: "cancha_confirma", mensajes: ["¿?"], respuesta: "Ok." };

  it("los perfiles reales no tienen problemas", () => {
    expect(revisarPerfiles(contenido.perfiles, contenido.contactos, contenido.interrupciones, contenido.inscripcion)).toEqual([]);
  });

  it("detecta un resumen que no nombra al contacto que trae", () => {
    const perfiles = contenido.perfiles.map((p, i) => (i === 0 ? { ...p, resumen: "plata sí" } : p));
    const problemas = revisarPerfiles(perfiles, contenido.contactos, contenido.interrupciones, inscripcion);
    expect(problemas.map((p) => p.detalle).join()).toContain("no nombra");
  });

  it("detecta dos perfiles con el mismo contacto único", () => {
    const [a, b] = contenido.perfiles;
    const perfiles = [a!, { ...b!, contactoUnico: a!.contactoUnico, resumen: a!.resumen }];
    const problemas = revisarPerfiles(perfiles, contenido.contactos, contenido.interrupciones, inscripcion);
    expect(problemas.map((p) => p.detalle).join()).toContain("ya es el contacto único");
  });

  it("detecta una interrupción que no existe y una inscripción sin chat", () => {
    const perfiles = [{ ...contenido.perfiles[0]!, probabilidadInterrupciones: { jefazo: 2 } }];
    const problemas = revisarPerfiles(perfiles, contenido.contactos, SIN_INTERRUPCIONES, inscripcion);
    const texto = problemas.map((p) => p.detalle).join();
    expect(texto).toContain('"jefazo" no existe');
    expect(texto).toContain("no es el de ninguna interrupción");
  });
});

describe("la plata", () => {
  it("se escribe como acá, sin depender de la máquina", () => {
    expect(formatearPesos(15000)).toBe("$15.000");
    expect(formatearPesos(500)).toBe("$500");
    expect(formatearPesos(1234567)).toBe("$1.234.567");
    expect(formatearPesos(-3000)).toBe("-$3.000");
    expect(formatearPesos(0)).toBe("$0");
  });
});
