import { beforeEach, describe, expect, it } from "vitest";
import { CHAT_GRUPO, costoDeLeer, Partida } from "../src/core/partida.js";
import type { EstadoDeContacto } from "../src/core/tipos.js";
import {
  agendaCompleta,
  CONFIG,
  contacto,
  interrupcionSegura,
  PERFIL,
  SIN_INTERRUPCIONES,
} from "./ayudas.js";

function nueva(agenda = agendaCompleta(), interrupciones = SIN_INTERRUPCIONES): Partida {
  return new Partida({
    perfil: PERFIL,
    agenda,
    interrupciones,
    config: CONFIG,
    semilla: "test",
  });
}

describe("arranque", () => {
  it("empieza a las 19:00 con los recursos del perfil", () => {
    const p = nueva();
    expect(p.reloj.minutos).toBe(1140);
    expect(p.moral).toBe(PERFIL.moralInicial);
    expect(p.dinero).toBe(PERFIL.dineroInicial);
    expect(p.roster().confirmados).toBe(0);
  });

  it("todos los contactos arrancan sin contactar", () => {
    const p = nueva();
    expect(p.contactos().every((c) => c.estado === "sin_contactar")).toBe(true);
  });
});

describe("el reloj avanza por acción", () => {
  it("escribir consume minutos", () => {
    const p = nueva();
    const antes = p.reloj.minutos;
    p.escribir("c0");
    expect(p.reloj.minutos).toBeGreaterThan(antes);
  });

  it("no pasa el tiempo si no hacés nada", () => {
    const p = nueva();
    const antes = p.reloj.minutos;
    p.contactos();
    p.roster();
    expect(p.reloj.minutos).toBe(antes);
  });

  it("llamar cuesta más reloj que escribir", () => {
    const a = nueva();
    a.escribir("c0");
    const costoEscribir = a.reloj.minutos - 1140;

    const b = nueva();
    b.escribir("c0");
    const antes = b.reloj.minutos;
    b.llamar("c0");
    expect(b.reloj.minutos - antes).toBeGreaterThan(costoEscribir);
  });
});

describe("conversación", () => {
  let p: Partida;
  beforeEach(() => {
    p = nueva();
    p.escribir("c0");
  });

  it("abrir la charla entrega los mensajes del NPC", () => {
    expect(p.estadoDe("c0").historial.length).toBeGreaterThan(0);
    expect(p.estadoDe("c0").estado).toBe("hablando");
  });

  it("leer un mensaje corto es gratis", () => {
    // Si leer siempre costara, el juego castigaría al jugador por hacer justo
    // lo que le pide. Solo pesan los mensajes largos y las quejas.
    expect(p.moral).toBe(PERFIL.moralInicial);
  });

  it("responder que sí lo confirma y suma al roster", () => {
    p.responder("c0", "si");
    expect(p.estadoDe("c0").estado).toBe("confirmado");
    expect(p.roster().confirmados).toBe(1);
  });

  it("el aporte de cada uno entra a la caja", () => {
    const antes = p.dinero;
    p.responder("c0", "si");
    expect(p.dinero).toBe(antes + 1500);
  });

  it("rechaza una opción que no existe sin tocar el estado", () => {
    const antes = p.reloj.minutos;
    const r = p.responder("c0", "opcion_inventada");
    expect(r.ok).toBe(false);
    expect(p.reloj.minutos).toBe(antes);
  });

  it("no se le puede escribir dos veces a la misma persona", () => {
    expect(p.escribir("c0").ok).toBe(false);
  });

  it("apurar sube la probabilidad de que se baje", () => {
    p.responder("c0", "apurar");
    expect(p.estadoDe("c0").probabilidadBaja).toBeGreaterThan(CONFIG.umbralBaja);
    expect(p.bitacora.contar("apuro")).toBe(1);
  });
});

function estadoDe(cambios: Partial<EstadoDeContacto> = {}): EstadoDeContacto {
  return {
    id: "x",
    estado: "hablando",
    probabilidadBaja: 0,
    enojo: 0,
    dineroAportado: 0,
    nodoActual: null,
    historial: [],
    leidoHasta: 0,
    ...cambios,
  };
}

