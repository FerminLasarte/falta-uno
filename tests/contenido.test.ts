import { describe, expect, it } from "vitest";
import { cargarContenido } from "../src/datos/cargar.js";
import { revisarGrafo, revisarGrupo } from "../src/datos/validar.js";
import { contactoSchema, grupoSchema } from "../src/datos/esquema.js";
import type { DefinicionGrupo } from "../src/core/grupo.js";
import { alDia, Partida } from "../src/core/partida.js";
import { agendaDe } from "../src/core/perfiles.js";
import { resolver } from "../src/core/resolucion.js";
import type { DefinicionContacto } from "../src/core/tipos.js";

const contenido = await cargarContenido();

describe("el contenido real carga y valida", () => {
  it("carga todo sin problemas", () => {
    expect(contenido.contactos.length).toBeGreaterThan(0);
    expect(contenido.perfiles).toHaveLength(3);
    expect(contenido.interrupciones.length).toBeGreaterThan(0);
  });

  it("hay más contactos que lugares: el jugador puede fallar y seguir", () => {
    expect(contenido.contactos.length).toBeGreaterThan(contenido.config.jugadoresNecesarios);
  });

  it("hay al menos un arquero en la agenda", () => {
    expect(contenido.contactos.some((c) => c.rol === "arquero")).toBe(true);
  });

  it("el contacto único de cada perfil existe de verdad", () => {
    const ids = new Set(contenido.contactos.map((c) => c.id));
    for (const perfil of contenido.perfiles) {
      expect(ids.has(perfil.contactoUnico), `${perfil.id} → ${perfil.contactoUnico}`).toBe(true);
    }
  });

  it("la revisión de bajas cae dentro del viernes", () => {
    expect(contenido.config.minutoRevision).toBeGreaterThan(contenido.config.horaInicio);
    expect(contenido.config.minutoRevision).toBeLessThan(contenido.config.horaCorte);
  });
});

// El compromiso del diseño: un link roto rompe el build, no la partida.
describe("el validador atrapa contenido roto", () => {
  const base: DefinicionContacto = {
    id: "roto",
    nombre: "Roto",
    rol: "defensor",
    habilidad: 50,
    rasgos: [],
    probabilidadBajaInicial: 0,
    nodoInicial: "abre",
    nodos: {
      abre: {
        mensajes: ["hola"],
        opciones: [
          { id: "si", texto: "dale", costoReloj: 2, efectos: { estado: "confirmado" }, siguiente: null },
        ],
      },
    },
  };

  it("acepta un contacto sano", () => {
    expect(revisarGrafo(base, "roto.json")).toEqual([]);
  });

  it("detecta una opción que apunta a un nodo inexistente", () => {
    const roto: DefinicionContacto = {
      ...base,
      nodos: {
        abre: {
          mensajes: ["hola"],
          opciones: [
            { id: "si", texto: "dale", costoReloj: 2, efectos: { estado: "confirmado" }, siguiente: "fantasma" },
          ],
        },
      },
    };
    const problemas = revisarGrafo(roto, "roto.json");
    expect(problemas.some((p) => p.detalle.includes("fantasma"))).toBe(true);
  });

  it("detecta un nodoInicial que no existe", () => {
    const roto: DefinicionContacto = { ...base, nodoInicial: "no_existe" };
    expect(revisarGrafo(roto, "roto.json").some((p) => p.detalle.includes("nodoInicial"))).toBe(true);
  });

  it("detecta nodos inalcanzables", () => {
    const roto: DefinicionContacto = {
      ...base,
      nodos: {
        ...base.nodos,
        huerfano: { mensajes: ["nadie llega acá"], opciones: [] },
      },
    };
    expect(revisarGrafo(roto, "roto.json").some((p) => p.detalle.includes("inalcanzable"))).toBe(true);
  });

  it("detecta ids de opción duplicados dentro de un nodo", () => {
    const roto: DefinicionContacto = {
      ...base,
      nodos: {
        abre: {
          mensajes: ["hola"],
          opciones: [
            { id: "si", texto: "a", costoReloj: 2, efectos: { estado: "confirmado" }, siguiente: null },
            { id: "si", texto: "b", costoReloj: 2, efectos: { estado: "rechazado" }, siguiente: null },
          ],
        },
      },
    };
    expect(revisarGrafo(roto, "roto.json").some((p) => p.detalle.includes("duplicada"))).toBe(true);
  });

  it("detecta un contacto al que es imposible decirle que sí", () => {
    const roto: DefinicionContacto = {
      ...base,
      nodos: {
        abre: {
          mensajes: ["hola"],
          opciones: [
            { id: "no", texto: "nada", costoReloj: 1, efectos: { estado: "rechazado" }, siguiente: null },
          ],
        },
      },
    };
    expect(revisarGrafo(roto, "roto.json").some((p) => p.detalle.includes("confirmado"))).toBe(true);
  });

  it("el schema rechaza campos que no existen en vez de ignorarlos", () => {
    const conBasura = { ...base, poderesMagicos: true };
    expect(contactoSchema.safeParse(conBasura).success).toBe(false);
  });

  it("el schema rechaza un rol inventado", () => {
    expect(contactoSchema.safeParse({ ...base, rol: "enganche" }).success).toBe(false);
  });
});

