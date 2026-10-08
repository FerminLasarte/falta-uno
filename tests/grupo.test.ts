import { describe, expect, it } from "vitest";
import { GRUPO_QUIETO, type DefinicionGrupo } from "../src/core/grupo.js";
import { alDia, CHAT_GRUPO, Partida } from "../src/core/partida.js";
import { resolver } from "../src/core/resolucion.js";
import type { DefinicionContacto } from "../src/core/tipos.js";
import { agendaCompleta, CONFIG, contacto, PERFIL, SIN_INTERRUPCIONES } from "./ayudas.js";

const AUDIO = {
  id: "aviso_c0",
  segundos: 47,
  transcripcion: "Llego justo, no me pongan al arco.",
  enfriaPorAccion: 2,
};

const GRUPO: DefinicionGrupo = {
  charlas: [
    { id: "arranque", cuando: { desde: 1140, hasta: 1145 }, mensajes: [{ de: "c1", texto: "¿Hoy se juega?" }] },
    { id: "audio", cuando: { desde: 1150, hasta: 1200 }, mensajes: [{ de: "c0", audio: AUDIO }] },
    { id: "confirma_c2", cuando: { alConfirmar: "c2" }, mensajes: [{ de: "c2", texto: "Ahí estoy." }] },
    { id: "dos", cuando: { conConfirmados: 2 }, mensajes: [{ de: "c3", texto: "Van dos." }] },
    { id: "fantasma", cuando: { desde: 1140, hasta: 1260 }, mensajes: [{ de: "no_esta", texto: "Hola" }] },
  ],
  roces: [
    {
      entre: ["rustico", "habilidoso"],
      mensajes: [
        { de: "a", texto: "Si viene {b} me pongo de 9." },
        { de: "b", texto: "Dijo {a}.", cita: true },
      ],
    },
  ],
  calmar: {
    texto: "Calmar a los muchachos",
    costoReloj: 3,
    mensaje: "Bajen un cambio.",
    respuestas: [{ de: "a", texto: "Era joda." }],
    calientaPorAccion: 3,
  },
  cerrar: { texto: "Cerrar la lista", mensaje: "Lista cerrada.", sinDiez: "No llegamos." },
};

function nueva(agenda: DefinicionContacto[] = agendaCompleta(), grupo = GRUPO, semilla = "grupo"): Partida {
  return new Partida({ perfil: PERFIL, agenda, interrupciones: SIN_INTERRUPCIONES, config: CONFIG, semilla, grupo });
}

const delGrupo = (p: Partida) => p.eventos().filter((e) => e.chat === CHAT_GRUPO);
const textosDelGrupo = (p: Partida) => delGrupo(p).map((e) => e.texto);

/** Confirma a alguien: escribirle, dejar que conteste y decir que sí. */
function confirmar(p: Partida, id: string): void {
  p.escribir(id);
  alDia(p);
  p.responder(id, "si");
}

describe("la charla del grupo", () => {
  it("el grupo ya está hablando cuando abrís el teléfono, pero llega en tiempo real", () => {
    const p = nueva();
    expect(textosDelGrupo(p)).not.toContain("¿Hoy se juega?");
    alDia(p);
    expect(textosDelGrupo(p)).toContain("¿Hoy se juega?");
  });

  it("arranca cuando el reloj entra en su franja", () => {
    const p = nueva();
    alDia(p);
    expect(p.audiosSinEscuchar()).toHaveLength(0);
    p.esperar(10);
    alDia(p);
    expect(p.audiosSinEscuchar().map((a) => a.id)).toEqual(["aviso_c0"]);
  });

  it("arranca cuando confirma quien tiene que confirmar", () => {
    const p = nueva();
    confirmar(p, "c2");
    alDia(p);
    expect(textosDelGrupo(p)).toContain("Ahí estoy.");
  });

  it("arranca cuando la lista llega a tanto", () => {
    const p = nueva();
    confirmar(p, "c0");
    alDia(p);
    expect(textosDelGrupo(p)).not.toContain("Van dos.");
    confirmar(p, "c4");
    alDia(p);
    expect(textosDelGrupo(p)).toContain("Van dos.");
  });

  it("si alguien de la charla no está en la agenda, esa charla no pasa", () => {
    const p = nueva();
    p.esperar(30);
    alDia(p);
    expect(textosDelGrupo(p)).not.toContain("Hola");
  });
});