describe("lo que cuesta leer", () => {
  const LARGO =
    "Mirá, la última vez terminamos jugando seis contra cuatro porque no vino " +
    "nadie, y encima puse yo la cancha de mi bolsillo. No me hagas eso otra vez.";

  it("un mensaje largo sí desgasta", () => {
    const p = nueva([contacto("largo", { mensajes: [LARGO] }), ...agendaCompleta()]);
    p.escribir("largo");
    expect(p.moral).toBeLessThan(PERFIL.moralInicial);
  });

  it("el mismo mensaje largo desgasta más si el que escribe es quejoso", () => {
    const neutral = nueva([contacto("n", { mensajes: [LARGO] }), ...agendaCompleta()]);
    neutral.escribir("n");

    const quejoso = nueva([
      contacto("q", { mensajes: [LARGO], rasgos: ["quejoso"] }),
      ...agendaCompleta(),
    ]);
    quejoso.escribir("q");

    expect(quejoso.moral).toBeLessThan(neutral.moral);
  });

  it("costoDeLeer es cero por debajo del largo tolerable", () => {
    const definicion = contacto("x");
    const estado = estadoDe();
    expect(costoDeLeer("¿A qué hora?", definicion, estado)).toBe(0);
    expect(costoDeLeer(LARGO, definicion, estado)).toBeGreaterThan(0);
  });

  it("alguien enojado cansa más aunque no sea quejoso de fábrica", () => {
    const definicion = contacto("x");
    expect(costoDeLeer(LARGO, definicion, estadoDe({ enojo: 80 }))).toBeGreaterThan(
      costoDeLeer(LARGO, definicion, estadoDe()),
    );
  });
});

describe("la lista de chats", () => {
  let p: Partida;
  beforeEach(() => {
    p = nueva();
  });

  it("un contacto sin escribir no tiene último mensaje ni no leídos", () => {
    const c = p.contactos()[0]!;
    expect(c.ultimoMensaje).toBeNull();
    expect(c.minutoUltimo).toBeNull();
    expect(c.sinLeer).toBe(0);
  });

  it("los mensajes recibidos cuentan como no leídos y traen su hora", () => {
    p.escribir("c0");
    const c = p.contactos().find((x) => x.id === "c0")!;
    expect(c.sinLeer).toBeGreaterThan(0);
    expect(c.ultimoMensaje).toBe("¿A qué hora?");
    expect(c.minutoUltimo).toBe(p.reloj.minutos);
  });

  it("abrir el chat los marca como vistos y no cuesta reloj", () => {
    p.escribir("c0");
    const antes = p.reloj.minutos;
    p.marcarLeido("c0");
    expect(p.contactos().find((x) => x.id === "c0")!.sinLeer).toBe(0);
    expect(p.reloj.minutos).toBe(antes);
  });

  it("un mensaje nuevo después de leer vuelve a marcar sin leer", () => {
    p.escribir("c0");
    p.marcarLeido("c0");
    p.responder("c0", "si");
    const c = p.contactos().find((x) => x.id === "c0")!;
    expect(c.estado).toBe("confirmado");
    expect(c.sinLeer).toBe(0); // "si" cierra la charla sin mensajes nuevos
  });
});

describe("la lista del grupo", () => {
  it("guarda el orden en que se anotaron, no el de la agenda", () => {
    const p = nueva();
    p.escribir("c5");
    p.responder("c5", "si");
    p.escribir("c0");
    p.responder("c0", "si");
    p.pagarVacante("delantero");
    expect(p.lista().map((l) => l.id)).toEqual(["c5", "c0", "relleno_1"]);
    expect(p.lista().map((l) => l.relleno)).toEqual([false, false, true]);
  });

  it("el que se baja deja su lugar", () => {
    const p = nueva();
    p.escribir("c0");
    p.responder("c0", "apurar");
    p.escribir("c1");
    p.responder("c1", "si");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    expect(p.lista().map((l) => l.id)).toEqual(["c1"]);
  });
});

describe("cada evento sabe a qué chat pertenece", () => {
  it("lo que se habla con un contacto queda en su chat", () => {
    const p = nueva();
    p.escribir("c0");
    const delChat = p.eventos().filter((e) => e.chat === "c0");
    expect(delChat.map((e) => e.clase)).toEqual(["propio", "mensaje"]);
  });

  it("las confirmaciones se anuncian en el grupo", () => {
    const p = nueva();
    p.escribir("c0");
    p.responder("c0", "si");
    expect(p.eventos().some((e) => e.chat === CHAT_GRUPO && e.texto.includes("confirmó"))).toBe(true);
  });

  it("una interrupción llega en su propio chat", () => {
    const p = nueva(agendaCompleta(), [interrupcionSegura("sofi", 1142)]);
    p.escribir("c0");
    expect(p.eventos().filter((e) => e.chat === "sofi").map((e) => e.de)).toEqual(["Sofi"]);
  });
});

