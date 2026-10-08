import { describe, expect, it } from "vitest";
import { FORMATO_ARCHIVO, leerArchivado, nombreDeArchivo, type ViernesArchivado } from "../src/core/archivo.js";

const archivado: ViernesArchivado = {
  formato: FORMATO_ARCHIVO,
  build: { version: "0.1.0", commit: "abc1234", plataforma: "darwin-arm64" },
  campana: { semilla: "1791478390598", perfil: "oficinista", modo: { formato: "f5", competencia: "torneo" } },
  viernes: { fecha: 1, dinero: 9000, contenido: "ccec5dba", pasos: [["t", 300], ["escribir", "carlos_el_quejoso"]] },
  marcas: [{ ms: 0, paso: 0, pantalla: "grupo" }, { ms: 250, paso: 1, pantalla: "contacto:carlos_el_quejoso" }],
  empezado: "2026-10-08T16:53:42.350Z",
  actualizado: "2026-10-08T16:54:37.357Z",
  terminado: false,
};

describe("el archivo de viernes jugados", () => {
  it("guarda un archivo por campaña y fecha", () => {
    expect(nombreDeArchivo("1791478390598", 1)).toBe("1791478390598-fecha-1.json");
    expect(nombreDeArchivo("1791478390598", 2)).not.toBe(nombreDeArchivo("1791478390598", 1));
  });

  it("no deja que la semilla arme una ruta", () => {
    const nombre = nombreDeArchivo("../../etc/x", 1);
    expect(nombre).not.toContain("/");
    expect(nombre).not.toContain("..");
  });

  it("se lee tal como se escribió", () => {
    expect(leerArchivado(JSON.stringify(archivado))).toEqual(archivado);
  });

  it("rechaza lo que no es un viernes archivado", () => {
    expect(leerArchivado("no es json")).toBeNull();
    expect(leerArchivado(JSON.stringify({ ...archivado, formato: 99 }))).toBeNull();
    expect(leerArchivado(JSON.stringify({ ...archivado, campana: { semilla: "x", perfil: "astronauta" } }))).toBeNull();
    expect(leerArchivado(JSON.stringify({ ...archivado, marcas: [{ ms: -1, paso: 0, pantalla: "grupo" }] }))).toBeNull();
    expect(leerArchivado(JSON.stringify({ ...archivado, viernes: { ...archivado.viernes, pasos: [["volar"]] } }))).toBeNull();
  });
});
