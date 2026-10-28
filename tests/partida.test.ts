import { beforeEach, describe, expect, it } from "vitest";
import { FRASES_POR_DEFECTO } from "../src/core/frases.js";
import { alDia, CHAT_GRUPO, costoDeLeer, Partida } from "../src/core/partida.js";
import { resolver } from "../src/core/resolucion.js";
import type { Config, EstadoDeContacto } from "../src/core/tipos.js";
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

describe("las excusas de la noche", () => {
  function conExcusas(min: number, max: number, semilla = "excusas", agenda = agendaCompleta()): Partida {
    return new Partida({ perfil: PERFIL, agenda, interrupciones: SIN_INTERRUPCIONES, config: { ...CONFIG, excusas: { min, max } }, semilla });
  }
  /** A quiénes les tocó no poder: les escribe a todos y mira quién contestó con la excusa. */
  function excusados(p: Partida): string[] {
    for (const c of p.contactos()) p.escribir(c.id);
    alDia(p);
    return p.bitacora.de("excusa").map((e) => e.contactoId!);
  }

  it("al que le toca no poder contesta con su excusa y queda afuera", () => {
    const agenda = agendaCompleta().map((c) => ({ ...c, excusas: [`${c.id} hoy no puede`] }));
    const p = conExcusas(1, 1, "excusas", agenda);
    const [id] = excusados(p);
    expect(id).toBeDefined();
    expect(p.estadoDe(id!).estado).toBe("rechazado");
    expect(p.eventos().filter((e) => e.chat === id).map((e) => e.texto)).toContain(`${id} hoy no puede`);
    expect(p.opcionesDisponibles(id!)).toEqual([]);
  });

  it("nunca deja la agenda sin margen: con doce para diez, a lo sumo uno", () => {
    for (const semilla of ["a", "b", "c", "d", "e"]) expect(excusados(conExcusas(5, 5, semilla))).toHaveLength(1);
  });

  it("la misma semilla elige a los mismos", () => {
    expect(excusados(conExcusas(1, 2, "igual"))).toEqual(excusados(conExcusas(1, 2, "igual")));
  });

  it("sin excusas en la config, nadie tiene una", () => {
    expect(excusados(nueva())).toEqual([]);
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

  describe("con plazo", () => {
    const conPlazo = (): Partida => {
      const p = new Partida({ perfil: PERFIL, agenda: agendaCompleta(), interrupciones: SIN_INTERRUPCIONES, config: { ...CONFIG, plazoDuda: 20 }, semilla: "test" });
      p.escribir("c0");
      alDia(p);
      p.responder("c0", "apurar");
      alDia(p);
      return p;
    };

    it("se baja cuando se le vence, sin esperar a las 20:30", () => {
      const p = conPlazo();
      expect(p.avisaron).toEqual(["c0"]);
      p.esperar(18);
      alDia(p);
      expect(p.estadoDe("c0").estado).toBe("confirmado");
      p.esperar(2);
      alDia(p);
      expect(p.estadoDe("c0").estado).toBe("bajado");
      expect(p.reloj.minutos).toBeLessThan(CONFIG.minutoRevision);
      // Una baja temprana no es la revisión: esa se anuncia a las 20:30.
      expect(p.eventos().some((e) => e.texto.includes("última revisión"))).toBe(false);
    });

    it("si lo llamás antes, deja de dudar y no se baja", () => {
      const p = conPlazo();
      p.llamar("c0");
      p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
      alDia(p);
      expect(p.estadoDe("c0").estado).toBe("confirmado");
    });

    it("la revisión le recorta el plazo al que se calentó tarde", () => {
      const p = new Partida({ perfil: PERFIL, agenda: agendaCompleta(), interrupciones: SIN_INTERRUPCIONES, config: { ...CONFIG, plazoDuda: 20 }, semilla: "test" });
      p.esperar(CONFIG.minutoRevision - 10 - p.reloj.minutos);
      p.escribir("c0");
      alDia(p);
      p.responder("c0", "apurar");
      alDia(p);
      p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
      alDia(p);
      expect(p.estadoDe("c0").estado).toBe("bajado");
    });
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

describe("lo que se baja sin avisar", () => {
  it("la mentira se descubre cuando los dos quedan en la lista, no a las 20:30", () => {
    const agenda = agendaCompleta().map((c) =>
      c.id === "c0" ? { ...c, bajas: [{ si: { elegiste: "si", confirmado: "c1" }, texto: "me mentiste" }] } : c,
    );
    const p = nueva(agenda);
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "si");
    p.esperar(10);
    alDia(p);
    expect(p.estadoDe("c0").estado).toBe("confirmado");
    p.escribir("c1");
    alDia(p);
    p.responder("c1", "si");
    p.esperar(2);
    alDia(p);
    expect(p.estadoDe("c0").estado).toBe("bajado");
    expect(p.reloj.minutos).toBeLessThan(CONFIG.minutoRevision);
  });

  it("el invitado que no viene avisa a las 20:30: no lo conocés, no te avisa antes", () => {
    const trae = [{ nombre: "El primo", rol: "defensor" as const, habilidad: 50, noViene: { probabilidad: 100, texto: "el primo no viene" } }];
    const agenda = agendaCompleta().map((c) => (c.id === "c0" ? contacto("c0", { alConfirmar: { trae } }) : c));
    const p = nueva(agenda);
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "si");
    expect(p.roster().confirmados).toBe(2);
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    const falta = p.bitacora.de("no_vino")[0];
    expect(falta?.minuto).toBe(CONFIG.minutoRevision);
    expect(p.roster().confirmados).toBe(1);
  });
});

describe("los imprevistos", () => {
  /** Confirma a todos los que puede y deja correr el reloj hasta la revisión, leyendo lo que llega. */
  function hastaLaRevision(config: Partial<Config>, agenda = agendaCompleta().slice(0, 3)): Partida {
    const p = new Partida({
      perfil: PERFIL,
      agenda,
      interrupciones: SIN_INTERRUPCIONES,
      config: { ...CONFIG, imprevistos: { min: 1, max: 1 }, ...config },
      semilla: "imprevisto",
    });
    for (const c of p.contactos()) {
      p.escribir(c.id);
      alDia(p);
      if (p.estadoDe(c.id).estado !== "rechazado") p.responder(c.id, "si");
    }
    // De a poco, leyendo lo que llega: la baja cuenta cuando llega el mensaje.
    while (p.reloj.minutos < CONFIG.minutoRevision) {
      p.esperar(2);
      alDia(p);
    }
    return p;
  }

  it("al que le toca y está confirmado se baja a esa hora, sin aviso y sin culpa tuya", () => {
    // Tres para uno: hay margen para un imprevisto.
    const p = hastaLaRevision({ jugadoresNecesarios: 1 });
    const bajas = p.bitacora.de("baja_tardia");
    expect(bajas).toHaveLength(1);
    expect(bajas[0]!.minuto).toBeLessThan(CONFIG.minutoRevision);
    expect(bajas[0]!.detalle).toMatch(/imprevisto/);
    expect(p.avisaron).toEqual([]);
  });

  it("nunca más de los que el margen aguanta: con tres para diez, ninguno", () => {
    expect(hastaLaRevision({}).bitacora.contar("baja_tardia")).toBe(0);
  });

  it("el margen descuenta las excusas: con doce para diez, uno; con una excusa, ninguno", () => {
    expect(hastaLaRevision({}, agendaCompleta()).bitacora.contar("baja_tardia")).toBe(1);
    const p = hastaLaRevision({ excusas: { min: 1, max: 1 } }, agendaCompleta());
    expect(p.bitacora.contar("excusa")).toBe(1);
    expect(p.bitacora.contar("baja_tardia")).toBe(0);
  });

  it("sin imprevistos en la config, nadie tiene uno", () => {
    const p = nueva(agendaCompleta().slice(0, 3));
    for (const c of p.contactos()) {
      p.escribir(c.id);
      alDia(p);
      p.responder(c.id, "si");
    }
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    alDia(p);
    expect(p.bitacora.contar("baja_tardia")).toBe(0);
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

  it("si solo faltan suplentes, se paga de cualquier puesto: sin eso no quedaba nada que tocar", () => {
    const p = new Partida({
      perfil: PERFIL,
      agenda: agendaCompleta().slice(0, 10),
      interrupciones: SIN_INTERRUPCIONES,
      config: { ...CONFIG, jugadoresNecesarios: 11, suplentes: 1 },
      semilla: "suplente",
    });
    for (const c of p.contactos()) {
      p.escribir(c.id);
      alDia(p);
      p.responder(c.id, "si");
    }
    expect(p.roster().faltantes).toEqual([]);
    expect(p.roster().suplentes).toBe(1);
    expect(p.accionPagar?.puestos).toEqual(["arquero", "defensor", "mediocampista", "delantero"]);
    expect(p.accionCerrar).toBeNull();
    expect(p.pagarVacante("delantero").ok).toBe(true);
    expect(p.accionPagar).toBeNull();
    expect(p.accionCerrar?.completa).toBe(true);
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
