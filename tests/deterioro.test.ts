import { describe, expect, it } from "vitest";
import { calcularDeterioro, MORAL_INTACTA } from "../src/app/estado/deterioro.js";

describe("deterioro", () => {
  it("con moral alta la interfaz está impecable", () => {
    expect(calcularDeterioro(100)).toBe(0);
    expect(calcularDeterioro(MORAL_INTACTA)).toBe(0);
  });

  it("con la moral en cero está en el máximo", () => {
    expect(calcularDeterioro(0)).toBe(1);
  });

  it("crece de forma monótona a medida que cae la moral", () => {
    let anterior = -1;
    for (let moral = 100; moral >= 0; moral -= 5) {
      const actual = calcularDeterioro(moral);
      expect(actual).toBeGreaterThanOrEqual(anterior);
      anterior = actual;
    }
  });

  it("arranca despacio: la mitad de la moral perdida no es medio deterioro", () => {
    // La curva es exponencial a propósito. Si fuera lineal, el jugador vería
    // la interfaz pudrirse desde el primer mensaje largo.
    expect(calcularDeterioro(MORAL_INTACTA / 2)).toBeLessThan(0.5);
  });

  it("nunca se sale del rango, ni con valores absurdos", () => {
    for (const moral of [-50, -1, 0, 50, 100, 240, Number.MAX_SAFE_INTEGER]) {
      const d = calcularDeterioro(moral);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });
});
