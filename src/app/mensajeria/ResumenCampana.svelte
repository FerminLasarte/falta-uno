<!--
  Cómo terminó la campaña, en la app del torneo: por qué quedaste afuera y todas
  tus fechas, una por renglón. Lo único que queda por hacer es empezar otra.
-->
<script lang="ts">
  import { AGUANTE, type Campana, type FinCampana } from "../../core/campana.js";
  import type { Vista } from "../estado/juego.svelte.js";
  import Avatar from "./Avatar.svelte";
  import BotonPrincipal from "./BotonPrincipal.svelte";
  import Cabecera from "./Cabecera.svelte";
  import { pesos } from "./rotulos.js";

  let {
    campana,
    torneo,
    rivalDe,
    alCampanaNueva,
  }: {
    campana: Campana;
    torneo: Vista["torneo"];
    rivalDe: (fecha: number) => string;
    alCampanaNueva: () => void;
  } = $props();

  /** "Dos", "Tres": las cuentas del aguante, en letras, como se dicen. */
  const EN_LETRAS = ["Ninguna", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis"];
  const enLetras = (n: number): string => EN_LETRAS[n] ?? String(n);

  const POR_QUE: Record<FinCampana, { motivo: string; titulo: string; texto: string }> = {
    moral: {
      motivo: "sin moral",
      titulo: "No diste más",
      texto: "Apagaste el teléfono y no lo volviste a prender en toda la noche. El viernes que viene lo arma otro.",
    },
    bancarrota: {
      motivo: "bancarrota",
      titulo: "Quedaron afuera del torneo",
      texto: `${enLetras(AGUANTE.fechasConDeuda)} fechas seguidas debiendo la cancha. El complejo le dio el turno de los viernes a otro equipo.`,
    },
    disolucion: {
      motivo: "disolución",
      titulo: "El equipo se disolvió",
      texto: `${enLetras(AGUANTE.fechasSinPartido)} viernes seguidos sin poder armar el partido. Cada uno se fue a buscar otro equipo.`,
    },
  };

  const fin = $derived(POR_QUE[campana.fin ?? "moral"]);

  const resultado = (j: Campana["jugadas"][number]): string => {
    if (!j.hayPartido) return "No hubo";
    return `${j.gano ? "Ganaron" : "Perdieron"} ${j.golesFavor}–${j.golesContra}`;
  };

  const totales = $derived([
    `${campana.prestigio >= 0 ? "+" : "−"}${Math.abs(campana.prestigio)} prestigio`,
    campana.dinero >= 0 ? `Les quedan ${pesos(campana.dinero)}` : `Deben ${pesos(-campana.dinero)}`,
  ]);
</script>

<div class="pantalla-app">
  <Cabecera titulo={torneo.nombre} subtitulo={torneo.cancha}>
    {#snippet avatar()}
      <Avatar nombre={torneo.nombre} id="torneo" tam={38} />
    {/snippet}
  </Cabecera>

  <section class="hero">
    <small>Fecha {campana.fecha} · {fin.motivo}</small>
    <h1>{fin.titulo}</h1>
    <p>{fin.texto}</p>
  </section>

  <div class="tabla">
    {#each campana.jugadas as j (j.fecha)}
      <div class="fila" class:sin={!j.hayPartido}>
        <span class="n">Fecha {j.fecha}</span>
        <span class="rival">{rivalDe(j.fecha)}</span>
        <span class="r">{resultado(j)}</span>
      </div>
    {/each}
    <p class="totales">{#each totales as t (t)}<span>{t}</span>{/each}</p>
  </div>

  <div class="zona-pulgares">
    <BotonPrincipal accion={{ texto: "Campaña nueva" }} alTocar={alCampanaNueva} />
  </div>
</div>

<style>
  .pantalla-app { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--app-papel); }

  .hero {
    flex: none;
    position: relative;
    z-index: 2;
    padding: 18px var(--e3) 16px;
    background: var(--app-superficie);
    border-bottom: 1px solid var(--app-linea);
    box-shadow: var(--sombra-app);
  }
  .hero small {
    font-size: calc(10.5px * var(--escala-ui));
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--app-tinta-3);
  }
  .hero h1 {
    margin: 4px 0 6px;
    font-family: var(--fuente-cromo);
    font-size: calc(26px * var(--escala-ui));
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .hero p { margin: 0; font-size: calc(13.5px * var(--escala-ui)); line-height: 1.42; color: var(--app-tinta-2); }

  .tabla { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
  .fila {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    align-items: baseline;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--app-superficie);
    font-size: calc(13.5px * var(--escala-ui));
  }
  .fila.sin { background: transparent; border: 1px dashed var(--app-linea); color: var(--app-tinta-2); }
  .n { font-family: var(--fuente-cromo); font-weight: 700; font-size: calc(12px * var(--escala-ui)); color: var(--app-tinta-2); }
  .rival { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .r { font-weight: 700; font-variant-numeric: tabular-nums; }
  .totales {
    margin: 4px 0 0;
    display: flex;
    justify-content: center;
    gap: 16px;
    font-size: calc(12.5px * var(--escala-ui));
    font-weight: 600;
    color: var(--app-tinta-2);
    font-variant-numeric: tabular-nums;
  }

  .zona-pulgares {
    flex: none;
    min-height: var(--zona-pulgares);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 10px;
  }
</style>
