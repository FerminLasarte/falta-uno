import { describe, expect, it } from "vitest";
import { homografia, matrix3d, type Esquinas } from "../src/app/escena/perspectiva.js";

/** Aplica la homografía a un punto, como lo hace el navegador con el matrix3d. */
function llevar(h: number[], x: number, y: number): [number, number] {
  const w = h[6]! * x + h[7]! * y + 1;
  return [(h[0]! * x + h[1]! * y + h[2]!) / w, (h[3]! * x + h[4]! * y + h[5]!) / w];
}

describe("la placa en la tele", () => {
  // Las esquinas de la pantalla en la toma de pausa, en píxeles de un cuadro de 1280 × 800.
  const tele: Esquinas = [[305.2, 174.1], [1006.5, 155.4], [1005.1, 590.5], [306.3, 570.4]];

  it("cada esquina del rectángulo cae en su esquina de la pantalla", () => {
    const h = homografia(588, 336, tele);
    const desde: [number, number][] = [[0, 0], [588, 0], [588, 336], [0, 336]];
    desde.forEach(([x, y], i) => {
      const [u, v] = llevar(h, x, y);
      expect(u).toBeCloseTo(tele[i]![0], 6);
      expect(v).toBeCloseTo(tele[i]![1], 6);
    });
  });

  it("sin perspectiva, es una escala y un corrimiento", () => {
    const h = homografia(100, 50, [[10, 20], [210, 20], [210, 120], [10, 120]]);
    expect(h[0]).toBeCloseTo(2);
    expect(h[4]).toBeCloseTo(2);
    expect(h[2]).toBeCloseTo(10);
    expect(h[5]).toBeCloseTo(20);
    expect(h[6]).toBeCloseTo(0);
    expect(h[7]).toBeCloseTo(0);
  });

  it("el matrix3d va por columnas, con la perspectiva en la cuarta", () => {
    const m = matrix3d(100, 50, [[0, 0], [100, 0], [100, 50], [0, 50]]);
    const n = m.slice("matrix3d(".length, -1).split(",").map(Number);
    expect(n).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1].map((x) => expect.closeTo(x, 9)));
  });
});
