import { describe, expect, it } from "vitest";
import { quimica, rocesAlSumar, todosLosRoces, habilidadPromedio } from "../src/core/roster.js";
import { CONFIG, contacto } from "./ayudas.js";

const IDEAL = CONFIG.composicion;

const suma = (d: { valor: number }[]): number => d.reduce((t, x) => t + x.valor, 0);

describe("química del plantel", () => {
  it("castiga fuerte no tener arquero", () => {
    const plantel = Array.from({ length: 10 }, (_, i) => contacto(`c${i}`, { rol: "defensor" }));
    const conceptos = quimica(plantel, IDEAL).map((d) => d.concepto);
    expect(conceptos.some((c) => c.includes("Ningún arquero"))).toBe(true);
    expect(suma(quimica(plantel, IDEAL))).toBeLessThan(0);
  });

  it("castiga menos tener un solo arquero que ninguno", () => {
    const ninguno = Array.from({ length: 10 }, (_, i) => contacto(`c${i}`, { rol: "defensor" }));
    const uno = [contacto("arq", { rol: "arquero" }), ...ninguno.slice(1)];
    expect(suma(quimica(uno, IDEAL))).toBeGreaterThan(suma(quimica(ninguno, IDEAL)));
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
    expect(suma(quimica(puroAtaque, IDEAL))).toBeLessThan(suma(quimica(equilibrado, IDEAL)));
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
