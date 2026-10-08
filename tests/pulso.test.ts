import { describe, expect, it } from "vitest";
import { alDia, Partida } from "../src/core/partida.js";
import { Pulso } from "../src/core/pulso.js";
import {
  agendaCompleta,
  CONFIG,
  contacto,
  interrupcionSegura,
  PERFIL,
  SIN_INTERRUPCIONES,
} from "./ayudas.js";
import type { DefinicionInterrupcion } from "../src/core/interrupciones.js";
import type { DefinicionContacto } from "../src/core/tipos.js";

function nueva(
  agenda: DefinicionContacto[] = agendaCompleta(),
  interrupciones: DefinicionInterrupcion[] = SIN_INTERRUPCIONES,
  semilla = "pulso",
): Partida {
  return new Partida({ perfil: PERFIL, agenda, interrupciones, config: CONFIG, semilla });
}

describe("la cola del pulso", () => {
  it("entrega en orden de llegada y desempata por orden de programación", () => {
    const pulso = new Pulso<string>("orden");
    pulso.tipear("a", "A", "uno", "a1", [100, 100]);
    pulso.tipear("b", "B", "uno", "b1", [100, 100]);
    pulso.tipear("a", "A", "dos", "a2");
    const llegadas: string[] = [];
    for (let p = pulso.tomarHasta(60_000); p; p = pulso.tomarHasta(60_000)) llegadas.push(p.carga);
    expect(llegadas.indexOf("a1")).toBeLessThan(llegadas.indexOf("a2"));
    expect(llegadas).toHaveLength(3);
  });

  it("los mensajes seguidos de la misma persona se tipean de corrido", () => {
    const pulso = new Pulso<number>("corrido");
    pulso.tipear("a", "A", "uno", 1);
    pulso.tipear("a", "A", "dos", 2);
    const primero = pulso.tomarHasta(60_000)!;
    const segundo = pulso.tomarHasta(60_000)!;
    expect(segundo.desdeMs).toBe(primero.enMs);
  });

  it("muestra quién escribe solo después de que terminó de pensar", () => {
    const pulso = new Pulso<number>("tipeo");
    pulso.tipear("a", "A", "hola", 1, [1000, 1000]);
    expect(pulso.escribiendo()).toEqual([]);
    pulso.avanzarHasta(1000);
    expect(pulso.escribiendo()).toEqual([{ chat: "a", de: "A" }]);
  });

  it("no retrocede", () => {
    const pulso = new Pulso<number>("atras");
    pulso.avanzarHasta(500);
    expect(() => pulso.avanzarHasta(100)).toThrow();
  });
});

describe("lo que no llegó no existe para el juego", () => {
  it("después de escribirle, está esperando y no hay nada que contestar", () => {
    const p = nueva();
    p.escribir("c0");
    expect(p.estadoDe("c0").estado).toBe("esperando");
    expect(p.estadoDe("c0").historial).toHaveLength(0);
    expect(p.opcionesDisponibles("c0")).toEqual([]);
    expect(p.enCamino("c0")).toBe(true);
  });

  it("cuando llega la respuesta pasa a hablando y se le puede contestar", () => {
    const p = nueva();
    p.escribir("c0");
    alDia(p);
    expect(p.estadoDe("c0").estado).toBe("hablando");
    expect(p.opcionesDisponibles("c0").length).toBeGreaterThan(0);
  });

  it("una interrupción no drena hasta que llega", () => {
    const p = nueva(agendaCompleta(), [interrupcionSegura("sofi", 1142)]);
    p.escribir("c0");
    expect(p.interrupcionesActivas).toHaveLength(0);
    const moral = p.moral;
    p.esperar(5);
    expect(p.moral).toBe(moral);
    alDia(p);
    expect(p.interrupcionesActivas).toHaveLength(1);
  });

  it("la baja de las 20:30 cuenta cuando llega el mensaje", () => {
    const p = nueva();
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "apurar");
    p.esperar(CONFIG.minutoRevision - p.reloj.minutos);
    expect(p.estadoDe("c0").estado).toBe("confirmado");
    alDia(p);
    expect(p.estadoDe("c0").estado).toBe("bajado");
    expect(p.eventos().at(-1)!.texto).toContain("última revisión");
  });
});

describe("el tiempo real nunca toca recursos", () => {
  it("transcurrir no mueve el reloj del viernes ni la moral", () => {
    const p = nueva(agendaCompleta(), [
      interrupcionSegura("sofi", 1142, [
        { texto: "¿Hola?", segundos: 20 },
        { texto: "Bueno.", segundos: 30 },
      ]),
    ]);
    p.escribir("c0");
    alDia(p);
    const reloj = p.reloj.minutos;
    const moral = p.moral;
    p.transcurrir(10 * 60_000);
    expect(p.reloj.minutos).toBe(reloj);
    expect(p.moral).toBe(moral);
  });

  it("no acepta tiempo negativo ni infinito", () => {
    const p = nueva();
    expect(p.transcurrir(-1).ok).toBe(false);
    expect(p.transcurrir(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(p.transcurrir(Number.NaN).ok).toBe(false);
  });
});

describe("insistencias", () => {
  const sofi = (): DefinicionInterrupcion =>
    interrupcionSegura("sofi", 1142, [
      { texto: "¿Hola?", segundos: 20 },
      { texto: "Bueno, veo que no.", segundos: 30 },
    ]);
  const deSofi = (p: Partida): string[] =>
    p.eventos().filter((e) => e.chat === "sofi").map((e) => e.texto);

  it("si la dejás esperando, se apilan en su chat", () => {
    const p = nueva(agendaCompleta(), [sofi()]);
    p.escribir("c0");
    alDia(p);
    expect(deSofi(p)).toEqual([sofi().texto, "¿Hola?", "Bueno, veo que no."]);
  });

  it("atenderla corta lo que venía en camino", () => {
    const p = nueva(agendaCompleta(), [sofi()]);
    p.escribir("c0");
    for (let i = 0; i < 100 && p.interrupcionesActivas.length === 0; i++) p.transcurrir(100);
    p.atender("sofi");
    alDia(p);
    expect(deSofi(p)).not.toContain("¿Hola?");
  });
});

describe("determinismo con dos relojes", () => {
  /** Un viernes corto, con el tiempo real entrando de a pedazos de `paso` ms. */
  const jugar = (paso: number): Partida => {
    const p = nueva(
      [contacto("largo", { mensajes: ["Uno", "Dos más largo que el primero", "Tres"] }), ...agendaCompleta()],
      [interrupcionSegura("sofi", 1145, [{ texto: "¿Hola?", segundos: 15 }])],
      "determinismo",
    );
    const real = (ms: number): void => {
      for (let t = 0; t < ms; t += paso) p.transcurrir(Math.min(paso, ms - t));
    };
    p.escribir("largo");
    real(12_000);
    p.responder("largo", "si");
    p.escribir("c1");
    real(8_000);
    p.responder("c1", "apurar");
    real(30_000);
    p.esperar(10);
    return p;
  };

  it("la misma semilla y los mismos comandos dan la misma partida", () => {
    expect(jugar(250).eventos()).toEqual(jugar(250).eventos());
  });

  it("el mismo tiempo real da lo mismo entre en pedazos de 16 ms o de 1 s", () => {
    const fino = jugar(16);
    const grueso = jugar(1000);
    expect(fino.moral).toBe(grueso.moral);
    expect(fino.reloj.minutos).toBe(grueso.reloj.minutos);
    expect(fino.eventos()).toEqual(grueso.eventos());
  });
});
