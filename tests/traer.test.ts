import { describe, expect, it } from "vitest";
import { alDia, CHAT_GRUPO, Partida } from "../src/core/partida.js";
import type { DefinicionContacto, Invitado } from "../src/core/tipos.js";
import { agendaCompleta, CONFIG, contacto, interrupcionSegura, PERFIL, SIN_INTERRUPCIONES } from "./ayudas.js";

const primo = (noViene?: number): Invitado => ({
  nombre: "El Gringo",
  rol: "defensor",
  habilidad: 48,
  ...(noViene !== undefined ? { noViene: { probabilidad: noViene, texto: "el gringo no viene" } } : {}),
});

/** El Tano, que si falta gente trae a su primo. */
function tano(invitado: Invitado, extra: Partial<DefinicionContacto> = {}): DefinicionContacto {
  return {
    ...contacto("tano"),
    nodos: {
      abre: {
        mensajes: ["voy"],
        opciones: [
          { id: "solo", texto: "dale", costoReloj: 2, efectos: { estado: "confirmado" }, siguiente: null },
          {
            id: "con_primo",
            texto: "traé a tu primo",
            costoReloj: 2,
            efectos: { estado: "confirmado", trae: [invitado] },
            siguiente: null,
            requiere: { faltanMin: 5 },
          },
        ],
      },
    },
    ...extra,
  };
}

function partida(agenda: DefinicionContacto[]): Partida {
  return new Partida({ perfil: PERFIL, agenda, interrupciones: SIN_INTERRUPCIONES, config: CONFIG, semilla: "traer" });
}

function charlar(p: Partida, id: string, opcion: string): void {
  p.escribir(id);
  alDia(p);
  expect(p.responder(id, opcion).ok).toBe(true);
  alDia(p);
}

describe("traer a alguien", () => {
  it("el que trae entra a la lista y, después, el suyo", () => {
    const p = partida([tano(primo()), ...agendaCompleta()]);
    charlar(p, "tano", "con_primo");
    expect(p.roster().confirmados).toBe(2);
    expect(p.lista().map((x) => [x.nombre, x.traidoPor ?? null])).toEqual([
      ["tano", null],
      ["El Gringo", "tano"],
    ]);
  });

  it("solo se ofrece cuando falta mucha gente", () => {
    const agenda = [tano(primo()), ...agendaCompleta()];
    const p = partida(agenda);
    for (const id of ["c0", "c1", "c2", "c3", "c4", "c5"]) charlar(p, id, "si");
    p.escribir("tano");
    alDia(p);
    expect(p.opcionesDisponibles("tano").map((o) => o.id)).toEqual(["solo"]);
  });

  it("si el que trae se baja, el suyo se va con él", () => {
    const p = partida([{ ...tano(primo()), probabilidadBajaInicial: 95 }, ...agendaCompleta()]);
    charlar(p, "tano", "con_primo");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(p.estadoDe("tano").estado).toBe("bajado");
    expect(p.roster().confirmados).toBe(0);
    expect(p.lista()).toEqual([]);
  });

  it("el invitado puede no venir: avisa el que lo trajo y queda para la narración", () => {
    const p = partida([tano(primo(100)), ...agendaCompleta()]);
    charlar(p, "tano", "con_primo");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(p.roster().confirmados).toBe(1);
    expect(p.eventos().some((e) => e.chat === "tano" && e.texto === "el gringo no viene")).toBe(true);
    expect(p.eventos().some((e) => e.chat === CHAT_GRUPO && e.texto === "El Gringo no viene.")).toBe(true);
    expect(p.bitacora.contar("no_vino")).toBe(1);
  });
});

describe("las interrupciones se rinden", () => {
  it("ignorada, drena hasta su tope y después no más", () => {
    const sofi = { ...interrupcionSegura("sofi", 1140), drenajePorAccion: 2, drenajeMaximo: 5 };
    const p = new Partida({ perfil: PERFIL, agenda: agendaCompleta(), interrupciones: [sofi], config: CONFIG, semilla: "tope" });
    p.escribir("c0");
    alDia(p);
    const antes = p.moral;
    p.esperar(20);
    expect(antes - p.moral).toBe(5);
  });

  it("cerrar la lista se frena si cae una interrupción en el medio", () => {
    const tarde = { ...interrupcionSegura("jefe", 1200) };
    const agenda = agendaCompleta();
    const p = new Partida({ perfil: PERFIL, agenda, interrupciones: [tarde], config: CONFIG, semilla: "frena" });
    for (const c of agenda.slice(0, 10)) charlar(p, c.id, "si");
    expect(p.reloj.minutos).toBeLessThan(1200);
    p.cerrarLista();
    expect(p.terminada).toBe(false);
    expect(p.reloj.minutos).toBeGreaterThanOrEqual(1200);
    expect(p.reloj.minutos).toBeLessThan(1205);
  });
});
