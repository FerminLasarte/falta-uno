<!--
  Un chat privado, con un contacto o con alguien que te interrumpe. Arriba la
  franja de la lista, que no se pierde nunca. Abajo, lo que podés hacer, cada
  cosa con su costo en minutos antes de elegirla: lo que provoca queda oculto.
  Las respuestas quedan por encima de los pulgares; los gestos, como cerrar el
  chat, van aparte, centrados y apagados.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { EventoFeed, VistaOpcion, VistaRoster } from "../../core/partida.js";
  import Charla from "./Charla.svelte";
  import Franja from "./Franja.svelte";
  import { esGesto, sinCorchetes, type AccionChat } from "./rotulos.js";

  let {
    eventos,
    opciones = [],
    principal = null,
    nota = null,
    roster,
    dinero,
    sena,
    cabecera,
    alElegir,
    alPrincipal,
    alVerLista,
  }: {
    eventos: readonly EventoFeed[];
    /** Respuestas del árbol de diálogo. */
    opciones?: readonly VistaOpcion[];
    /** Una sola acción grande en vez de respuestas: escribirle, atender. */
    principal?: AccionChat | null;
    /** Cuando no queda nada por hacer, qué pasó. */
    nota?: string | null;
    roster: VistaRoster;
    dinero: number;
    sena: number;
    cabecera: Snippet;
    alElegir?: (opcionId: string) => void;
    alPrincipal?: () => void;
    alVerLista: () => void;
  } = $props();

  const respuestas = $derived(opciones.filter((o) => !esGesto(o.texto)));
  const gestos = $derived(opciones.filter((o) => esGesto(o.texto)));
</script>

<div class="pantalla-app">
  {@render cabecera()}
  <Franja {roster} {dinero} {sena} alTocar={alVerLista} />
  <Charla {eventos} />

  <div class="pie">
    {#if respuestas.length > 0}
      <div class="respuestas" role="group" aria-label="Responder">
        <span class="rotulo">Responder</span>
        {#each respuestas as o (o.id)}
          <button class="opcion" onclick={() => alElegir?.(o.id)}>
            <span>{o.texto}</span><span class="costo">{o.costoReloj} min</span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="zona-pulgares">
      {#if principal}
        <button class="principal" onclick={alPrincipal}>
          {principal.texto} <span class="costo">{principal.minutos} min</span>
        </button>
      {/if}
      {#each gestos as g (g.id)}
        <button class="gesto" onclick={() => alElegir?.(g.id)}>{sinCorchetes(g.texto)} · {g.costoReloj} min</button>
      {/each}
      {#if nota && !principal && opciones.length === 0}
        <span class="nota">{nota}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .pantalla-app { flex: 1; min-height: 0; display: flex; flex-direction: column; }

  .pie { flex: none; background: var(--app-papel); }

  .respuestas { display: grid; gap: 6px; padding: 4px 12px 0; }
  .rotulo {
    padding: 0 4px;
    font-size: calc(10.5px * var(--escala-ui));
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--app-tinta-3);
  }
  .opcion {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 9px 12px;
    border-radius: 12px;
    background: var(--app-superficie);
    border: 1px solid var(--app-linea);
    font-size: calc(14px * var(--escala-ui));
    line-height: 1.35;
  }
  .opcion:hover { background: var(--app-hover); }
  .opcion span:first-child { flex: 1; }
  .costo {
    flex: none;
    padding-top: 1px;
    font-size: var(--t-micro);
    font-weight: 600;
    color: var(--app-tinta-3);
    font-variant-numeric: tabular-nums;
  }

  /* Lo que vive en la franja de los pulgares va centrado, entre los dos dedos. */
  .zona-pulgares {
    min-height: var(--zona-pulgares);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding-top: 10px;
  }
  .principal {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radio-chip);
    background: var(--app-cromo);
    color: #FFFFFF;
    font-size: var(--t-meta);
    font-weight: 600;
  }
  .principal .costo { color: rgb(255 255 255 / 60%); }
  .gesto { font-size: calc(12.5px * var(--escala-ui)); font-weight: 600; color: var(--app-tinta-3); }
  .nota { font-size: var(--t-meta); color: var(--app-tinta-3); }
</style>
