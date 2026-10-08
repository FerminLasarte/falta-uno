<!--
  Un chat privado, con un contacto o con alguien que te interrumpe. Arriba la
  franja de la lista, que no se pierde nunca. Abajo, lo que podés hacer, cada
  cosa con su costo en minutos antes de elegirla: lo que provoca queda oculto.
  Las respuestas quedan por encima de los pulgares; los gestos, como cerrar el
  chat, van aparte, centrados y apagados.

  Antes de que haya lista (la charla con la cancha donde se elige el perfil) no
  hay franja, y las respuestas dicen qué implican en vez de cuánto cuestan.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { EventoFeed, VistaRoster } from "../../core/partida.js";
  import Charla from "./Charla.svelte";
  import Franja from "./Franja.svelte";
  import { esGesto, sinCorchetes, type AccionChat, type RespuestaChat } from "./rotulos.js";

  let {
    eventos,
    escribiendo = null,
    opciones = [],
    principal = null,
    nota = null,
    franja = null,
    cabecera,
    alElegir,
    alPrincipal,
  }: {
    eventos: readonly EventoFeed[];
    escribiendo?: string | null;
    /** Respuestas del árbol de diálogo. */
    opciones?: readonly RespuestaChat[];
    /** Una sola acción grande en vez de respuestas: escribirle, atender. */
    principal?: AccionChat | null;
    /** Una aclaración entre los pulgares: qué pasó, o qué implica elegir. */
    nota?: string | null;
    /** La lista en un renglón. Sin lista todavía, no hay franja. */
    franja?: { roster: VistaRoster; dinero: number; sena: number; alVerLista: () => void } | null;
    cabecera: Snippet;
    alElegir?: (opcionId: string) => void;
    alPrincipal?: () => void;
  } = $props();

  const respuestas = $derived(opciones.filter((o) => !esGesto(o.texto)));
  const gestos = $derived(opciones.filter((o) => esGesto(o.texto)));
</script>

<div class="pantalla-app">
  {@render cabecera()}
  {#if franja}
    <Franja roster={franja.roster} dinero={franja.dinero} sena={franja.sena} alTocar={franja.alVerLista} />
  {/if}
  <Charla {eventos} {escribiendo} />

  <div class="pie">
    {#if respuestas.length > 0}
      <div class="respuestas" role="group" aria-label="Responder">
        <span class="rotulo">Responder</span>
        {#each respuestas as o (o.id)}
          <button class="opcion" class:con-detalle={o.detalle} onclick={() => alElegir?.(o.id)}>
            <span>{o.texto}</span>
            {#if o.costoReloj !== undefined}<span class="costo">{o.costoReloj} min</span>{/if}
            {#if o.detalle}<span class="detalle"><b>{o.detalle.titulo}</b> · {o.detalle.texto}</span>{/if}
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
      {#if nota && !principal}
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
  .opcion.con-detalle { flex-direction: column; gap: 2px; }
  .detalle { font-size: var(--t-micro); font-weight: 600; line-height: 1.35; color: var(--app-tinta-3); }
  .detalle b { font-weight: 700; color: var(--app-tinta-2); }
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
  .nota { font-size: var(--t-meta); color: var(--app-tinta-3); text-align: center; max-width: 74%; }
</style>
