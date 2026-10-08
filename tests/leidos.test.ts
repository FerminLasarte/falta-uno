import { describe, expect, it } from "vitest";
import { Leidos } from "../src/app/estado/leidos.js";

describe("lo que ya viste", () => {
  it("sin leer es lo que llegó menos lo que viste", () => {
    const l = new Leidos();
    expect(l.sinLeer("carlos", 3)).toBe(3);
    l.ver("carlos", 3);
    expect(l.sinLeer("carlos", 3)).toBe(0);
    expect(l.sinLeer("carlos", 5)).toBe(2);
    expect(l.sinLeer("beto", 1)).toBe(1);
    expect(l.visto("carlos")).toBe(3);
    expect(l.visto("beto")).toBe(0);
  });

  it("se guarda y se recupera", () => {
    const l = new Leidos();
    l.ver("grupo", 7);
    l.ver("pareja_serie", 2);
    const otra = Leidos.desde(JSON.parse(JSON.stringify(l.serializar())));
    expect(otra.sinLeer("grupo", 9)).toBe(2);
    expect(otra.sinLeer("pareja_serie", 2)).toBe(0);
  });

  it("si lo guardado viene roto, arranca sin nada visto", () => {
    expect(Leidos.desde(null).sinLeer("grupo", 4)).toBe(4);
    expect(Leidos.desde("basura").sinLeer("grupo", 4)).toBe(4);
    const mezcla = Leidos.desde({ grupo: 2, carlos: -1, beto: "3", tano: 1.5 });
    expect(mezcla.serializar()).toEqual({ grupo: 2 });
  });
});
