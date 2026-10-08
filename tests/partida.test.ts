import { beforeEach, describe, expect, it } from "vitest";
import { FRASES_POR_DEFECTO } from "../src/core/frases.js";
import { alDia, CHAT_GRUPO, costoDeLeer, Partida } from "../src/core/partida.js";
import { resolver } from "../src/core/resolucion.js";
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
    alDia(p);
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
    alDia(a);
    const costoEscribir = a.reloj.minutos - 1140;

    const b = nueva();
    b.escribir("c0");
    alDia(b);
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
    alDia(p);
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
    elegidas: [],
    historial: [],
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
    alDia(p);
    expect(p.moral).toBeLessThan(PERFIL.moralInicial);
  });

  it("el mismo mensaje largo desgasta más si el que escribe es quejoso", () => {
    const neutral = nueva([contacto("n", { mensajes: [LARGO] }), ...agendaCompleta()]);
    neutral.escribir("n");
    alDia(neutral);

    const quejoso = nueva([
      contacto("q", { mensajes: [LARGO], rasgos: ["quejoso"] }),
      ...agendaCompleta(),
    ]);
    quejoso.escribir("q");
    alDia(quejoso);

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

  it("un contacto sin escribir no tiene último mensaje", () => {
    const c = p.contactos()[0]!;
    expect(c.ultimoMensaje).toBeNull();
    expect(c.minutoUltimo).toBeNull();
  });

  it("lo último que dijo trae su hora", () => {
    p.escribir("c0");
    alDia(p);
    const c = p.contactos().find((x) => x.id === "c0")!;
    expect(c.ultimoMensaje).toBe("¿A qué hora?");
    expect(c.minutoUltimo).toBe(p.reloj.minutos);
  });
});

describe("la lista del grupo", () => {
  it("guarda el orden en que se anotaron, no el de la agenda", () => {
    const p = nueva();
    p.escribir("c5");
    alDia(p);
    p.responder("c5", "si");
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "si");
    p.pagarVacante("delantero");
    expect(p.lista().map((l) => l.id)).toEqual(["c5", "c0", "relleno_1"]);
    expect(p.lista().map((l) => l.relleno)).toEqual([false, false, true]);
  });

  it("el que se baja deja su lugar", () => {
    const p = nueva();
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "apurar");
    p.escribir("c1");
    alDia(p);
    p.responder("c1", "si");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(p.lista().map((l) => l.id)).toEqual(["c1"]);
  });
});

describe("cada evento sabe a qué chat pertenece", () => {
  it("lo que se habla con un contacto queda en su chat", () => {
    const p = nueva();
    p.escribir("c0");
    alDia(p);
    const delChat = p.eventos().filter((e) => e.chat === "c0");
    expect(delChat.map((e) => e.clase)).toEqual(["propio", "mensaje"]);
  });

  it("las confirmaciones se anuncian en el grupo", () => {
    const p = nueva();
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "si");
    expect(p.eventos().some((e) => e.chat === CHAT_GRUPO && e.texto.includes("confirmó"))).toBe(true);
  });

  it("una interrupción llega en su propio chat", () => {
    const p = nueva(agendaCompleta(), [interrupcionSegura("sofi", 1142)]);
    p.escribir("c0");
    alDia(p);
    expect(p.eventos().filter((e) => e.chat === "sofi").map((e) => e.de)).toEqual(["Sofi"]);
  });
});

describe("el aviso del que se está por bajar", () => {
  /** c0 queda caliente (90 contra un umbral de 80): a las 20:30 se baja si nadie hace nada. */
  function caliente(agenda = agendaCompleta()): Partida {
    const p = nueva(agenda);
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "apurar");
    alDia(p);
    return p;
  }
  const delChat = (p: Partida, id: string) => p.eventos().filter((e) => e.chat === id).map((e) => e.texto);

  it("te escribe antes de las 20:30, una sola vez", () => {
    const p = caliente();
    expect(p.avisaron).toEqual(["c0"]);
    expect(delChat(p, "c0")).toContain(FRASES_POR_DEFECTO.duda);
    p.esperar(10);
    alDia(p);
    expect(delChat(p, "c0").filter((t) => t === FRASES_POR_DEFECTO.duda)).toHaveLength(1);
  });

  it("con su texto propio si lo tiene", () => {
    const agenda = agendaCompleta().map((c) => (c.id === "c0" ? { ...c, duda: "no sé si llego, está lloviendo" } : c));
    expect(delChat(caliente(agenda), "c0")).toContain("no sé si llego, está lloviendo");
  });

  it("el tranquilo no avisa", () => {
    const p = nueva();
    p.escribir("c1");
    alDia(p);
    p.responder("c1", "si");
    p.esperar(10);
    alDia(p);
    expect(p.avisaron).toEqual([]);
  });

  it("si lo llamás, no se baja", () => {
    const p = caliente();
    p.llamar("c0");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(p.estadoDe("c0").estado).toBe("confirmado");
  });

  it("llamarlo sobre la hora también sirve: lo que se arregla vale desde que atiende", () => {
    const p = caliente();
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos - 2);
    p.llamar("c0"); // la llamada cruza las 20:30
    alDia(p);
    expect(p.reloj.minutos).toBeGreaterThan(CONFIG.minutoRevision);
    expect(p.estadoDe("c0").estado).toBe("confirmado");
  });

  it("si no lo atajaste, la baja se cuenta con el aviso", () => {
    const p = caliente();
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(p.estadoDe("c0").estado).toBe("bajado");
    const motivo = resolver(p).porQueNo.find((m) => m.texto.includes("c0 se bajó"));
    expect(motivo?.porque).toMatch(/^Te avisó a las \d\d:\d\d que no sabía si llegaba$/);
  });
});

