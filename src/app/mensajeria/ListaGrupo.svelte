<!--
  La lista del partido, fijada arriba del grupo. Es el HUD del juego con la forma
  que tiene en cualquier grupo de fútbol: numerada, con los que ya están, los que
  están en duda y los huecos que faltan llenar. Siempre a la vista, sin tocar nada.
-->
<script lang="ts">
  import type { VistaPuesto, VistaRoster } from "../../core/partida.js";
  import type { Rol } from "../../core/tipos.js";
  import Faltantes from "./Faltantes.svelte";
  import { pesos, ROL_CORTO } from "./rotulos.js";

  let {
    lista,
    enDuda,
    roster,
    dinero,
    sena,
    titulo,
    alAbrir,
  }: {
    lista: readonly VistaPuesto[];
    /** Los que están hablando con vos: van con signo de pregunta después de los confirmados. */
    enDuda: readonly { id: string; nombre: string; rol: Rol }[];
    roster: VistaRoster;
    dinero: number;
    sena: number;
    titulo: string;
    alAbrir: (id: string) => void;
  } = $props();

  type Renglon =
    | { tipo: "confirmado"; id: string; nombre: string; rol: Rol; relleno: boolean }
    | { tipo: "duda"; id: string; nombre: string; rol: Rol }
    | { tipo: "vacio" };

  const renglones = $derived.by((): Renglon[] => {
    const filas: Renglon[] = lista.map((p) => ({ tipo: "confirmado", ...p }));
    for (const d of enDuda) {
      if (filas.length >= roster.necesarios) break;
      filas.push({ tipo: "duda", ...d });
    }
    while (filas.length < roster.necesarios) filas.push({ tipo: "vacio" });
    return filas;
  });

  const alcanza = $derived(dinero >= sena);
</script>

<section class="lista" aria-label="Lista del partido">
  <div class="cab">
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15.5 3.5l5 5-2.3.8-3.6 3.6.4 4.2-1.4 1.4-3.9-3.9-4.6 4.6-1-1 4.6-4.6-3.9-3.9 1.4-1.4 4.2.4 3.6-3.6z" />
    </svg>
    <span class="que">{titulo}</span>
    <span class="n">{roster.confirmados}<small>/{roster.necesarios}</small></span>
  </div>

  <ol class="puestos" style:--filas={Math.ceil(renglones.length / 2)}>
    {#each renglones as r, i (i)}
      <li class={r.tipo}>
        <span class="num">{i + 1}.</span>
        {#if r.tipo === "vacio"}
          <span class="quien"></span>
        {:else if r.tipo === "confirmado" && r.relleno}
          <span class="quien">{r.nombre}</span>
          <span class="rol">{ROL_CORTO[r.rol]}</span>
          <span class="marca ok" aria-label="pagado">$</span>
        {:else}
          <button class="quien" onclick={() => alAbrir(r.id)}>{r.nombre}</button>
          <span class="rol">{ROL_CORTO[r.rol]}</span>
          {#if r.tipo === "confirmado"}
            <span class="marca ok" aria-label="confirmado">✓</span>
          {:else}
            <span class="marca duda" aria-label="en duda">?</span>
          {/if}
        {/if}
      </li>
    {/each}
  </ol>

  <div class="pie">
    {#if roster.faltantes.length === 0}
      <span class="completa">Están los {roster.necesarios}</span>
    {:else}
      <Faltantes faltantes={roster.faltantes} />
    {/if}
    <span class="sena" class:corta={!alcanza}>
      Seña {pesos(dinero)} de {pesos(sena)}
    </span>
  </div>
</section>

<style>
  .lista {
    flex: none;
    position: relative;
    z-index: 2;
    padding: 10px var(--e3) 11px;
    background: var(--app-superficie);
    border-bottom: 1px solid var(--app-linea);
    box-shadow: var(--sombra-app);
  }

  .cab { display: flex; align-items: center; gap: 6px; }
  .cab svg { flex: none; width: 12px; height: 12px; color: var(--app-tinta-3); }
  .que {
    flex: 1;
    min-width: 0;
    font-size: var(--t-micro);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--app-tinta-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .n {
    font-family: var(--fuente-cromo);
    font-size: calc(15px * var(--escala-ui));
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .n small { font-size: calc(12px * var(--escala-ui)); font-weight: 600; color: var(--app-tinta-3); }

  /* Dos columnas que se llenan de arriba abajo: 1 a 5, después 6 a 10. Si se anotan de más, crecen las dos. */
  .puestos {
    margin: 7px 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: repeat(var(--filas), auto);
    grid-auto-flow: column;
    column-gap: 14px;
    row-gap: 1px;
  }
  .puestos li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    font-size: calc(13.5px * var(--escala-ui));
    line-height: 1.55;
  }
  .num {
    flex: none;
    width: 18px;
    text-align: right;
    font-size: calc(12.5px * var(--escala-ui));
    color: var(--app-tinta-3);
    font-variant-numeric: tabular-nums;
  }
  .quien {
    flex: 1;
    min-width: 0;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .vacio .quien {
    align-self: center;
    height: 1.1em;
    border-bottom: 1px dashed var(--app-linea);
    border-bottom-color: color-mix(in oklab, var(--app-tinta-3) 45%, transparent);
  }
  .rol {
    flex: none;
    font-size: calc(10px * var(--escala-ui));
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--app-tinta-3);
  }
  .marca { flex: none; font-size: calc(12px * var(--escala-ui)); font-weight: 700; }
  .ok { color: var(--est-confirmado); }
  .duda { color: var(--est-hablando); }

  .pie { margin-top: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .completa { font-size: var(--t-meta); font-weight: 600; color: var(--est-confirmado); }
  .sena {
    margin-left: auto;
    font-size: calc(11.5px * var(--escala-ui));
    color: var(--app-tinta-3);
    font-variant-numeric: tabular-nums;
  }
  .sena.corta { color: var(--est-rechazado); }
</style>
