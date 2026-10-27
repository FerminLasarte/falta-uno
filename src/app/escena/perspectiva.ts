/**
 * Poner algo plano adentro de una pantalla que el render ve en perspectiva: la placa del
 * menú sobre la tele. Dadas las cuatro esquinas donde tiene que caer un rectángulo de
 * ancho × alto, devuelve el `matrix3d` de CSS que lo lleva ahí (con `transform-origin: 0 0`).
 */

export type Punto = readonly [number, number];

/** Arriba izq, arriba der, abajo der, abajo izq: el orden en que las exporta exportar_pausa.py. */
export type Esquinas = readonly [Punto, Punto, Punto, Punto];

/**
 * La homografía que lleva (0,0), (ancho,0), (ancho,alto) y (0,alto) a las esquinas: ocho
 * incógnitas, dos ecuaciones por esquina. Se resuelve por eliminación con pivoteo.
 */
export function homografia(ancho: number, alto: number, esquinas: Esquinas): number[] {
  const desde: Punto[] = [[0, 0], [ancho, 0], [ancho, alto], [0, alto]];
  const a: number[][] = [];
  const b: number[] = [];
  desde.forEach(([x, y], i) => {
    const [u, v] = esquinas[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  });
  for (let c = 0; c < 8; c++) {
    let pivote = c;
    for (let f = c + 1; f < 8; f++) if (Math.abs(a[f]![c]!) > Math.abs(a[pivote]![c]!)) pivote = f;
    [a[c], a[pivote]] = [a[pivote]!, a[c]!];
    [b[c], b[pivote]] = [b[pivote]!, b[c]!];
    for (let f = 0; f < 8; f++) {
      if (f === c) continue;
      const k = a[f]![c]! / a[c]![c]!;
      for (let j = c; j < 8; j++) a[f]![j]! -= k * a[c]![j]!;
      b[f]! -= k * b[c]!;
    }
  }
  return b.map((x, i) => x / a[i]![i]!);
}

/** La homografía como `matrix3d`, en el orden por columnas que espera CSS. */
export function matrix3d(ancho: number, alto: number, esquinas: Esquinas): string {
  const [h0, h1, h2, h3, h4, h5, h6, h7] = homografia(ancho, alto, esquinas);
  return `matrix3d(${h0},${h3},0,${h6},${h1},${h4},0,${h7},0,0,1,0,${h2},${h5},0,1)`;
}
