import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  APP_ID_DESARROLLO,
  appIdConfigurado,
  cerrarSteam,
  estadoSteam,
  iniciarSteam,
  logros,
  nube,
  relanzarPorSteamSiHaceFalta,
  steamDeshabilitado,
} from "../electron/steam.js";

const original = { ...process.env };

beforeEach(() => {
  process.env["FALTA_UNO_SIN_STEAM"] = "1";
  delete process.env["STEAM_APP_ID"];
});

afterEach(() => {
  cerrarSteam();
  process.env = { ...original };
});

describe("App ID", () => {
  it("sin configurar, usa el público de pruebas", () => {
    expect(appIdConfigurado()).toBe(APP_ID_DESARROLLO);
  });

  it("toma el de la variable de entorno cuando está", () => {
    process.env["STEAM_APP_ID"] = "1234560";
    expect(appIdConfigurado()).toBe(1234560);
  });

  it("ignora un valor basura en vez de romper el arranque", () => {
    process.env["STEAM_APP_ID"] = "no-es-un-numero";
    expect(appIdConfigurado()).toBe(APP_ID_DESARROLLO);
    process.env["STEAM_APP_ID"] = "-5";
    expect(appIdConfigurado()).toBe(APP_ID_DESARROLLO);
  });
});

// La promesa del diseño: sin Steam el juego arranca igual. Nada de esta capa
// puede tirar una excepción hacia arriba.
describe("degradación sin Steam", () => {
  it("iniciar no tira, reporta el motivo y deja el estado consultable", () => {
    const estado = iniciarSteam();
    expect(estado.disponible).toBe(false);
    expect(estado.motivo).toContain("FALTA_UNO_SIN_STEAM");
    expect(estadoSteam()).toEqual(estado);
  });

  it("los logros devuelven false en vez de explotar", () => {
    iniciarSteam();
    expect(logros.activar("PRIMER_VIERNES")).toBe(false);
    expect(logros.activado("PRIMER_VIERNES")).toBe(false);
    expect(logros.limpiar("PRIMER_VIERNES")).toBe(false);
  });

  it("la nube devuelve vacío en vez de explotar", () => {
    iniciarSteam();
    expect(nube.disponible()).toBe(false);
    expect(nube.escribir("x.json", "{}")).toBe(false);
    expect(nube.leer("x.json")).toBeNull();
    expect(nube.listar()).toEqual([]);
  });

  it("no intenta relanzar por Steam si está deshabilitado", () => {
    expect(steamDeshabilitado()).toBe(true);
    expect(relanzarPorSteamSiHaceFalta(true)).toBe(false);
  });

  it("nunca relanza en desarrollo, aunque Steam esté habilitado", () => {
    delete process.env["FALTA_UNO_SIN_STEAM"];
    expect(relanzarPorSteamSiHaceFalta(false)).toBe(false);
  });

  // Sin esta guarda, un build de prueba en una máquina con Steam instalado se
  // cierra solo y lanza Spacewar, que es el dueño real del App ID 480.
  it("en producción no relanza con el App ID de pruebas", () => {
    delete process.env["FALTA_UNO_SIN_STEAM"];
    expect(appIdConfigurado()).toBe(APP_ID_DESARROLLO);
    expect(relanzarPorSteamSiHaceFalta(true)).toBe(false);
  });
});

describe("sin inicializar", () => {
  it("consultar el estado antes de iniciar no rompe", () => {
    cerrarSteam();
    expect(() => estadoSteam()).not.toThrow();
    expect(logros.activar("X")).toBe(false);
  });
});
