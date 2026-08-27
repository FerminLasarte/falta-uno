/**
 * El proceso principal se empaqueta como CommonJS: es el camino más probado
 * para Electron con módulos nativos. `__dirname` no existe en el tipado ESM del
 * fuente, así que se declara acá una sola vez.
 */
declare const __dirname: string;

/** Carpeta donde quedó el bundle del proceso principal (dist/electron). */
export const carpetaBundle: string = __dirname;
