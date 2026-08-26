import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng.js";

describe("Rng", () => {
  it("da la misma secuencia para la misma semilla", () => {
    const a = new Rng("falta-uno");
    const b = new Rng("falta-uno");
    const serieA = Array.from({ length: 20 }, () => a.siguiente());
    const serieB = Array.from({ length: 20 }, () => b.siguiente());
    expect(serieA).toEqual(serieB);
  });

  it("da secuencias distintas para semillas distintas", () => {
    const a = new Rng("uno");
    const b = new Rng("dos");
    expect(a.siguiente()).not.toBe(b.siguiente());
  });

  it("se puede serializar y retomar exactamente donde estaba", () => {
    const original = new Rng(12345);
    for (let i = 0; i < 7; i++) original.siguiente();
    const clon = Rng.desde(original.serializar());
    expect(clon.siguiente()).toBe(Rng.desde(original.serializar()).siguiente());
  });

  it("mantiene los enteros dentro del rango pedido", () => {
    const rng = new Rng("rango");
    for (let i = 0; i < 500; i++) {
      const n = rng.entero(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it("mezclar no pierde ni duplica elementos", () => {
    const rng = new Rng("mezcla");
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const mezclado = rng.mezclar(original);
    expect(mezclado.sort((a, b) => a - b)).toEqual(original);
  });

  it("elegir sobre una lista vacía es un error, no un undefined silencioso", () => {
    expect(() => new Rng(1).elegir([])).toThrow();
  });
});
