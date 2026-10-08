import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cargar, configurarCarpeta, guardar, leerCopia, masNueva } from "../electron/guardado.js";

// Sin Steam la nube no está: todo esto es la copia local, que es la que tiene
// que andar siempre.
let carpeta = "";
const original = { ...process.env };

beforeEach(() => {
  process.env["FALTA_UNO_SIN_STEAM"] = "1";
  carpeta = mkdtempSync(join(tmpdir(), "falta-uno-"));
  configurarCarpeta(carpeta);
});

afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
  process.env = { ...original };
});

const enDisco = (nombre: string): unknown => JSON.parse(readFileSync(join(carpeta, "saves", nombre), "utf8"));

describe("el guardado local", () => {
  it("sin nada guardado, no hay nada que cargar", () => {
    expect(cargar("partida.json")).toEqual({ contenido: null, origen: null });
  });

  it("lo que se guarda se carga igual", () => {
    expect(guardar("partida.json", "hola").local).toBe(true);
    expect(cargar("partida.json")).toEqual({ contenido: "hola", origen: "local" });
  });

  it("cada guardado sube el sello y no deja archivos a medias", () => {
    guardar("partida.json", "uno");
    guardar("partida.json", "dos");
    expect(enDisco("partida.json")).toEqual({ sello: 2, datos: "dos" });
    expect(readdirSync(join(carpeta, "saves"))).toEqual(["partida.json"]);
  });

  it("el sello sigue al que ya estaba en disco, aunque el juego recién arranque", () => {
    mkdirSync(join(carpeta, "saves"));
    writeFileSync(join(carpeta, "saves", "partida.json"), JSON.stringify({ sello: 7, datos: "viejo" }));
    configurarCarpeta(carpeta);
    guardar("partida.json", "nuevo");
    expect(enDisco("partida.json")).toEqual({ sello: 8, datos: "nuevo" });
  });

  it("un archivo roto es como no tener nada", () => {
    mkdirSync(join(carpeta, "saves"));
    writeFileSync(join(carpeta, "saves", "partida.json"), "{a medias");
    expect(cargar("partida.json").contenido).toBeNull();
    guardar("partida.json", "de cero");
    expect(enDisco("partida.json")).toEqual({ sello: 1, datos: "de cero" });
    expect(existsSync(join(carpeta, "saves", "partida.json.tmp"))).toBe(false);
  });
});

describe("entre la nube y el disco", () => {
  it("gana la copia más nueva, esté donde esté", () => {
    const vieja = { sello: 3, datos: "a" };
    const nueva = { sello: 5, datos: "b" };
    expect(masNueva(vieja, nueva)).toBe(nueva);
    expect(masNueva(nueva, vieja)).toBe(nueva);
    expect(masNueva(null, vieja)).toBe(vieja);
    expect(masNueva(vieja, null)).toBe(vieja);
    expect(masNueva(null, null)).toBeNull();
  });

  it("una copia sin sello o sin datos no cuenta", () => {
    expect(leerCopia(null)).toBeNull();
    expect(leerCopia("{}")).toBeNull();
    expect(leerCopia(JSON.stringify({ sello: 1.5, datos: "x" }))).toBeNull();
    expect(leerCopia(JSON.stringify({ sello: 1, datos: 3 }))).toBeNull();
    expect(leerCopia(JSON.stringify({ sello: 1, datos: "x" }))).toEqual({ sello: 1, datos: "x" });
  });
});
