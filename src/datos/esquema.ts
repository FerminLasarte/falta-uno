import { z } from "zod";
import { FORMATOS, type Formato } from "../core/modo.js";
import { ESTADOS_CONTACTO, PERFILES, RASGOS, ROLES, TIPOS_EVENTO, type Rol } from "../core/tipos.js";

export const efectosSchema = z
  .object({
    moral: z.number().optional(),
    dinero: z.number().optional(),
    probabilidadBaja: z.number().optional(),
    enojo: z.number().optional(),
    dineroAportado: z.number().optional(),
    estado: z.enum(ESTADOS_CONTACTO).optional(),
    registrar: z.enum(TIPOS_EVENTO).optional(),
    trae: z
      .array(
        z
          .object({
            nombre: z.string().min(1),
            rol: z.enum(ROLES),
            habilidad: z.number().int().min(0).max(100),
            noViene: z.object({ probabilidad: z.number().min(0).max(100), texto: z.string().min(1) }).strict().optional(),
          })
          .strict(),
      )
      .optional(),
    otros: z
      .array(
        z
          .object({ contacto: z.string().min(1), probabilidadBaja: z.number().optional(), enojo: z.number().optional() })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const condicionSchema = z
  .object({
    dineroMin: z.number().optional(),
    moralMin: z.number().optional(),
    horaDesde: z.number().optional(),
    horaHasta: z.number().optional(),
    escuchado: z.string().min(1).optional(),
    confirmado: z.string().min(1).optional(),
    noConfirmado: z.string().min(1).optional(),
    confirmadosMin: z.number().int().min(0).optional(),
    faltanMin: z.number().int().min(1).optional(),
    elegiste: z.string().min(1).optional(),
    elegidoA: z.object({ contacto: z.string().min(1), opcion: z.string().min(1) }).strict().optional(),
  })
  .strict();

export const desvioSchema = z
  .object({
    si: condicionSchema.optional(),
    nodo: z.string().min(1).nullable(),
  })
  .strict();

export const opcionSchema = z
  .object({
    id: z.string().min(1),
    texto: z.string().min(1),
    costoReloj: z.number().int().min(0).max(60),
    efectos: efectosSchema,
    siguiente: z.union([z.string().min(1).nullable(), z.array(desvioSchema).min(1)]),
    requiere: condicionSchema.optional(),
  })
  .strict();

export const nodoSchema = z
  .object({
    mensajes: z.array(z.string().min(1)).min(1),
    opciones: z.array(opcionSchema),
  })
  .strict();

export const contactoSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/, "el id va en snake_case"),
    nombre: z.string().min(1),
    retrato: z.string().min(1),
    rol: z.enum(ROLES),
    habilidad: z.number().int().min(0).max(100),
    rasgos: z.array(z.enum(RASGOS)),
    probabilidadBajaInicial: z.number().min(0).max(100),
    voz: z.number().min(60).max(260).optional(),
    nodoInicial: z.string().min(1),
    aperturas: z.array(z.object({ si: condicionSchema, nodo: z.string().min(1) }).strict()).optional(),
    nodos: z.record(z.string(), nodoSchema),
    bajas: z
      .array(z.object({ si: condicionSchema.optional(), texto: z.string().min(1), porque: z.string().min(1).optional() }).strict())
      .optional(),
    duda: z.string().min(1).optional(),
  })
  .strict();

export const perfilSchema = z
  .object({
    id: z.enum(PERFILES),
    nombre: z.string().min(1),
    moralInicial: z.number().int().min(1).max(100),
    dineroInicial: z.number().int().min(0),
    ventaja: z.string().min(1),
    desventaja: z.string().min(1),
    contactoUnico: z.string().min(1),
    respuesta: z.string().min(1),
    resumen: z.string().min(1),
    excluidos: z.array(z.string().min(1)).optional(),
    probabilidadInterrupciones: z.record(z.string(), z.number().positive()).optional(),
  })
  .strict();

export const frasesSchema = z
  .object({
    saludo: z.string().min(1),
    llamada: z.object({ tuya: z.string().min(1), respuesta: z.string().min(1) }).strict(),
    baja: z.string().min(1),
    duda: z.string().min(1),
  })
  .strict();

export const torneoSchema = z
  .object({
    nombre: z.string().min(1),
    complejo: z.string().min(1),
    cancha: z.string().min(1),
    rivales: z.array(z.object({ nombre: z.string().min(1), nivel: z.number().min(0).max(60) }).strict()).min(1),
  })
  .strict();

const respuestaInscripcionSchema = z
  .object({ respuesta: z.string().min(1), titulo: z.string().min(1), resumen: z.string().min(1) })
  .strict();
const porCompetencia = <T extends z.ZodTypeAny>(t: T) => z.object({ partido: t, torneo: t }).strict();

export const inscripcionSchema = z
  .object({
    chat: z.string().min(1),
    saludo: z.string().min(1),
    competencias: porCompetencia(respuestaInscripcionSchema),
    preguntaFormato: porCompetencia(z.string().min(1)),
    formatos: z.object(Object.fromEntries(FORMATOS.map((f) => [f, z.string().min(1)])) as Record<Formato, z.ZodString>).strict(),
    confirmacion: porCompetencia(z.array(z.string().min(1)).min(1)),
    respuesta: z.string().min(1),
  })
  .strict();

