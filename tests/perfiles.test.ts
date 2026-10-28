import { describe, expect, it } from "vitest";
import { configDeViernes, MODO_POR_DEFECTO } from "../src/core/modo.js";
import { cargarContenido } from "../src/datos/cargar.js";
import { revisarPerfiles } from "../src/datos/validar.js";
import { formatearPesos } from "../src/core/formato.js";
import type { InscripcionResuelta } from "../src/core/inscripcion.js";
import { alDia, CHAT_GRUPO, Partida } from "../src/core/partida.js";
import { elencoDe, perfilesJugables, type Elencos } from "../src/core/perfiles.js";
import { agendaCompleta, CONFIG, contacto, interrupcionSegura, PERFIL } from "./ayudas.js";

const contenido = await cargarContenido();

describe("el elenco de cada perfil", () => {
  it("un perfil sin elenco todavía no se juega", () => {
    const elencos: Elencos = { pibe: elencoDe(contenido.elencos, "pibe") };
    expect(perfilesJugables(contenido.perfiles, elencos).map((p) => p.id)).toEqual(["pibe"]);
    expect(() => elencoDe(elencos, "oficinista")).toThrow("todavía no tiene elenco");
  });

  // El grupo ya está hablando cuando abrís el teléfono: un elenco con el grupo mudo arranca raro.
  it.each(perfilesJugables(contenido.perfiles, contenido.elencos).map((p) => [p.nombre, p] as const))(
    "con %s, el grupo arranca hablando",
    (_, perfil) => {
      const elenco = elencoDe(contenido.elencos, perfil.id);
      const partida = new Partida({
        perfil,
        agenda: elenco.contactos,
        interrupciones: elenco.interrupciones,
        grupo: elenco.grupo,
        config: configDeViernes(contenido.config, MODO_POR_DEFECTO),
        semilla: "arranque",
      });
      alDia(partida);
      const hablan = partida.eventos().filter((e) => e.chat === CHAT_GRUPO && e.de !== "Sistema");
      expect(hablan.length).toBeGreaterThan(0);
    },
  );
});

describe("la inscripción", () => {
  const cancha = { ...interrupcionSegura("cancha", 1200), de: "Complejo" };
  const inscripcion: InscripcionResuelta = {
    chat: "cancha",
    charla: [
      { tuyo: false, texto: "¿Qué buscan?" },
      { tuyo: true, texto: "el torneo" },
      { tuyo: false, texto: "La seña son $15.000." },
    ],
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
      ["mensaje", "Complejo", "¿Qué buscan?"],
      ["propio", "Vos", "el torneo"],
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

describe("las interrupciones", () => {
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
  const pibe = elencoDe(contenido.elencos, "pibe");
  const sinCancha = (interrupciones: typeof pibe.interrupciones): Elencos => ({ pibe: { ...pibe, interrupciones } });

  it("los perfiles reales no tienen problemas", () => {
    expect(revisarPerfiles(contenido.perfiles, contenido.elencos, contenido.inscripcion)).toEqual([]);
  });

  it("detecta un elenco sin el chat de la cancha", () => {
    const elencos = sinCancha(pibe.interrupciones.filter((i) => i.id !== contenido.inscripcion.chat));
    expect(revisarPerfiles(contenido.perfiles, elencos, contenido.inscripcion).map((p) => p.detalle).join()).toContain("el chat de la cancha");
  });

  it("detecta una cancha que no es la de la inscripción", () => {
    const elencos = sinCancha(pibe.interrupciones.map((i) => (i.id === contenido.inscripcion.chat ? { ...i, de: "Otro complejo" } : i)));
    expect(revisarPerfiles(contenido.perfiles, elencos, contenido.inscripcion).map((p) => p.detalle).join()).toContain("Otro complejo");
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
