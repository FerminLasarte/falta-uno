import { describe, expect, it } from "vitest";
import { formatearHora, Reloj } from "../src/core/tiempo.js";

describe("Reloj", () => {
  it("arranca en el inicio y avanza por acción", () => {
    const reloj = new Reloj(1140, 1260);
    expect(reloj.minutos).toBe(1140);
    reloj.avanzar(8);
    expect(reloj.minutos).toBe(1148);
    expect(reloj.restante).toBe(112);
  });

  it("no pasa del corte y devuelve lo realmente consumido", () => {
    const reloj = new Reloj(1140, 1260);
    reloj.avanzar(115);
    expect(reloj.avanzar(30)).toBe(5);
    expect(reloj.minutos).toBe(1260);
    expect(reloj.agotado).toBe(true);
  });

  it("no retrocede", () => {
    expect(() => new Reloj(1140, 1260).avanzar(-5)).toThrow();
  });

  it("rechaza un corte anterior al inicio", () => {
    expect(() => new Reloj(1260, 1140)).toThrow();
  });

  it("formatea la hora como la lee un jugador", () => {
    expect(formatearHora(1140)).toBe("19:00");
    expect(formatearHora(1230)).toBe("20:30");
    expect(formatearHora(1260)).toBe("21:00");
  });
});
