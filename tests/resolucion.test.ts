import { describe, expect, it } from "vitest";
import { alDia, Partida } from "../src/core/partida.js";
import { resolver } from "../src/core/resolucion.js";
import { agendaCompleta, CONFIG, contacto, interrupcionSegura, PERFIL, SIN_INTERRUPCIONES } from "./ayudas.js";
import type { DefinicionContacto } from "../src/core/tipos.js";

function partida(agenda: DefinicionContacto[], dineroInicial = PERFIL.dineroInicial, semilla = "res"): Partida {
  return new Partida({
    perfil: { ...PERFIL, dineroInicial },
    agenda,
    interrupciones: SIN_INTERRUPCIONES,
    config: CONFIG,
    semilla,
  });
}

/** Confirma a los primeros `cuantos` contactos de la agenda. */
function confirmar(p: Partida, cuantos: number, opcion = "si"): void {
  for (const c of p.contactos().slice(0, cuantos)) {
    p.escribir(c.id);
    alDia(p);
    p.responder(c.id, opcion);
  }
}

describe("cuándo no hay partido", () => {
  it("con menos de diez no se juega", () => {
    const p = partida(agendaCompleta());
    confirmar(p, 9);
    const r = resolver(p);
    expect(r.hayPartido).toBe(false);
    expect(r.motivoSinPartido).toContain("9/10");
  });

  it("si colapsaste, tampoco", () => {
    const agenda = Array.from({ length: 12 }, (_, i) => contacto(`x${i}`, { alConfirmar: { moral: -100 } }));
    const p = partida(agenda);
    p.escribir("x0");
    alDia(p);
    p.responder("x0", "si");
    expect(p.motivoFin).toBe("moral_agotada");
    expect(resolver(p).hayPartido).toBe(false);
  });

  it("con los diez pero sin plata para la seña, el complejo larga la cancha", () => {
    const agenda = Array.from({ length: 12 }, (_, i) => contacto(`x${i}`, { rol: "mediocampista" }));
    const p = partida(agenda, 0); // nadie aporta y arrancás en cero
    confirmar(p, 10);
    const r = resolver(p);
    expect(r.hayPartido).toBe(false);
    expect(r.motivoSinPartido).toContain("seña");
  });

  it("con los diez y la plata, se juega", () => {
    const p = partida(agendaCompleta());
    confirmar(p, 10);
    expect(resolver(p).hayPartido).toBe(true);
  });
});

describe("la matemática", () => {
  it("el desglose es auditable y suma la probabilidad", () => {
    const p = partida(agendaCompleta());
    confirmar(p, 10);
    const r = resolver(p);
    const suma = r.desglose.reduce((t, d) => t + d.valor, 0);
    expect(r.probabilidad).toBe(Math.min(95, Math.max(5, Math.round(suma))));
    expect(r.desglose[0]?.concepto).toContain("Habilidad promedio");
  });

  it("la probabilidad nunca es 0% ni 100%", () => {
    const malos = Array.from({ length: 12 }, (_, i) =>
      contacto(`x${i}`, { rol: "delantero", habilidad: 1, alConfirmar: { dineroAportado: 1500 } }),
    );
    const p = partida(malos);
    confirmar(p, 10);
    const r = resolver(p);
    expect(r.probabilidad).toBeGreaterThanOrEqual(5);
    expect(r.probabilidad).toBeLessThanOrEqual(95);
  });

  it("un plantel mejor tiene más probabilidad que uno peor", () => {
    const armar = (habilidad: number): Partida => {
      const agenda = agendaCompleta().map((c) => ({ ...c, habilidad }));
      const p = partida(agenda);
      confirmar(p, 10);
      return p;
    };
    expect(resolver(armar(85)).probabilidad).toBeGreaterThan(resolver(armar(35)).probabilidad);
  });

  it("las bajas de último momento se cobran en el desglose", () => {
    const p = partida(agendaCompleta());
    confirmar(p, 11, "apurar"); // todos quedan calientes
    p.esperar(Math.max(1, CONFIG.minutoRevision - p.reloj.minutos));
    alDia(p);
    const r = resolver(p);
    expect(p.bitacora.contar("baja_tardia")).toBeGreaterThan(0);
    if (r.hayPartido) {
      expect(r.desglose.some((d) => d.concepto.includes("baja(s)"))).toBe(true);
    }
  });

  it("el marcador es coherente con el resultado", () => {
    for (const semilla of ["a", "b", "c", "d", "e", "f"]) {
      const p = partida(agendaCompleta(), PERFIL.dineroInicial, semilla);
      confirmar(p, 10);
      const r = resolver(p);
      if (!r.hayPartido) continue;
      if (r.gano) expect(r.golesFavor).toBeGreaterThan(r.golesContra);
      else expect(r.golesFavor).toBeLessThanOrEqual(r.golesContra);
    }
  });
});