export const interrupcionSchema = z
  .object({
    id: z.string().min(1),
    de: z.string().min(1),
    texto: z.string().min(1),
    minutoDesde: z.number().int(),
    minutoHasta: z.number().int(),
    probabilidad: z.number().min(0).max(100),
    drenajePorAccion: z.number().min(0),
    drenajeMaximo: z.number().min(0).optional(),
    costoAtender: z.number().int().min(0),
    efectosAtender: efectosSchema,
    registrarSiIgnorada: z.enum(TIPOS_EVENTO),
    insistencias: z
      .array(z.object({ texto: z.string().min(1), segundos: z.number().min(1) }).strict())
      .optional(),
  })
  .strict()
  .refine((i) => i.minutoHasta >= i.minutoDesde, {
    message: "minutoHasta tiene que ser >= minutoDesde",
  });

const formatoSchema = z
  .object({
    nombre: z.string().min(1),
    porEquipo: z.number().int().min(2),
    horaInicio: z.number().int().optional(),
    minutoRevision: z.object({ partido: z.number().int().optional(), torneo: z.number().int().optional() }).strict().optional(),
    sena: z.number().int().min(0),
    titulares: z.object(Object.fromEntries(ROLES.map((r) => [r, z.number().int().min(0)])) as Record<Rol, z.ZodNumber>).strict(),
  })
  .strict()
  .refine((f) => Object.values(f.titulares).reduce((a, b) => a + b, 0) === f.porEquipo, {
    message: "los titulares por puesto tienen que sumar porEquipo",
  })
  .refine((f) => f.titulares.arquero === 1, { message: "va uno al arco" });

export const configSchema = z
  .object({
    horaInicio: z.number().int(),
    horaCorte: z.number().int(),
    costoVacante: z.number().int().min(0),
    umbralBaja: z.object({ partido: z.number().min(0).max(100), torneo: z.number().min(0).max(100) }).strict(),
    minutoRevision: z.object({ partido: z.number().int(), torneo: z.number().int() }).strict(),
    suplentesTorneo: z.number().int().min(0),
    formatos: z.object(Object.fromEntries(FORMATOS.map((f) => [f, formatoSchema])) as Record<Formato, typeof formatoSchema>).strict(),
  })
  .strict()
  .refine((c) => c.horaCorte > c.horaInicio, { message: "horaCorte tiene que ser posterior a horaInicio" })
  .refine((c) => Object.values(c.minutoRevision).every((m) => m > c.horaInicio && m < c.horaCorte), {
    message: "minutoRevision tiene que caer dentro del viernes",
  });

// ------------------------------------------------------------------ el grupo

const idSnake = z.string().regex(/^[a-z0-9_]+$/, "el id va en snake_case");

export const audioSchema = z
  .object({
    id: idSnake,
    segundos: z.number().int().min(1).max(300),
    transcripcion: z.string().min(1),
    alEscuchar: efectosSchema.optional(),
    enfriaPorAccion: z.number().min(0).max(20).optional(),
  })
  .strict();

export const mensajeGrupoSchema = z
  .object({
    de: z.string().min(1),
    texto: z.string().min(1).optional(),
    audio: audioSchema.optional(),
    cita: z.boolean().optional(),
  })
  .strict()
  .refine((m) => (m.texto === undefined) !== (m.audio === undefined), {
    message: "un mensaje lleva texto o audio, uno de los dos",
  });

/** En un roce y al calmarlo, los que hablan son "a" y "b": todavía no se sabe quiénes van a ser. */
const mensajeDeParSchema = mensajeGrupoSchema.refine((m) => m.de === "a" || m.de === "b", {
  message: 'en un roce, "de" es "a" o "b"',
});

export const disparadorSchema = z.union([
  z
    .object({ desde: z.number().int(), hasta: z.number().int() })
    .strict()
    .refine((d) => d.hasta >= d.desde, { message: "hasta tiene que ser >= desde" }),
  z.object({ alConfirmar: z.string().min(1) }).strict(),
  z.object({ conConfirmados: z.number().int().min(1) }).strict(),
]);

export const grupoSchema = z
  .object({
    charlas: z.array(
      z
        .object({
          id: idSnake,
          cuando: disparadorSchema,
          mensajes: z.array(mensajeGrupoSchema).min(1),
        })
        .strict(),
    ),
    roces: z.array(
      z
        .object({
          entre: z.tuple([z.enum(RASGOS), z.enum(RASGOS)]),
          mensajes: z.array(mensajeDeParSchema).min(1),
          calmar: z.string().min(1).optional(),
        })
        .strict(),
    ),
    calmar: z
      .object({
        texto: z.string().min(1),
        costoReloj: z.number().int().min(0).max(60),
        mensaje: z.string().min(1),
        respuestas: z.array(mensajeDeParSchema),
        calientaPorAccion: z.number().min(0).max(20),
      })
      .strict(),
    cerrar: z
      .object({
        texto: z.string().min(1),
        mensaje: z.string().min(1),
        sinDiez: z.string().min(1),
      })
      .strict(),
  })
  .strict();
