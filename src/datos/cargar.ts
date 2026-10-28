import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import type { Frases } from "../core/frases.js";
import type { Relato } from "../core/relato.js";
import type { DefinicionGrupo } from "../core/grupo.js";
import type { DefinicionTorneo } from "../core/campana.js";
import type { DefinicionInscripcion } from "../core/inscripcion.js";
import type { DefinicionInterrupcion } from "../core/interrupciones.js";
import type { ConfigContenido } from "../core/modo.js";
import type { Elenco, Elencos } from "../core/perfiles.js";
import type { DefinicionContacto, DefinicionPerfil, PerfilId } from "../core/tipos.js";
import {
  configSchema,
  contactoSchema,
  frasesSchema,
  relatoSchema,
  grupoSchema,
  inscripcionSchema,
  interrupcionSchema,
  perfilSchema,
  torneoSchema,
} from "./esquema.js";
import {
  revisarCondiciones,
  revisarGrafo,
  revisarGrupo,
  revisarMarcas,
  revisarPerfiles,
  revisarRelato,
  type ProblemaContenido,
} from "./validar.js";

/**
 * Lo común está en la raíz de `contenido/`: la config, los perfiles, la charla
 * con la cancha, el torneo y el relato. El mundo de cada perfil, en
 * `contenido/elencos/<perfil>/`: sus contactos, su grupo, sus interrupciones y
 * sus frases. Lo que está en `contenido/borradores/` no se carga.
 */
export interface Contenido {
  readonly config: ConfigContenido;
  readonly perfiles: readonly DefinicionPerfil[];
  /** Solo los perfiles que ya tienen elenco: los otros todavía no se juegan. */
  readonly elencos: Elencos;
  readonly inscripcion: DefinicionInscripcion;
  readonly torneo: DefinicionTorneo;
  readonly relato: Relato;
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

  const config = (await leer("config.json", configSchema)) as ConfigContenido | null;
  const perfiles = (await leer("perfiles.json", perfilSchema.array())) as DefinicionPerfil[] | null;
  const inscripcion = await leer("inscripcion.json", inscripcionSchema);
  const torneo = await leer("torneo.json", torneoSchema);
  const relato = await leer("relato.json", relatoSchema);
  if (relato) problemas.push(...revisarRelato(relato));

  const elencos: Partial<Record<PerfilId, Elenco>> = {};
  const carpetas = (await readdir(join(raiz, "elencos"), { withFileTypes: true })).filter((d) => d.isDirectory());
  for (const { name: id } of carpetas.sort((a, b) => a.name.localeCompare(b.name))) {
    const perfil = perfiles?.find((p) => p.id === id);
    if (!perfil) {
      if (perfiles) problemas.push({ archivo: `elencos/${id}/`, detalle: "no es la carpeta de ningún perfil de perfiles.json" });
      continue;
    }
    const elenco = await cargarElenco(join(raiz, "elencos", id), `elencos/${id}/`, config, problemas);
    if (elenco) elencos[perfil.id] = elenco;
  }
  if (carpetas.length === 0) problemas.push({ archivo: "elencos/", detalle: "ningún perfil tiene elenco: no hay nada para jugar" });
  if (perfiles && inscripcion) problemas.push(...revisarPerfiles(perfiles, elencos, inscripcion));

  if (problemas.length > 0 || !config || !perfiles || !inscripcion || !torneo || !relato) {
    throw new ErrorDeContenido(problemas);
  }

  return { config, perfiles, elencos, inscripcion, torneo, relato };
}

/** Un elenco entero, revisado por dentro: todo lo que nombra tiene que estar en él. */
async function cargarElenco(
  dir: string,
  prefijo: string,
  config: ConfigContenido | null,
  todos: ProblemaContenido[],
): Promise<Elenco | null> {
  const problemas: ProblemaContenido[] = [];
  const leer = async <T extends z.ZodTypeAny>(archivo: string, schema: T): Promise<z.infer<T> | null> =>
    validar(schema, await leerJson(join(dir, archivo)), archivo, problemas);

  const grupo = (await leer("grupo.json", grupoSchema)) as DefinicionGrupo | null;
  const interrupciones = (await leer("interrupciones.json", interrupcionSchema.array())) as DefinicionInterrupcion[] | null;
  const frases = (await leer("frases.json", frasesSchema)) as Frases | null;

  const dirContactos = join(dir, "contactos");
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

  problemas.push(...revisarCondiciones(contactos));
  if (grupo && config) problemas.push(...revisarGrupo(grupo, contactos, config));
  if (grupo && interrupciones) problemas.push(...revisarMarcas(contactos, grupo, interrupciones));

  // Los revisores nombran el archivo como si el elenco fuera lo único que hay.
  const propios = new Set(["grupo.json", "interrupciones.json", "frases.json"]);
  for (const p of problemas) {
    const archivo = propios.has(p.archivo) || p.archivo.endsWith("/") ? p.archivo : `contactos/${p.archivo}`;
    todos.push({ archivo: `${prefijo}${archivo}`, detalle: p.detalle });
  }
  if (problemas.length > 0 || !grupo || !interrupciones || !frases) return null;
  return { contactos, grupo, interrupciones, frases };
}
