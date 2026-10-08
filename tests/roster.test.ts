import { describe, expect, it } from "vitest";
import { formacion, quimica, rocesAlSumar, titulares, todosLosRoces, habilidadPromedio } from "../src/core/roster.js";
import { CONFIG, contacto } from "./ayudas.js";

const IDEAL = CONFIG.composicion;

const suma = (d: { valor: number }[]): number => d.reduce((t, x) => t + x.valor, 0);
/** Todo lo que el plantel suma al partido: la formación y la química. */
const total = (plantel: Parameters<typeof quimica>[0]): number => suma([...formacion(plantel, IDEAL), ...quimica(plantel, IDEAL)]);

describe("química del plantel", () => {
  it("castiga fuerte no tener arquero", () => {
    const plantel = Array.from({ length: 10 }, (_, i) => contacto(`c${i}`, { rol: "defensor" }));
    const conceptos = formacion(plantel, IDEAL).map((d) => d.concepto);
    expect(conceptos.some((c) => c.includes("Ningún arquero"))).toBe(true);
    const conArqueros = [contacto("a1", { rol: "arquero" }), contacto("a2", { rol: "arquero" }), ...plantel.slice(2)];
    expect(total(plantel)).toBeLessThan(total(conArqueros) - 5);
  });

  it("castiga menos tener un solo arquero que ninguno", () => {
    const ninguno = Array.from({ length: 10 }, (_, i) => contacto(`c${i}`, { rol: "defensor" }));
    const uno = [contacto("arq", { rol: "arquero" }), ...ninguno.slice(1)];
    expect(total(uno)).toBeGreaterThan(total(ninguno));
  });

  it("invitar cinco delanteros baja el porcentaje, como dice el diseño", () => {
    const base = [
      contacto("a1", { rol: "arquero" }),
      contacto("a2", { rol: "arquero" }),
      contacto("d1", { rol: "defensor" }),
      contacto("d2", { rol: "defensor" }),
      contacto("d3", { rol: "defensor" }),
    ];
    const equilibrado = [...base, ...Array.from({ length: 5 }, (_, i) => contacto(`m${i}`, { rol: "mediocampista" }))];
    const puroAtaque = [...base, ...Array.from({ length: 5 }, (_, i) => contacto(`f${i}`, { rol: "delantero" }))];
    expect(total(puroAtaque)).toBeLessThan(total(equilibrado));
  });

  it("arrancan los mejores de cada puesto y el resto es banco", () => {
    const plantel = [
      contacto("arq_malo", { rol: "arquero", habilidad: 40 }),
      contacto("arq_bueno", { rol: "arquero", habilidad: 80 }),
      contacto("def_malo", { rol: "defensor", habilidad: 30 }),
      contacto("def", { rol: "defensor", habilidad: 60 }),
    ];
    const once = titulares(plantel, { arquero: 1, defensor: 1, mediocampista: 0, delantero: 0 });
    expect(once.map((t) => t.jugador.id)).toEqual(["arq_bueno", "def"]);
  });

  it("un puesto sin nadie se cubre con el mejor que sobra, y rinde menos", () => {
    const plantel = [
      contacto("arq", { rol: "arquero", habilidad: 60 }),
      contacto("d1", { rol: "defensor", habilidad: 60 }),
      contacto("d2", { rol: "defensor", habilidad: 70 }),
      contacto("d3", { rol: "defensor", habilidad: 50 }),
    ];
    const composicion = { arquero: 1, defensor: 2, mediocampista: 0, delantero: 1 };
    expect(titulares(plantel, composicion).find((t) => t.puesto === "delantero")?.jugador.id).toBe("d3");
    const desglose = formacion(plantel, composicion);
    expect(desglose.find((d) => d.concepto.includes("juega de delantero sin serlo"))?.valor).toBeLessThan(0);
  });

  it("sin arquero, al arco va el peor, no el crack", () => {
    const plantel = [
      contacto("crack", { rol: "defensor", habilidad: 90 }),
      contacto("tronco", { rol: "defensor", habilidad: 30 }),
      contacto("d", { rol: "defensor", habilidad: 60 }),
    ];
    const composicion = { arquero: 1, defensor: 2, mediocampista: 0, delantero: 0 };
    expect(titulares(plantel, composicion).find((t) => t.puesto === "arquero")?.jugador.id).toBe("tronco");
  });

  it("el banco no suma: un suplente crack no cambia la formación", () => {
    const composicion = { arquero: 1, defensor: 1, mediocampista: 0, delantero: 0 };
    const base = [contacto("arq", { rol: "arquero", habilidad: 60 }), contacto("def", { rol: "defensor", habilidad: 60 })];
    const conBanco = [...base, contacto("def_crack_suplente", { rol: "defensor", habilidad: 50 })];
    expect(formacion(conBanco, composicion)).toEqual(formacion(base, composicion));
  });

  it("un plantel vacío no tiene química, no rompe", () => {
    expect(quimica([], IDEAL)).toEqual([]);
    expect(habilidadPromedio([])).toBe(0);
  });
});

describe("roces", () => {
  it("el rústico y el habilidoso se cruzan", () => {
    const tano = contacto("tano", { rasgos: ["rustico"] });
    const fede = contacto("fede", { rasgos: ["habilidoso"] });
    expect(rocesAlSumar([tano], fede)).toHaveLength(1);
  });

  it("el cruce es simétrico: da igual quién confirmó primero", () => {
    const tano = contacto("tano", { rasgos: ["rustico"] });
    const fede = contacto("fede", { rasgos: ["habilidoso"] });
    expect(rocesAlSumar([fede], tano)).toHaveLength(1);
  });

  it("no inventa roces donde no los hay", () => {
    const a = contacto("a", { rasgos: ["aguantador"] });
    const b = contacto("b", { rasgos: ["capitan"] });
    expect(rocesAlSumar([a], b)).toHaveLength(0);
  });

  it("el roce suma al porcentaje de victoria: se juega picado", () => {
    const sinRoce = [contacto("a", { rasgos: ["aguantador"] }), contacto("b", { rasgos: [] })];
    const conRoce = [contacto("a", { rasgos: ["rustico"] }), contacto("b", { rasgos: ["habilidoso"] })];
    expect(todosLosRoces(conRoce)).toHaveLength(1);
    expect(suma(quimica(conRoce, IDEAL))).toBeGreaterThan(suma(quimica(sinRoce, IDEAL)));
  });

  it("no cuenta dos veces el mismo par", () => {
    const plantel = [
      contacto("a", { rasgos: ["rustico"] }),
      contacto("b", { rasgos: ["habilidoso"] }),
    ];
    expect(todosLosRoces(plantel)).toHaveLength(1);
  });
});
