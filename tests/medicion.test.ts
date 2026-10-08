import { describe, expect, it } from "vitest";
import type { OpcionesPartida } from "../src/core/partida.js";
import { Registro, type Paso } from "../src/core/registro.js";
import { opcionesDeViernes } from "../src/core/viernes.js";
import { cargarContenido } from "../src/datos/cargar.js";
import { ESTILOS, jugarViernes } from "../src/cli/estilos.js";
import { medir } from "../src/cli/medicion.js";
import { agendaCompleta, CONFIG, contacto, PERFIL, SIN_INTERRUPCIONES } from "./ayudas.js";
import type { DefinicionContacto } from "../src/core/tipos.js";

const contenido = await cargarContenido();

function opciones(agenda: DefinicionContacto[] = agendaCompleta(), perfil = PERFIL): OpcionesPartida {
  return { perfil, agenda, interrupciones: SIN_INTERRUPCIONES, config: CONFIG, semilla: "medir" };
}

/** Escribirle y contestarle a cada uno lo mismo, dejando llegar sus mensajes. */
function contestar(ids: readonly string[], opcion: string): Paso[] {
  return ids.flatMap((id): Paso[] => [["escribir", id], ["t", 10_000], ["responder", id, opcion]]);
}

const ids = (agenda: readonly DefinicionContacto[]): string[] => agenda.map((c) => c.id);

describe("por qué no hubo partido", () => {
  it("reloj: quedaba gente a quien escribirle y se terminó el tiempo", () => {
    const m = medir(opciones(), [["esperar", 120]]);
    expect(m.hayPartido).toBe(false);
    expect(m.causa).toBe("reloj");
  });

  it("agenda: ya no quedaba nadie", () => {
    const agenda = agendaCompleta().slice(0, 4);
    const m = medir(opciones(agenda), [...contestar(ids(agenda), "si"), ["esperar", 120]]);
    expect(m.causa).toBe("agenda");
  });

  it("plata: estaban los diez y no alcanzó la seña", () => {
    const agenda = Array.from({ length: 10 }, (_, i) => contacto(`c${i}`));
    const m = medir(opciones(agenda, { ...PERFIL, dineroInicial: 0 }), [...contestar(ids(agenda), "si"), ["esperar", 120]]);
    expect(m.listaLlena).toBe(true);
    expect(m.causa).toBe("plata");
  });

  it("bajas: sin las de las 20:30 estaban los diez", () => {
    const agenda = agendaCompleta().slice(0, 10);
    // A tres los apurás: quedan calientes y a las 20:30 se bajan.
    const pasos: Paso[] = [
      ...contestar(ids(agenda).slice(0, 3), "apurar"),
      ...contestar(ids(agenda).slice(3), "si"),
      ["esperar", 60],
      ["t", 60_000],
      ["esperar", 60],
    ];
    const m = medir(opciones(agenda, { ...PERFIL, moralInicial: 100 }), pasos);
    expect(m.bajas).toBeGreaterThan(0);
    expect(m.causa).toBe("bajas");
  });

  it("moral: te quedaste sin moral", () => {
    const agenda = agendaCompleta();
    const m = medir(opciones(agenda, { ...PERFIL, moralInicial: 8 }), contestar(ids(agenda), "apurar"));
    expect(m.causa).toBe("moral");
  });
});

describe("la medición", () => {
  it("anota cuándo se llenó la lista y a quién dejaste", () => {
    const agenda = agendaCompleta();
    const pasos = [...contestar(["c11"], "no"), ...contestar(ids(agenda).slice(0, 10), "si")];
    const m = medir(opciones(agenda), pasos);
    expect(m.losDejaste).toBe(1);
    expect(m.teDijeronQueNo).toBe(0);
    expect(m.minutoLleno).not.toBeNull();
    expect(m.minutoLleno!).toBeGreaterThan(CONFIG.horaInicio);
  });

  it("con línea de tiempo mide la misma partida que sin ella", () => {
    const perfil = contenido.perfiles[2]!;
    for (const estilo of ESTILOS) {
      const op = opcionesDeViernes(contenido, perfil, `linea-${estilo.id}`, { fecha: 1, dinero: perfil.dineroInicial });
      const pasos = jugarViernes(op, estilo, `linea-${estilo.id}`);
      const { linea: _sin, ...sin } = medir(op, pasos);
      const { linea, ...con } = medir(op, pasos, true);
      expect(con, estilo.id).toEqual(sin);
      expect(linea.length).toBeGreaterThan(0);
    }
  });
});

describe("el bot", () => {
  it("juega a través del registro: lo que hizo se reproduce entero", () => {
    for (const perfil of contenido.perfiles) {
      for (const estilo of ESTILOS) {
        const semilla = `repro-${perfil.id}-${estilo.id}`;
        const op = opcionesDeViernes(contenido, perfil, semilla, { fecha: 1, dinero: perfil.dineroInicial });
        const pasos = jugarViernes(op, estilo, semilla);
        expect(jugarViernes(op, estilo, semilla)).toEqual(pasos);
        const { registro, aplicados } = Registro.reproducir(op, pasos);
        expect(aplicados).toBe(pasos.length);
        expect(registro.partida.terminada).toBe(true);
      }
    }
  });
});
