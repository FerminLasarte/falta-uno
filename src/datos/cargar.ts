import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DefinicionInterrupcion } from "../core/interrupciones.js";
import type { Config, DefinicionContacto, DefinicionPerfil } from "../core/tipos.js";
import { configSchema, contactoSchema, interrupcionSchema, perfilSchema } from "./esquema.js";
import { revisarGrafo, type ProblemaContenido } from "./validar.js";

export interface Contenido {
  readonly config: Config;
  readonly perfiles: readonly DefinicionPerfil[];
  readonly contactos: readonly DefinicionContacto[];
  readonly interrupciones: readonly DefinicionInterrupcion[];
}

export class ErrorDeContenido extends Error {
  constructor(readonly problemas: readonly ProblemaContenido[]) {
    super(
      `El contenido no valida (${problemas.length} problema/s):\n` +
        problemas.map((p) => `  · ${p.archivo}: ${p.detalle}`).join("\n"),
    );
    this.name = "ErrorDeContenido";
  }
}

async function leerJson(ruta: string): Promise<unknown> {
  return JSON.parse(await readFile(ruta, "utf8"));
}

export async function cargarContenido(raiz = "contenido"): Promise<Contenido> {
  const problemas: ProblemaContenido[] = [];

  const configCruda = await leerJson(join(raiz, "config.json"));
  const config = configSchema.safeParse(configCruda);
  if (!config.success) {
    for (const issue of config.error.issues) {
      problemas.push({ archivo: "config.json", detalle: `${issue.path.join(".")}: ${issue.message}` });
    }
  }

  const perfilesCrudos = await leerJson(join(raiz, "perfiles.json"));
  const perfiles = perfilSchema.array().safeParse(perfilesCrudos);
  if (!perfiles.success) {
    for (const issue of perfiles.error.issues) {
      problemas.push({ archivo: "perfiles.json", detalle: `${issue.path.join(".")}: ${issue.message}` });
    }
  }

  const interrupcionesCrudas = await leerJson(join(raiz, "interrupciones.json"));
  const interrupciones = interrupcionSchema.array().safeParse(interrupcionesCrudas);
  if (!interrupciones.success) {
    for (const issue of interrupciones.error.issues) {
      problemas.push({
        archivo: "interrupciones.json",
        detalle: `${issue.path.join(".")}: ${issue.message}`,
      });
    }
  }

  const dirContactos = join(raiz, "contactos");
  const archivos = (await readdir(dirContactos)).filter((a) => a.endsWith(".json")).sort();
  const contactos: DefinicionContacto[] = [];
  const idsVistos = new Map<string, string>();

  for (const archivo of archivos) {
    const crudo = await leerJson(join(dirContactos, archivo));
    const parseado = contactoSchema.safeParse(crudo);
    if (!parseado.success) {
      for (const issue of parseado.error.issues) {
        problemas.push({ archivo, detalle: `${issue.path.join(".")}: ${issue.message}` });
      }
      continue;
    }
    const contacto = parseado.data as DefinicionContacto;

    const duplicado = idsVistos.get(contacto.id);
    if (duplicado) {
      problemas.push({ archivo, detalle: `el id "${contacto.id}" ya lo usa ${duplicado}` });
    }
    idsVistos.set(contacto.id, archivo);

    const esperado = `${contacto.id}.json`;
    if (archivo !== esperado) {
      problemas.push({ archivo, detalle: `el archivo debería llamarse "${esperado}"` });
    }

    problemas.push(...revisarGrafo(contacto, archivo));
    contactos.push(contacto);
  }

  if (contactos.length === 0) {
    problemas.push({ archivo: "contactos/", detalle: "no hay ningún contacto cargado" });
  }

  if (problemas.length > 0) throw new ErrorDeContenido(problemas);

  return {
    config: config.data!,
    perfiles: perfiles.data! as DefinicionPerfil[],
    contactos,
    interrupciones: interrupciones.data! as DefinicionInterrupcion[],
  };
}
