/**
 * El motor de vibración del celular: tramos de prendido y apagado, en ms. Lo
 * usan la escena, que lo hace ver, y el sonido, que lo hace oír. Un mensaje es
 * un zumbido; alguien que te reclama algo, o que se baja, son dos.
 */
export const VIBRACION = {
  mensaje: [260],
  reclamo: [190, 120, 190],
} as const satisfies Record<string, readonly number[]>;

/** Dos avisos más juntos que esto se funden en uno: si no, una ráfaga es un temblor. */
export const SEPARACION_MS = 650;
