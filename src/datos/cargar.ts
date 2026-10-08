import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import type { DefinicionGrupo } from "../core/grupo.js";
import type { DefinicionTorneo } from "../core/campana.js";
import type { DefinicionInscripcion } from "../core/inscripcion.js";
import type { DefinicionInterrupcion } from "../core/interrupciones.js";
import type { Config, DefinicionContacto, DefinicionPerfil } from "../core/tipos.js";
import {
  configSchema,
  contactoSchema,
  grupoSchema,
  inscripcionSchema,
  interrupcionSchema,
  perfilSchema,
  torneoSchema,
} from "./esquema.js";
import { revisarGrafo, revisarGrupo, revisarPerfiles, type ProblemaContenido } from "./validar.js";

export interface Contenido {
  readonly config: Config;
  readonly perfiles: readonly DefinicionPerfil[];
  readonly contactos: readonly DefinicionContacto[];
  readonly interrupciones: readonly DefinicionInterrupcion[];
  readonly grupo: DefinicionGrupo;
  readonly inscripcion: DefinicionInscripcion;
  readonly torneo: DefinicionTorneo;
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

/** Lee un archivo de contenido y lo valida. Si no valida, anota cada problema y devuelve null. */
function validar<T extends z.ZodTypeAny>(
  schema: T,
  crudo: unknown,
  archivo: string,
  problemas: ProblemaContenido[],
): z.infer<T> | null {
  const parseado = schema.safeParse(crudo);
  if (parseado.success) return parseado.data;
  for (const issue of parseado.error.issues) {
    problemas.push({ archivo, detalle: `${issue.path.join(".")}: ${issue.message}` });
  }
  return null;
}

export async function cargarContenido(raiz = "contenido"): Promise<Contenido> {
  const problemas: ProblemaContenido[] = [];

  const leer = async <T extends z.ZodTypeAny>(archivo: string, schema: T): Promise<z.infer<T> | null> =>
    validar(schema, await leerJson(join(raiz, archivo)), archivo, problemas);

  const config = await leer("config.json", configSchema);
  const perfiles = await leer("perfiles.json", perfilSchema.array());
  const interrupciones = await leer("interrupciones.json", interrupcionSchema.array());
  const grupo = await leer("grupo.json", grupoSchema);
  const inscripcion = await leer("inscripcion.json", inscripcionSchema);
  const torneo = await leer("torneo.json", torneoSchema);

  const dirContactos = join(raiz, "contactos");
  const archivos = (await readdir(dirContactos)).filter((a) => a.endsWith(".json")).sort();
  const contactos: DefinicionContacto[] = [];
  const idsVistos = new Map<string, string>();

  for (const archivo of archivos) {
    const parseado = validar(contactoSchema, await leerJson(join(dirContactos, archivo)), archivo, problemas);
    if (!parseado) continue;
    const contacto = parseado as DefinicionContacto;

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

  if (grupo && config) problemas.push(...revisarGrupo(grupo as DefinicionGrupo, contactos, config));
  if (perfiles && interrupciones && inscripcion) {
    problemas.push(
      ...revisarPerfiles(perfiles as DefinicionPerfil[], contactos, interrupciones as DefinicionInterrupcion[], inscripcion),
    );
  }

  if (problemas.length > 0 || !config || !perfiles || !interrupciones || !grupo || !inscripcion || !torneo) {
    throw new ErrorDeContenido(problemas);
  }

  return {
    config,
    perfiles: perfiles as DefinicionPerfil[],
    contactos,
    interrupciones: interrupciones as DefinicionInterrupcion[],
    grupo: grupo as DefinicionGrupo,
    inscripcion,
    torneo,
  };
}