describe("los audios", () => {
  function conAudio(): Partida {
    const p = nueva();
    p.esperar(10);
    alDia(p);
    return p;
  }

  it("no se escucha un audio que todavía no llegó", () => {
    const p = nueva();
    p.esperar(10);
    expect(p.escuchar("aviso_c0").ok).toBe(false);
  });

  it("llega con lo que dura, lo que cuesta escucharlo y la voz de quien lo manda", () => {
    const p = conAudio();
    const evento = delGrupo(p).find((e) => e.audio);
    expect(evento?.audio).toMatchObject({ id: "aviso_c0", segundos: 47, costo: 2 });
    expect(evento?.audio?.voz).toBeGreaterThan(0);
  });

  it("escucharlo cuesta reloj, y una sola vez", () => {
    const p = conAudio();
    const antes = p.reloj.minutos;
    expect(p.escuchar("aviso_c0").ok).toBe(true);
    expect(p.reloj.minutos - antes).toBe(2);
    expect(p.escuchado("aviso_c0")).toBe(true);
    expect(p.escuchar("aviso_c0").ok).toBe(false);
  });

  it("mientras no lo escuches, quien lo mandó se enfría por cada acción", () => {
    const p = conAudio();
    const antes = p.estadoDe("c0").probabilidadBaja;
    p.esperar(1);
    p.esperar(1);
    expect(p.estadoDe("c0").probabilidadBaja).toBe(antes + 4);
    p.escuchar("aviso_c0");
    const escuchado = p.estadoDe("c0").probabilidadBaja;
    p.esperar(1);
    expect(p.estadoDe("c0").probabilidadBaja).toBe(escuchado);
  });

  it("una respuesta que pide haberlo escuchado aparece recién después", () => {
    const base = contacto("c0");
    const conRespuesta: DefinicionContacto = {
      ...base,
      nodos: {
        abre: {
          ...base.nodos["abre"]!,
          opciones: [
            ...base.nodos["abre"]!.opciones,
            {
              id: "cuidar",
              texto: "Tranqui, vos de cinco.",
              costoReloj: 2,
              efectos: { probabilidadBaja: -15 },
              siguiente: null,
              requiere: { escuchado: "aviso_c0" },
            },
          ],
        },
      },
    };
    const p = nueva([conRespuesta, ...agendaCompleta().slice(1)]);
    p.esperar(10);
    alDia(p);
    p.escribir("c0");
    alDia(p);
    expect(p.opcionesDisponibles("c0").map((o) => o.id)).not.toContain("cuidar");
    p.escuchar("aviso_c0");
    expect(p.opcionesDisponibles("c0").map((o) => o.id)).toContain("cuidar");
  });
});

