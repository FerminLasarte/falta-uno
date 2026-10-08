import { describe, expect, it } from "vitest";
import { Narrador, RELATO_POR_DEFECTO, type Relato } from "../src/core/relato.js";
import { Rng } from "../src/core/rng.js";
import { revisarRelato } from "../src/datos/validar.js";

const conGoles = (goles: string[]): Relato => ({ ...RELATO_POR_DEFECTO, gol_favor: goles });

describe("el narrador", () => {
  it("no repite un fraseo hasta usar todos los de su clave", () => {
    const narrador = new Narrador(conGoles(["a {x}", "b {x}", "c {x}"]), new Rng("relato"));
    const primeros = [1, 2, 3].map(() => narrador.decir("gol_favor", { x: "Fede" }));
    expect(new Set(primeros)).toEqual(new Set(["a Fede", "b Fede", "c Fede"]));
    expect(["a Fede", "b Fede", "c Fede"]).toContain(narrador.decir("gol_favor", { x: "Fede" }));
  });

  it("con la misma semilla dice lo mismo", () => {
    const decir = (): string[] => {
      const narrador = new Narrador(conGoles(["a", "b", "c", "d"]), new Rng("misma"));
      return [1, 2, 3, 4].map(() => narrador.decir("gol_favor"));
    };
    expect(decir()).toEqual(decir());
  });
});

describe("el relato en el contenido", () => {
  it("cada fraseo usa solo las marcas de su clave", () => {
    expect(revisarRelato(RELATO_POR_DEFECTO)).toEqual([]);
    const roto = { ...RELATO_POR_DEFECTO, gol_contra: ["gol de {x}"] };
    expect(revisarRelato(roto).map((p) => p.detalle).join()).toContain('"gol_contra" usa {x}');
  });
});
