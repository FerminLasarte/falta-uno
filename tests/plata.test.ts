import { describe, expect, it } from "vitest";
import { alDia, Partida } from "../src/core/partida.js";
import { resolver } from "../src/core/resolucion.js";
import { agendaCompleta, CONFIG, contacto, PERFIL, SIN_INTERRUPCIONES } from "./ayudas.js";

/**
 * Nueve que pagan en el momento y Santi, que dice "la guita allá". Sin colchón,
 * los nueve juntan $13.500: la seña ($15.000) depende de que Santi la traiga.
 */
function viernes(probabilidad: number, semilla = "alla"): Partida {
  const santi = contacto("santi", { alConfirmar: { plataAlla: { monto: 1500, probabilidad } } });
  const agenda = [...agendaCompleta().slice(0, 9), santi];
  const p = new Partida({ perfil: PERFIL, agenda, interrupciones: SIN_INTERRUPCIONES, config: CONFIG, semilla, dineroInicial: 0 });
  for (const c of agenda) {
    p.escribir(c.id);
    alDia(p);
    p.responder(c.id, "si");
    alDia(p);
  }
  return p;
}

function hastaLas21(p: Partida): Partida {
  p.esperar(CONFIG.horaCorte - p.reloj.minutos);
  alDia(p);
  return p;
}

describe("la guita allá", () => {
  it("hasta las 21:00, lo prometido se ve aparte: no está en el bolsillo", () => {
    const p = viernes(100);
    expect(p.dinero).toBe(13500);
    expect(p.prometido).toBe(1500);
  });

  it("si la trae, entra al bolsillo antes de pagar la seña y hay partido", () => {
    const p = hastaLas21(viernes(100));
    expect(p.terminada).toBe(true);
    expect(p.dinero).toBe(15000);
    expect(p.prometido).toBe(0);
    expect(p.bitacora.todas().some((e) => e.tipo === "plata_alla" && e.contactoId === "santi")).toBe(true);
    expect(resolver(p).hayPartido).toBe(true);
  });

  it("si se olvida la billetera, no alcanza para la seña y se cuenta por qué", () => {
    const p = hastaLas21(viernes(0));
    expect(p.dinero).toBe(13500);
    const r = resolver(p);
    expect(r.hayPartido).toBe(false);
    const motivo = r.porQueNo.find((m) => m.texto === "santi llegó sin la plata.");
    expect(motivo?.porque).toMatch(/^Le dijiste que la plata después, a las \d\d:\d\d$/);
  });

  it("la decide la semilla: el mismo viernes, la misma suerte", () => {
    for (const semilla of ["a", "b", "c", "d"]) {
      expect(hastaLas21(viernes(50, semilla)).dinero).toBe(hastaLas21(viernes(50, semilla)).dinero);
    }
  });

  it("el que se bajó no trae nada: lo prometido se va con él", () => {
    // Confirma caliente (90 contra un umbral de 80): a las 20:30 se baja.
    const santi = contacto("santi", { alConfirmar: { probabilidadBaja: 90, plataAlla: { monto: 1500, probabilidad: 100 } } });
    const p = new Partida({ perfil: PERFIL, agenda: [santi], interrupciones: SIN_INTERRUPCIONES, config: CONFIG, semilla: "baja", dineroInicial: 0 });
    p.escribir("santi");
    alDia(p);
    p.responder("santi", "si");
    alDia(p);
    expect(p.prometido).toBe(1500);
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(p.prometido).toBe(0);
    hastaLas21(p);
    expect(p.estadoDe("santi").estado).toBe("bajado");
    expect(p.dinero).toBe(0);
    expect(p.bitacora.todas().some((e) => e.tipo === "plata_alla" || e.tipo === "sin_billetera")).toBe(false);
  });
});
