import { z } from "zod";
import { ESTADOS_CONTACTO, PERFILES, RASGOS, ROLES, TIPOS_EVENTO } from "../core/tipos.js";

export const efectosSchema = z
  .object({
    moral: z.number().optional(),
    dinero: z.number().optional(),
    probabilidadBaja: z.number().optional(),
    enojo: z.number().optional(),
    dineroAportado: z.number().optional(),
    estado: z.enum(ESTADOS_CONTACTO).optional(),
    registrar: z.enum(TIPOS_EVENTO).optional(),
  })
  .strict();

export const opcionSchema = z
  .object({
    id: z.string().min(1),
    texto: z.string().min(1),
    costoReloj: z.number().int().min(0).max(60),
    efectos: efectosSchema,
    siguiente: z.string().min(1).nullable(),
    requiere: z
      .object({
        dineroMin: z.number().optional(),
        moralMin: z.number().optional(),
        horaDesde: z.number().optional(),
        horaHasta: z.number().optional(),
        escuchado: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
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
    rol: z.enum(ROLES),
    habilidad: z.number().int().min(0).max(100),
    rasgos: z.array(z.enum(RASGOS)),
    probabilidadBajaInicial: z.number().min(0).max(100),
    voz: z.number().min(60).max(260).optional(),
    nodoInicial: z.string().min(1),
    nodos: z.record(z.string(), nodoSchema),
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

export const configSchema = z
  .object({
    horaInicio: z.number().int(),
    horaCorte: z.number().int(),
    jugadoresNecesarios: z.number().int().min(2),
    senaCancha: z.number().int().min(0),
    costoVacante: z.number().int().min(0),
    umbralBaja: z.number().min(0).max(100),
    minutoRevision: z.number().int(),
  })
  .strict()
  .refine((c) => c.horaCorte > c.horaInicio, { message: "horaCorte tiene que ser posterior a horaInicio" })
  .refine((c) => c.minutoRevision > c.horaInicio && c.minutoRevision < c.horaCorte, {
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
  })
  .strict();
