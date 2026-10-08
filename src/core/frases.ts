/**
 * Lo que decís vos y lo que dice cualquiera sin texto propio: el primer mensaje
 * a cada uno, la llamada y la baja genérica. Sale de `contenido/frases.json`,
 * con el mismo registro que el resto: es tu voz, no la de la app.
 */
export interface Frases {
  /** Lo primero que le mandás a cada uno. */
  readonly saludo: string;
  readonly llamada: {
    /** Cómo se ve la llamada en el chat. `{nombre}` es a quién llamás. */
    readonly tuya: string;
    /** Lo que te contesta el que atiende. */
    readonly respuesta: string;
  };
  /** Lo que dice al bajarse quien no tiene una baja propia. */
  readonly baja: string;
  /** Lo que avisa el que se está por bajar, si no tiene una duda propia. */
  readonly duda: string;
}

/** Para tests y partidas sin contenido. */
export const FRASES_POR_DEFECTO: Frases = {
  saludo: "che jugás hoy a las 21?",
  llamada: { tuya: "📞 Lo llamás a {nombre}.", respuesta: "bueno bueno ya te dije q voy, cortá" },
  baja: "perdón me surgió algo, no llego",
  duda: "che no sé si llego eh, después te confirmo",
};
