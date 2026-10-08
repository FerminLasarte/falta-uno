import { describe, expect, it } from "vitest";
import { FRECUENCIA_MUESTREO, tono, zumbido } from "../src/app/sonido/sintesis.js";
import { VIBRACION } from "../src/app/telefono/vibracion.js";

const pico = (x: Float32Array): number => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe("los sonidos del teléfono", () => {
  it("se generan siempre igual", () => {
    expect(tono(false)).toEqual(tono(false));
    expect(zumbido(VIBRACION.reclamo)).toEqual(zumbido(VIBRACION.reclamo));
  });

  it("no saturan", () => {
    for (const x of [tono(false), tono(true), zumbido(VIBRACION.mensaje), zumbido(VIBRACION.reclamo)]) {
      expect(pico(x)).toBeGreaterThan(0.1);
      expect(pico(x)).toBeLessThanOrEqual(1);
    }
  });

  it("el tono de un reclamo dura más que el de un mensaje", () => {
    expect(tono(true).length).toBeGreaterThan(tono(false).length);
  });

  it("el motor dura lo que su patrón y se calla en los tramos apagados", () => {
    const [on, off] = VIBRACION.reclamo;
    const x = zumbido(VIBRACION.reclamo);
    const suma = VIBRACION.reclamo.reduce((t, ms) => t + ms, 0);
    expect(x.length).toBe(Math.round((FRECUENCIA_MUESTREO * suma) / 1000));
    // En el medio del silencio solo queda la cola del filtro: casi nada.
    const medio = Math.round((FRECUENCIA_MUESTREO * (on! + off! / 2)) / 1000);
    const ventana = x.subarray(medio - 200, medio + 200);
    expect(pico(ventana)).toBeLessThan(0.01);
  });
});
