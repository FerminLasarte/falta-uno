import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aportes } from "../src/app/tele/creditos.js";

describe("los créditos de la tele", () => {
  const lista = aportes(readFileSync(new URL("../arte/CREDITOS.md", import.meta.url), "utf8"));

  it("cada fila de la tabla de arte/CREDITOS.md es un aporte, sin la cabecera", () => {
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((a) => a.asset !== "Asset" && !a.asset.startsWith("-"))).toBe(true);
  });

  it("los CC BY están, con su autor y su licencia: es lo que la licencia obliga a mostrar", () => {
    const ccBy = lista.filter((a) => a.licencia.startsWith("CC BY"));
    expect(ccBy.length).toBeGreaterThan(0);
    for (const a of ccBy) expect(a.autor).not.toBe("");
    expect(lista).toContainEqual({ asset: "Mate argentino (lowpoly)", autor: "fervinas", fuente: "Sketchfab", licencia: "CC BY 4.0" });
  });

  it("los links quedan como texto: en la tele no se tocan", () => {
    expect(lista.some((a) => a.fuente.includes("http") || a.fuente.includes("]"))).toBe(false);
  });
});
