import { describe, expect, it } from "vitest";
import { cargarContenido } from "../src/datos/cargar.js";
import { Partida, type OpcionesPartida } from "../src/core/partida.js";
import { agendaDe } from "../src/core/perfiles.js";
import { FORMATO_GUARDADO, huella, leerGuardado, Registro, type Guardado, type Paso } from "../src/core/registro.js";
import { resolver } from "../src/core/resolucion.js";
import { Rng } from "../src/core/rng.js";
import { agendaCompleta, CONFIG, PERFIL, SIN_INTERRUPCIONES } from "./ayudas.js";

const contenido = await cargarContenido();

/** Como arma el viernes el juego: la agenda del perfil y la charla con la cancha. */
function opcionesReales(semilla: string, indice = 0): OpcionesPartida {
  const perfil = contenido.perfiles[indice]!;
  return {
    perfil,
    agenda: agendaDe(perfil, contenido.perfiles, contenido.contactos),
    interrupciones: contenido.interrupciones,
    grupo: contenido.grupo,
    config: contenido.config,
    inscripcion: contenido.inscripcion,
    semilla,
  };
}

function nueva(): Registro {
  return new Registro(
    new Partida({ perfil: PERFIL, agenda: agendaCompleta(), interrupciones: SIN_INTERRUPCIONES, config: CONFIG, semilla: "reg" }),
  );
}

/**
 * Lo próximo que haría alguien jugando de verdad: casi siempre deja pasar el
 * tiempo real de a latidos, y cada tanto toca algo de lo que tiene a mano.
 */
function proximoPaso(p: Partida, rng: Rng): Paso {
  if (!rng.ocurre(6)) return ["t", rng.entero(60, 250)];
  const posibles: Paso[] = [];
  for (const c of p.contactos()) {
    if (c.estado === "sin_contactar") posibles.push(["escribir", c.id]);
    for (const o of c.opciones) posibles.push(["responder", c.id, o.id]);
    if (c.estado === "hablando" && rng.ocurre(10)) posibles.push(["llamar", c.id]);
  }
  for (const i of p.interrupcionesActivas) posibles.push(["atender", i.definicion.id]);
  for (const a of p.audiosSinEscuchar()) posibles.push(["escuchar", a.id]);
  if (p.accionCalmar) posibles.push(["calmar"]);
  const hueco = p.roster().faltantes[0];
  if (hueco && rng.ocurre(5)) posibles.push(["pagar", hueco.rol]);
  if (rng.ocurre(3)) posibles.push(["esperar", rng.entero(1, 5)]);
  return posibles.length > 0 ? rng.elegir(posibles) : ["t", rng.entero(60, 250)];
}

/** Todo lo que la vista puede ver de una partida, más cómo termina. */
function foto(p: Partida): unknown {
  return {
    eventos: p.eventos(),
    moral: p.moral,
    dinero: p.dinero,
    reloj: p.reloj.minutos,
    terminada: p.terminada,
    lista: p.lista(),
    contactos: p.contactos(),
    escribiendo: p.escribiendo(),
    proxima: p.msHastaProximaEntrega(),
    bitacora: p.bitacora.todas(),
    resolucion: p.terminada ? resolver(p) : null,
  };
}

function guardarYCargar(registro: Registro, opciones: OpcionesPartida): Registro {
  const guardado: Guardado = {
    formato: FORMATO_GUARDADO,
    viernes: { perfil: opciones.perfil.id, semilla: String(opciones.semilla), contenido: "x", pasos: registro.pasos },
  };
  const leido = leerGuardado(JSON.stringify(guardado));
  expect(leido).not.toBeNull();
  const { registro: retomado, aplicados } = Registro.reproducir(opciones, leido!.viernes.pasos);
  expect(aplicados).toBe(registro.pasos.length);
  return retomado;
}

describe("el registro", () => {
  it("anota el tiempo real seguido como un solo paso", () => {
    const r = nueva();
    r.hacer(["t", 100]);
    r.hacer(["t", 150]);
    r.hacer(["t", 0]);
    r.hacer(["escribir", "c0"]);
    r.hacer(["t", 80]);
    expect(r.pasos).toEqual([["t", 250], ["escribir", "c0"], ["t", 80]]);
  });

  it("no anota lo que falló, porque no cambió nada", () => {
    const r = nueva();
    expect(r.hacer(["escribir", "c0"]).ok).toBe(true);
    expect(r.hacer(["escribir", "c0"]).ok).toBe(false);
    expect(r.hacer(["atender", "nadie"]).ok).toBe(false);
    expect(r.pasos).toEqual([["escribir", "c0"]]);
  });

  it("no acepta tiempo real con decimales: sumado en otro orden podría no dar lo mismo", () => {
    const r = nueva();
    expect(r.hacer(["t", 100.5]).ok).toBe(false);
    expect(r.pasos).toEqual([]);
    expect(r.partida.msHastaProximaEntrega()).toBeNull();
  });
});