describe("los roces en el grupo", () => {
  const agenda = (): DefinicionContacto[] => [
    contacto("tano", { rol: "defensor", rasgos: ["rustico"] }),
    contacto("fede", { rol: "mediocampista", rasgos: ["habilidoso"] }),
    ...agendaCompleta(),
  ];

  function conRoce(): Partida {
    const p = nueva(agenda());
    confirmar(p, "fede");
    confirmar(p, "tano");
    return p;
  }

  it("se pelean en el grupo, citándose, y el aviso cae cuando terminan", () => {
    const p = conRoce();
    expect(delGrupo(p).some((e) => e.texto.includes("se están cruzando"))).toBe(false);
    alDia(p);
    const grupo = delGrupo(p);
    const ataque = grupo.findIndex((e) => e.texto === "Si viene fede me pongo de 9.");
    const respuesta = grupo[ataque + 1];
    expect(grupo[ataque]?.de).toBe("tano");
    expect(respuesta).toMatchObject({ de: "fede", texto: "Dijo tano.", cita: { de: "tano" } });
    expect(grupo[ataque + 2]?.texto).toContain("se están cruzando");
  });

  it("los mensajes de la pelea vienen marcados; la charla y las respuestas al calmar, no", () => {
    const p = conRoce();
    alDia(p);
    expect(delGrupo(p).find((e) => e.texto === "Si viene fede me pongo de 9.")?.roce).toBe(true);
    expect(delGrupo(p).find((e) => e.texto === "¿Hoy se juega?")?.roce).toBeUndefined();
    p.calmar();
    alDia(p);
    expect(delGrupo(p).find((e) => e.texto === "Era joda.")?.roce).toBeUndefined();
  });

  it("mientras nadie los calme, los dos se calientan con cada acción", () => {
    const p = conRoce();
    expect(p.accionCalmar).not.toBeNull();
    const tano = p.estadoDe("tano").probabilidadBaja;
    const fede = p.estadoDe("fede").probabilidadBaja;
    p.esperar(1);
    expect(p.estadoDe("tano").probabilidadBaja).toBe(tano + 3);
    expect(p.estadoDe("fede").probabilidadBaja).toBe(fede + 3);
  });

  it("calmarlos cuesta reloj, los apaga y queda para la narración", () => {
    const p = conRoce();
    const antes = p.reloj.minutos;
    expect(p.calmar().ok).toBe(true);
    expect(p.reloj.minutos - antes).toBe(3);
    expect(p.accionCalmar).toBeNull();
    expect(p.calmar().ok).toBe(false);

    const tano = p.estadoDe("tano").probabilidadBaja;
    p.esperar(1);
    expect(p.estadoDe("tano").probabilidadBaja).toBe(tano);

    alDia(p);
    expect(textosDelGrupo(p)).toContain("Bajen un cambio.");
    expect(textosDelGrupo(p)).toContain("Era joda.");
    expect(p.bitacora.contar("roce_calmado")).toBe(1);
  });

  /** Completa la lista con los diez y devuelve lo que se narra del partido. */
  function narracion(calmarlos: boolean): string {
    const p = conRoce();
    if (calmarlos) p.calmar();
    for (let i = 0; i < 8; i++) confirmar(p, `c${i}`);
    alDia(p);
    const resultado = resolver(p);
    expect(resultado.hayPartido).toBe(true);
    return resultado.narracion.map((b) => `${b.texto} ${b.porque ?? ""}`).join("\n");
  }

  it("un roce que nadie calmó se narra como pelea", () => {
    expect(narracion(false)).toContain("se gritan todo");
  });

  it("un roce calmado se narra como que lo calmaste, no como pelea", () => {
    const textos = narracion(true);
    expect(textos).not.toContain("se gritan todo");
    expect(textos).toContain("se dan la mano");
    expect(textos).toContain("Los calmaste en el grupo");
  });

  it("sin plantilla para ese cruce, el aviso sale igual, en el momento", () => {
    const p = nueva(agenda(), GRUPO_QUIETO);
    confirmar(p, "fede");
    confirmar(p, "tano");
    expect(delGrupo(p).some((e) => e.texto.includes("se están cruzando"))).toBe(true);
  });
});

describe("determinismo con el grupo vivo", () => {
  it("misma semilla y mismos comandos, misma partida", () => {
    const jugar = (): string[] => {
      const p = nueva();
      confirmar(p, "c0");
      p.esperar(15);
      alDia(p);
      p.escuchar("aviso_c0");
      confirmar(p, "c2");
      alDia(p);
      return p.eventos().map((e) => `${e.minuto}|${e.de}|${e.texto}`);
    };
    expect(jugar()).toEqual(jugar());
  });
});
