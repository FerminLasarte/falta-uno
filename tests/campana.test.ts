import { describe, expect, it } from "vitest";
import { AGUANTE, cerrarFecha, nuevaCampana, semillaDeFecha, type Campana } from "../src/core/campana.js";
import { alDia, Partida } from "../src/core/partida.js";
import { resolver } from "../src/core/resolucion.js";
import { agendaCompleta, CONFIG, PERFIL, SIN_INTERRUPCIONES } from "./ayudas.js";

const CUOTA = 1500;

/** Un viernes de la campaña: arranca con tu parte, con la plata de la campaña de colchón, y confirma a los primeros `cuantos`. */
function viernes(campana: Campana, cuantos: number, agenda = agendaCompleta()): Partida {
  const p = new Partida({
    perfil: PERFIL,
    agenda,
    interrupciones: SIN_INTERRUPCIONES,
    config: CONFIG,
    semilla: semillaDeFecha(campana),
    dineroInicial: CUOTA,
    colchon: campana.dinero,
  });
  for (const c of p.contactos().slice(0, cuantos)) {
    p.escribir(c.id);
    alDia(p);
    p.responder(c.id, "si");
  }
  p.esperar(200);
  return p;
}

/** La agenda de siempre, pero nadie pone plata al confirmar. */
function sinAportes() {
  return agendaCompleta().map((c) => {
    const abre = c.nodos["abre"]!;
    const opciones = abre.opciones.map((o) => (o.id === "si" ? { ...o, efectos: { estado: "confirmado" as const } } : o));
    return { ...c, nodos: { abre: { ...abre, opciones } } };
  });
}

const cerrar = (campana: Campana, p: Partida) => cerrarFecha(campana, p, resolver(p), CONFIG);

describe("la campaña", () => {
  it("arranca en la fecha 1 con la plata del perfil", () => {
    const c = nuevaCampana(PERFIL, "camp");
    expect(c).toMatchObject({ fecha: 1, dinero: PERFIL.dineroInicial, prestigio: 0, fin: null, jugadas: [] });
  });

  it("cada fecha tiene su semilla, y la primera es la de la campaña", () => {
    const c = nuevaCampana(PERFIL, "camp");
    expect(semillaDeFecha(c)).toBe("camp");
    expect(semillaDeFecha({ ...c, fecha: 2 })).not.toBe(semillaDeFecha({ ...c, fecha: 3 }));
  });

  it("con partido: se paga la cancha, se cobra el premio y pasa a la fecha siguiente", () => {
    const c = nuevaCampana(PERFIL, "camp");
    const p = viernes(c, 10);
    const r = resolver(p);
    const { campana, juntado, sena, premio } = cerrarFecha(c, p, r, CONFIG);
    expect(r.hayPartido).toBe(true);
    expect(juntado).toBe(p.dinero);
    expect(campana.dinero).toBe(c.dinero + juntado - sena + premio);
    expect(campana.prestigio).toBe(r.recompensa.prestigio);
    expect(campana).toMatchObject({ fecha: 2, fechasSinPartido: 0, fin: null });
    expect(campana.jugadas).toEqual([
      { fecha: 1, hayPartido: true, gano: r.gano, golesFavor: r.golesFavor, golesContra: r.golesContra },
    ]);
  });

  it("si el bolsillo no llega a la seña, la completa el colchón y la fecha siguiente arranca con menos", () => {
    // Diez que no ponen nada: el bolsillo queda en tu parte.
    const c = { ...nuevaCampana(PERFIL, "camp"), dinero: 20000 };
    const p = viernes(c, 10, sinAportes());
    expect(p.dinero).toBe(CUOTA);
    const r = resolver(p);
    expect(r.hayPartido).toBe(true);
    expect(cerrarFecha(c, p, r, CONFIG).campana.dinero).toBe(20000 + CUOTA - CONFIG.senaCancha + r.recompensa.dinero);
  });

  it("sin colchón, el bolsillo solo no alcanza: no hay cancha", () => {
    const c = { ...nuevaCampana(PERFIL, "camp"), dinero: 0 };
    const r = resolver(viernes(c, 10, sinAportes()));
    expect(r.hayPartido).toBe(false);
    expect(r.motivoSinPartido).toContain("seña");
  });

  it("sin partido la cancha se paga igual: si no alcanza, queda debiendo", () => {
    const c = { ...nuevaCampana(PERFIL, "camp"), dinero: 2000 };
    const { campana } = cerrar(c, viernes(c, 3));
    expect(campana.dinero).toBeLessThan(0);
    expect(campana).toMatchObject({ fecha: 2, fechasSinPartido: 1, fechasConDeuda: 1, fin: null });
  });

  it("saldar la deuda la fecha siguiente salva la campaña", () => {
    // Debe 500, y once que ponen 1500 cada uno alcanzan para la cancha y la deuda.
    const c = { ...nuevaCampana(PERFIL, "camp"), fecha: 2, dinero: -500, fechasConDeuda: 1 };
    const { campana } = cerrar(c, viernes(c, 11));
    expect(campana.dinero).toBeGreaterThanOrEqual(0);
    expect(campana).toMatchObject({ fechasConDeuda: 0, fin: null });
  });

  it("dos fechas seguidas debiendo: el complejo te saca del torneo", () => {
    const c = { ...nuevaCampana(PERFIL, "camp"), fecha: 2, dinero: -20000, fechasConDeuda: AGUANTE.fechasConDeuda - 1 };
    const { campana } = cerrar(c, viernes(c, 3));
    expect(campana.fin).toBe("bancarrota");
    expect(campana.fecha).toBe(2);
  });

  it("varias fechas seguidas sin partido: el equipo se disuelve", () => {
    const c = { ...nuevaCampana(PERFIL, "camp"), dinero: 90000, fechasSinPartido: AGUANTE.fechasSinPartido - 1 };
    const { campana } = cerrar(c, viernes(c, 3));
    expect(campana.fin).toBe("disolucion");
  });

  it("quedarse sin moral termina la campaña aunque haya plata", () => {
    const c = { ...nuevaCampana({ ...PERFIL, moralInicial: 1 }, "camp"), dinero: 90000 };
    const p = new Partida({
      perfil: { ...PERFIL, moralInicial: 1 },
      agenda: agendaCompleta(),
      interrupciones: SIN_INTERRUPCIONES,
      config: CONFIG,
      semilla: "sin-moral",
      dineroInicial: c.dinero,
    });
    p.escribir("c0");
    alDia(p);
    p.llamar("c0");
    expect(p.motivoFin).toBe("moral_agotada");
    expect(cerrar(c, p).campana.fin).toBe("moral");
  });
});