describe("un viernes completo con el contenido real", () => {
  it("se puede jugar de punta a punta y resolver", () => {
    const perfil = contenido.perfiles[1]!; // el pibe de barrio: el caso apretado
    const partida = new Partida({
      perfil,
      agenda: agendaDe(perfil, contenido.perfiles, contenido.contactos),
      interrupciones: contenido.interrupciones,
      grupo: contenido.grupo,
      config: contenido.config,
      semilla: "viernes-real",
    });

    // Estrategia simple: escribirle a todos y tomar la primera opción que confirme.
    for (const c of partida.contactos()) {
      if (partida.terminada) break;
      partida.escribir(c.id);
      alDia(partida);
      for (let paso = 0; paso < 4 && !partida.terminada; paso++) {
        const opciones = partida.opcionesDisponibles(c.id);
        if (opciones.length === 0) break;
        const confirma = opciones.find((o) => o.efectos.estado === "confirmado");
        const avanza = opciones.find((o) => o.siguiente !== null && o.efectos.estado === undefined);
        const elegida = confirma ?? avanza ?? opciones[0]!;
        partida.responder(c.id, elegida.id);
        alDia(partida);
      }
    }

    expect(partida.eventos().length).toBeGreaterThan(10);
    const r = resolver(partida);
    expect(typeof r.hayPartido).toBe("boolean");
    if (r.hayPartido) {
      expect(r.narracion.length).toBeGreaterThan(0);
      expect(r.probabilidad).toBeGreaterThanOrEqual(5);
    }
  });

  it.each(contenido.perfiles.map((p) => [p.nombre, p] as const))("%s puede llegar a diez", (_, perfil) => {
    const partida = new Partida({
      perfil,
      agenda: agendaDe(perfil, contenido.perfiles, contenido.contactos),
      interrupciones: [],
      config: contenido.config,
      semilla: "optimo",
    });
    for (const c of partida.contactos()) {
      if (partida.terminada) break;
      partida.escribir(c.id);
      alDia(partida);
      for (let paso = 0; paso < 4 && !partida.terminada; paso++) {
        const opciones = partida.opcionesDisponibles(c.id);
        if (opciones.length === 0) break;
        const confirma = opciones.find((o) => o.efectos.estado === "confirmado");
        const avanza = opciones.find((o) => o.siguiente !== null && o.efectos.estado === undefined);
        if (!confirma && !avanza) break;
        partida.responder(c.id, (confirma ?? avanza)!.id);
        alDia(partida);
      }
    }
    expect(partida.roster().confirmados).toBeGreaterThanOrEqual(contenido.config.jugadoresNecesarios);
  });
});

describe("el validador atrapa un grupo mal escrito", () => {
  const sano = contenido.grupo;
  const problemas = (grupo: DefinicionGrupo): string[] =>
    revisarGrupo(grupo, contenido.contactos, contenido.config).map((p) => p.detalle);
  const charla = (de: string, extra: Partial<DefinicionGrupo["charlas"][number]> = {}) => ({
    id: "prueba",
    cuando: { desde: 1150, hasta: 1160 },
    mensajes: [{ de, texto: "Hola" }],
    ...extra,
  });

  it("el grupo real no tiene problemas", () => {
    expect(problemas(sano)).toEqual([]);
  });

  it("detecta a alguien que habla y no está en la agenda", () => {
    expect(problemas({ ...sano, charlas: [charla("el_fantasma")] }).join()).toContain("el_fantasma");
  });

  it("detecta un audio con id repetido", () => {
    const audio = { id: "repetido", segundos: 10, transcripcion: "Hola" };
    const conAudio = (id: string) => ({ ...charla("juanma"), id, mensajes: [{ de: "juanma", audio }] });
    expect(problemas({ ...sano, charlas: [conAudio("uno"), conAudio("dos")] }).join()).toContain("repetido");
  });

  it("detecta una franja que cae fuera del viernes", () => {
    expect(problemas({ ...sano, charlas: [charla("juanma", { cuando: { desde: 1300, hasta: 1310 } })] }).join()).toContain(
      "fuera del viernes",
    );
  });

  it("detecta un roce entre rasgos que nunca se pelean", () => {
    const roce = { entre: ["capitan", "habilidoso"] as const, mensajes: [{ de: "a", texto: "Hola" }] };
    expect(problemas({ ...sano, roces: [roce] }).join()).toContain("no se pelean nunca");
  });

  it("detecta una respuesta que pide escuchar un audio que no existe", () => {
    const sinAudios = { ...sano, charlas: sano.charlas.filter((c) => c.mensajes.every((m) => !m.audio)) };
    expect(problemas(sinAudios).join()).toContain("zenon_rodilla");
  });

  it("el schema no deja un mensaje con texto y audio a la vez, ni un roce con alguien que no es a o b", () => {
    const audio = { id: "x", segundos: 10, transcripcion: "Hola" };
    const doble = { ...sano, charlas: [{ ...charla("juanma"), mensajes: [{ de: "juanma", texto: "Hola", audio }] }] };
    expect(grupoSchema.safeParse(doble).success).toBe(false);
    const tercero = { ...sano, roces: [{ entre: ["rustico", "habilidoso"], mensajes: [{ de: "c", texto: "Hola" }] }] };
    expect(grupoSchema.safeParse(tercero).success).toBe(false);
  });
});