describe("narración atribuida", () => {
  it("cada beat sale de algo que el jugador hizo, y el último cuenta el resultado", () => {
    const p = partida(agendaCompleta());
    confirmar(p, 10);
    const r = resolver(p);
    expect(r.narracion.length).toBeGreaterThan(1);
    const ultimo = r.narracion.at(-1)!;
    expect(ultimo.minuto).toBe(40);
    expect(ultimo.texto).toContain(`${r.golesFavor} a ${r.golesContra}`);
  });

  it("apurar a alguien aparece narrado con su nombre", () => {
    const p = partida(agendaCompleta());
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "apurar");
    p.llamar("c0"); // lo baja del umbral para que llegue a jugar
    confirmar(p, 11);
    const r = resolver(p);
    expect(p.bitacora.contar("apuro")).toBeGreaterThan(0);
    const texto = r.narracion.map((b) => b.texto).join(" ");
    expect(texto).toContain("mala gana");
    expect(texto).toContain("c0");
  });

  it("sin arquero, alguien se tiene que poner los guantes", () => {
    const agenda = Array.from({ length: 12 }, (_, i) =>
      contacto(`x${i}`, { rol: "defensor", alConfirmar: { dineroAportado: 1500 } }),
    );
    const p = partida(agenda);
    confirmar(p, 10);
    const r = resolver(p);
    expect(r.narracion.some((b) => b.texto.includes("arco"))).toBe(true);
  });

  it("los beats van en orden cronológico", () => {
    const p = partida(agendaCompleta());
    confirmar(p, 10);
    const minutos = resolver(p).narracion.map((b) => b.minuto);
    expect([...minutos].sort((a, b) => a - b)).toEqual(minutos);
  });

  it("no repite el mismo beat dos veces", () => {
    const p = partida(agendaCompleta());
    confirmar(p, 10);
    const textos = resolver(p).narracion.map((b) => b.texto);
    expect(new Set(textos).size).toBe(textos.length);
  });
});

describe("el relato del partido", () => {
  it("los goles cuadran con el resultado y cuentan cómo va", () => {
    for (const semilla of ["a", "b", "c", "d", "e", "f"]) {
      const p = partida(agendaCompleta(), PERFIL.dineroInicial, semilla);
      confirmar(p, 10);
      const r = resolver(p);
      if (!r.hayPartido) continue;
      const goles = r.narracion.filter((b) => b.gol);
      expect(goles.filter((b) => b.gol === "favor")).toHaveLength(r.golesFavor);
      expect(goles.filter((b) => b.gol === "contra")).toHaveLength(r.golesContra);
      const ultimo = goles.at(-1);
      if (ultimo) expect(ultimo.texto).toContain(`${r.golesFavor} a ${r.golesContra}.`);
    }
  });

  it("la decisión que explica cada momento va aparte, no adentro del texto", () => {
    const p = partida(agendaCompleta());
    p.escribir("c0");
    alDia(p);
    p.responder("c0", "apurar");
    p.llamar("c0");
    confirmar(p, 11);
    const apuro = resolver(p).narracion.find((b) => b.texto.includes("mala gana"));
    expect(apuro?.porque).toMatch(/a las \d\d:\d\d$/);
    expect(apuro?.texto).not.toContain("a las");
  });

  it("una interrupción ignorada no se narra como alguien ni como una pelea", () => {
    // Drenan poco: tienen que quedar ignoradas sin que la moral llegue a cero.
    const cancha = { ...interrupcionSegura("cancha", 1140), de: "Complejo", drenajePorAccion: 0.5, registrarSiIgnorada: "ignorado" as const };
    const grupo = { ...interrupcionSegura("incendio", 1140), de: "El grupo", drenajePorAccion: 0.5, registrarSiIgnorada: "roce" as const };
    const p = new Partida({
      perfil: PERFIL,
      agenda: agendaCompleta(),
      interrupciones: [cancha, grupo],
      config: CONFIG,
      semilla: "ignorar",
    });
    p.esperar(1);
    alDia(p);
    for (let i = 0; i < 4; i++) p.esperar(1);
    confirmar(p, 10);
    const r = resolver(p);
    expect(p.bitacora.contar("ignorado")).toBe(1);
    expect(p.bitacora.contar("roce")).toBeGreaterThan(0);
    const todo = r.narracion.map((b) => `${b.texto} ${b.porque ?? ""}`).join("\n");
    expect(todo).not.toContain("alguien");
    expect(todo).not.toContain("se gritan");
    expect(todo).toContain("No le contestaste a Complejo");
  });
});

describe("determinismo de la resolución", () => {
  it("la misma partida resuelta dos veces da exactamente lo mismo", () => {
    const jugar = (): Partida => {
      const p = partida(agendaCompleta(), PERFIL.dineroInicial, "misma-semilla");
      confirmar(p, 10);
      return p;
    };
    const a = resolver(jugar());
    const b = resolver(jugar());
    expect(a.gano).toBe(b.gano);
    expect(a.probabilidad).toBe(b.probabilidad);
    expect(a.golesFavor).toBe(b.golesFavor);
    expect(a.narracion).toEqual(b.narracion);
  });
});