describe("la revisión de las 20:30", () => {
  it("baja a los que quedaron calientes y deja a los demás", () => {
    const p = nueva();
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "apurar"); // probabilidadBaja 90 > umbral 80
    p.escribir("c1");
    alDia(p);
    p.responder("c1", "si"); // tranquilo
    expect(p.roster().confirmados).toBe(2);

    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);

    alDia(p);

    expect(p.estadoDe("c0").estado).toBe("bajado");
    expect(p.estadoDe("c1").estado).toBe("confirmado");
    expect(p.roster().confirmados).toBe(1);
    expect(p.bitacora.contar("baja_tardia")).toBe(1);
  });

  it("solo corre una vez", () => {
    const p = nueva();
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "apurar");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    const bajas = p.bitacora.contar("baja_tardia");
    p.esperar(5);
    expect(p.bitacora.contar("baja_tardia")).toBe(bajas);
  });

  it("llamar a alguien caliente lo salva de la baja", () => {
    const p = nueva();
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "apurar");
    p.llamar("c0"); // −30 de probabilidadBaja
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(p.estadoDe("c0").estado).toBe("confirmado");
  });
});

describe("esperar y cerrar la lista", () => {
  /** Le escribe y le confirma a los primeros `cuantos`, con la respuesta `opcion`. */
  function confirmar(p: Partida, cuantos: number, opcion = "si"): void {
    for (const c of p.contactos().slice(0, cuantos)) {
      p.escribir(c.id);
      alDia(p);
      p.responder(c.id, opcion);
    }
  }

  it("esperar cobra una acción cada dos minutos: el que te reclama drena en proporción", () => {
    const p = nueva(agendaCompleta(), [interrupcionSegura("pareja", 1140)]);
    p.escribir("c0");
    alDia(p);
    expect(p.interrupcionesActivas).toHaveLength(1);
    const antes = p.moral;
    p.esperar(8);
    // Cuatro tramos de dos minutos, cada uno drena 2.
    expect(antes - p.moral).toBe(8);
  });

  it("con menos de diez y gente a quien escribirle, todavía no se cierra", () => {
    const p = nueva();
    confirmar(p, 9);
    expect(p.accionCerrar).toBeNull();
    expect(p.cerrarLista().ok).toBe(false);
  });

  it("con los diez se cierra: lo avisás en el grupo y el reloj llega a las 21:00", () => {
    const p = nueva();
    confirmar(p, 10);
    const accion = p.accionCerrar;
    expect(accion).toEqual({ texto: "Cerrar la lista", costoReloj: p.reloj.restante, completa: true });
    expect(p.cerrarLista().ok).toBe(true);
    expect(p.eventos().some((e) => e.chat === CHAT_GRUPO && e.clase === "propio" && e.texto === "Lista cerrada.")).toBe(true);
    expect(p.terminada).toBe(true);
    expect(p.motivoFin).toBe("corte_horario");
  });

  it("si a las 20:30 alguien se va a bajar, el reloj se frena ahí y la lista se vuelve a abrir", () => {
    const p = nueva();
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "apurar"); // probabilidadBaja 90: se baja en la revisión
    for (const c of p.contactos().slice(1, 10)) {
      p.escribir(c.id);
      alDia(p);
      p.responder(c.id, "si");
    }
    expect(p.reloj.minutos).toBeLessThan(CONFIG.minutoRevision);
    p.cerrarLista();
    expect(p.terminada).toBe(false);
    expect(p.reloj.minutos).toBeGreaterThanOrEqual(CONFIG.minutoRevision);
    expect(p.reloj.minutos).toBeLessThan(CONFIG.minutoRevision + 2);
    alDia(p);
    expect(p.estadoDe("c0").estado).toBe("bajado");
    expect(p.roster().confirmados).toBe(9);
    // Quedan dos sin escribir: no se puede cerrar hasta llenarla de nuevo.
    expect(p.accionCerrar).toBeNull();
  });

  it("sin los diez y sin nada más para hacer, se puede cerrar igual: no hay partido", () => {
    const agenda = agendaCompleta().slice(0, 3);
    const p = new Partida({ perfil: { ...PERFIL, dineroInicial: 0 }, agenda, interrupciones: SIN_INTERRUPCIONES, config: CONFIG, semilla: "test" });
    expect(p.accionCerrar).toBeNull();
    confirmar(p, 3);
    // Con lo que aportaron no llega a un reemplazo, y no queda nadie.
    expect(p.dinero).toBeLessThan(CONFIG.costoVacante);
    expect(p.accionCerrar?.completa).toBe(false);
    p.cerrarLista();
    expect(p.eventos().some((e) => e.clase === "propio" && e.texto === "No llegamos.")).toBe(true);
    expect(p.terminada).toBe(true);
  });
});

describe("interrupciones", () => {
  it("aparecen dentro de su ventana y drenan moral por acción", () => {
    const p = nueva(agendaCompleta(), [interrupcionSegura("sofi", 1142)]);
    p.escribir("c0");
    alDia(p);
    expect(p.interrupcionesActivas).toHaveLength(1);

    const moralAntes = p.moral;
    p.esperar(5);
    expect(p.moral).toBeLessThan(moralAntes);
  });

  it("atenderlas cuesta reloj pero frena el drenaje", () => {
    const p = nueva(agendaCompleta(), [interrupcionSegura("sofi", 1142)]);
    p.escribir("c0");
    alDia(p);
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
    alDia(p);
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
    alDia(p);
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
    alDia(p);
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
      alDia(p);
      p.responder("c0", "si");
      p.escribir("c1");
      alDia(p);
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