// La promesa del guardado: cortar un viernes en cualquier punto, guardarlo,
// cargarlo y seguir jugando da exactamente lo mismo que no haberlo cortado.
describe("retomar un viernes guardado", () => {
  it("da la misma partida que jugarla de un tirón, cortando en cualquier punto", () => {
    let pasosEnVivo = 0;
    let pasosGuardados = 0;
    for (let s = 0; s < 40; s++) {
      const opciones = opcionesReales(`retomar-${s}`, s % 3);
      const rng = new Rng(`jugador-${s}`);
      const corte = rng.entero(20, 1500);

      // De un tirón, anotando cada paso tal como ocurrió.
      const vivo = new Registro(new Partida(opciones));
      const jugados: Paso[] = [];
      for (let i = 0; i < 3000 && !vivo.partida.terminada; i++) {
        const paso = proximoPaso(vivo.partida, rng);
        if (vivo.hacer(paso).ok) jugados.push(paso);
      }

      // Con un corte: hasta ahí, guardar, cargar y seguir con lo mismo.
      const antes = new Registro(new Partida(opciones));
      for (const paso of jugados.slice(0, corte)) antes.hacer(paso);
      const despues = guardarYCargar(antes, opciones);
      for (const paso of jugados.slice(corte)) despues.hacer(paso);

      expect(foto(despues.partida), `semilla ${s}, corte en ${corte}`).toEqual(foto(vivo.partida));
      pasosEnVivo += jugados.length;
      pasosGuardados += vivo.pasos.length;
    }
    // Un guardado chico: el tiempo real seguido se junta en un paso.
    expect(pasosGuardados).toBeLessThan(pasosEnVivo / 5);
  });

  it("si el contenido cambió, retoma hasta el primer paso que ya no existe", () => {
    const opciones = opcionesReales("cambio");
    const r = new Registro(new Partida(opciones));
    const [primero, segundo] = opciones.agenda;
    r.hacer(["escribir", primero!.id]);
    r.hacer(["t", 60_000]);
    r.hacer(["escribir", segundo!.id]);
    r.hacer(["t", 60_000]);

    // Una actualización saca al segundo contacto de la agenda.
    const otraAgenda = { ...opciones, agenda: opciones.agenda.filter((c) => c.id !== segundo!.id) };
    const { registro, aplicados } = Registro.reproducir(otraAgenda, r.pasos);
    expect(aplicados).toBe(2);
    expect(registro.pasos).toEqual(r.pasos.slice(0, 2));
    expect(registro.hacer(["t", 100]).ok).toBe(true);
  });

  it("si un paso ya no tiene sentido sin explotar, retoma hasta ahí", () => {
    const opciones = opcionesReales("cambio");
    const r = new Registro(new Partida(opciones));
    r.hacer(["t", 500]);
    // Un audio que con el contenido nuevo no existe: el núcleo lo rechaza.
    const pasos: Paso[] = [...r.pasos, ["escuchar", "audio_que_ya_no_esta"], ["t", 100]];
    const { aplicados } = Registro.reproducir(opciones, pasos);
    expect(aplicados).toBe(1);
  });
});

describe("el archivo", () => {
  const valido: Guardado = {
    formato: FORMATO_GUARDADO,
    viernes: { perfil: "oficinista", semilla: "s", contenido: "abc", pasos: [["t", 10], ["pagar", "arquero"], ["calmar"]] },
    vista: { pantalla: { tipo: "grupo" } },
  };

  it("se lee tal como se escribió", () => {
    expect(leerGuardado(JSON.stringify(valido))).toEqual(valido);
  });

  it("si está roto, no hay guardado: el juego arranca de cero", () => {
    const con = (cambio: object): string => JSON.stringify({ ...valido, ...cambio });
    const viernes = (pasos: unknown[]): string => con({ viernes: { ...valido.viernes, pasos } });
    expect(leerGuardado("")).toBeNull();
    expect(leerGuardado("{nada")).toBeNull();
    expect(leerGuardado("null")).toBeNull();
    expect(leerGuardado(con({ formato: 99 }))).toBeNull();
    expect(leerGuardado(con({ viernes: { ...valido.viernes, semilla: 4 } }))).toBeNull();
    expect(leerGuardado(viernes([["t", 1.5]]))).toBeNull();
    expect(leerGuardado(viernes([["t", -1]]))).toBeNull();
    expect(leerGuardado(viernes([["volar", "x"]]))).toBeNull();
    expect(leerGuardado(viernes([["pagar", "libero"]]))).toBeNull();
    expect(leerGuardado(viernes([["responder", "x"]]))).toBeNull();
  });

  it("la huella cambia si cambia el contenido", () => {
    const texto = JSON.stringify(contenido);
    expect(huella(texto)).toBe(huella(texto));
    expect(huella(texto)).not.toBe(huella(texto.replace("Carlos", "Karlos")));
    expect(huella(texto)).toMatch(/^[0-9a-f]{8}$/);
  });
});