describe("la revisión de las 20:30", () => {
  it("baja a los que quedaron calientes y deja a los demás", () => {
    const p = nueva();
    p.escribir("c0");
    p.responder("c0", "apurar"); // probabilidadBaja 90 > umbral 80
    p.escribir("c1");
    p.responder("c1", "si"); // tranquilo
    expect(p.roster().confirmados).toBe(2);

    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);

    expect(p.estadoDe("c0").estado).toBe("bajado");
    expect(p.estadoDe("c1").estado).toBe("confirmado");
    expect(p.roster().confirmados).toBe(1);
    expect(p.bitacora.contar("baja_tardia")).toBe(1);
  });

  it("solo corre una vez", () => {
    const p = nueva();
    p.escribir("c0");
    p.responder("c0", "apurar");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    const bajas = p.bitacora.contar("baja_tardia");
    p.esperar(5);
    expect(p.bitacora.contar("baja_tardia")).toBe(bajas);
  });

  it("llamar a alguien caliente lo salva de la baja", () => {
    const p = nueva();
    p.escribir("c0");
    p.responder("c0", "apurar");
    p.llamar("c0"); // −30 de probabilidadBaja
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    expect(p.estadoDe("c0").estado).toBe("confirmado");
  });
});

describe("interrupciones", () => {
  it("aparecen dentro de su ventana y drenan moral por acción", () => {
    const p = nueva(agendaCompleta(), [interrupcionSegura("sofi", 1142)]);
    p.escribir("c0");
    expect(p.interrupcionesActivas).toHaveLength(1);

    const moralAntes = p.moral;
    p.esperar(5);
    expect(p.moral).toBeLessThan(moralAntes);
  });

  it("atenderlas cuesta reloj pero frena el drenaje", () => {
    const p = nueva(agendaCompleta(), [interrupcionSegura("sofi", 1142)]);
    p.escribir("c0");
    const relojAntes = p.reloj.minutos;
    p.atender("sofi");
    expect(p.reloj.minutos - relojAntes).toBeGreaterThanOrEqual(15);
    expect(p.interrupcionesActivas).toHaveLength(0);

    const moralAntes = p.moral;
    p.esperar(5);
    expect(p.moral).toBe(moralAntes);
  });

  it("ignorarlas queda registrado para la narración", () => {
    const p = nueva(agendaCompleta(), [interrupcionSegura("sofi", 1142)]);
    p.escribir("c0");
    for (let i = 0; i < 5; i++) p.esperar(3);
    expect(p.bitacora.contar("pareja_ignorada")).toBeGreaterThan(0);
  });
});

describe("plata", () => {
  it("pagar una vacante suma un jugador y descuenta la plata", () => {
    const p = nueva();
    const antes = p.dinero;
    const r = p.pagarVacante("arquero");
    expect(r.ok).toBe(true);
    expect(p.dinero).toBe(antes - CONFIG.costoVacante);
    expect(p.roster().confirmados).toBe(1);
  });

  it("sin plata no se puede tapar el agujero", () => {
    const p = new Partida({
      perfil: { ...PERFIL, dineroInicial: 100 },
      agenda: agendaCompleta(),
      interrupciones: SIN_INTERRUPCIONES,
      config: CONFIG,
      semilla: "pobre",
    });
    expect(p.pagarVacante("arquero").ok).toBe(false);
    expect(p.roster().confirmados).toBe(0);
  });
});

describe("condiciones de fin", () => {
  it("la moral en cero corta el viernes", () => {
    const agenda = Array.from({ length: 12 }, (_, i) =>
      contacto(`x${i}`, { alConfirmar: { moral: -100 } }),
    );
    const p = nueva(agenda);
    p.escribir("x0");
    p.responder("x0", "si");
    expect(p.moral).toBe(0);
    expect(p.terminada).toBe(true);
    expect(p.motivoFin).toBe("moral_agotada");
  });

  it("terminada la partida no se acepta ningún comando más", () => {
    const agenda = Array.from({ length: 12 }, (_, i) =>
      contacto(`x${i}`, { alConfirmar: { moral: -100 } }),
    );
    const p = nueva(agenda);
    p.escribir("x0");
    p.responder("x0", "si");
    expect(p.escribir("x1").ok).toBe(false);
  });

  it("llegar a las 21:00 corta por horario", () => {
    const p = nueva();
    p.esperar(CONFIG.horaCorte - CONFIG.horaInicio);
    expect(p.terminada).toBe(true);
    expect(p.motivoFin).toBe("corte_horario");
  });
});

describe("determinismo", () => {
  it("la misma semilla y las mismas acciones dan el mismo estado", () => {
    const jugar = (): Partida => {
      const p = new Partida({
        perfil: PERFIL,
        agenda: agendaCompleta(),
        interrupciones: [interrupcionSegura("sofi", 1145)],
        config: CONFIG,
        semilla: "determinismo",
      });
      p.escribir("c0");
      p.responder("c0", "si");
      p.escribir("c1");
      p.responder("c1", "apurar");
      p.esperar(20);
      return p;
    };
    const a = jugar();
    const b = jugar();
    expect(a.moral).toBe(b.moral);
    expect(a.dinero).toBe(b.dinero);
    expect(a.reloj.minutos).toBe(b.reloj.minutos);
    expect(a.eventos()).toEqual(b.eventos());
  });
});
