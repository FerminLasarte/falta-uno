<!--
  Una conversación: burbujas tuyas y de los demás, y los avisos del sistema como
  píldoras al centro. No sabe de qué chat se trata: recibe los eventos ya
  filtrados. Los mensajes seguidos de la misma persona se agrupan, como en una
  app de verdad, y siempre se ve lo último que llegó.
-->
<script lang="ts">
  import type { EventoFeed } from "../../core/partida.js";
  import { formatearHora } from "../../core/tiempo.js";

  let {
    eventos,
    mostrarNombres = false,
    colorDe = () => null,
  }: {
    eventos: readonly EventoFeed[];
    /** En el grupo hay que saber quién habla; en un chat privado sobra. */
    mostrarNombres?: boolean;
    /** El color del nombre de cada uno según su estado. */
    colorDe?: (nombre: string) => string | null;
  } = $props();

  type Item =
    | { tipo: "burbuja"; propio: boolean; de: string; texto: string; minuto: number; sigue: boolean }
    | { tipo: "aviso"; alerta: boolean; texto: string };

  const items = $derived.by((): Item[] => {
    const salida: Item[] = [];
    let anterior: string | null = null;
    for (const e of eventos) {
      const propio = e.clase === "propio";
      const deAlguien = propio || e.clase === "mensaje" || e.de !== "Sistema";
      if (!deAlguien) {
        salida.push({ tipo: "aviso", alerta: e.clase === "alerta", texto: e.texto });
        anterior = null;
        continue;
      }
      const quien = propio ? "Vos" : e.de;
      salida.push({ tipo: "burbuja", propio, de: quien, texto: e.texto, minuto: e.minuto, sigue: anterior === quien });
      anterior = quien;
    }
    return salida;
  });

  let contenedor = $state<HTMLDivElement | null>(null);

  /* Lo último que llegó siempre a la vista, como cuando abrís un chat. */
  $effect(() => {
    void items.length;
    if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
  });
</script>

<div class="charla" bind:this={contenedor}>
  <div class="hilo">
    <span class="dia">HOY</span>
    {#each items as item, i (i)}
      {#if item.tipo === "aviso"}
        <span class="aviso" class:alerta={item.alerta}>{item.texto}</span>
      {:else}
        <div class="msj" class:propio={item.propio} class:sigue={item.sigue}>
          {#if mostrarNombres && !item.propio && !item.sigue}
            <span class="nom" style:color={colorDe(item.de)}>{item.de}</span>
          {/if}
          {item.texto}<span class="meta">{formatearHora(item.minuto)}{#if item.propio}<span class="visto" aria-label="visto">✓✓</span>{/if}</span>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .charla {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    background: var(--app-papel);
  }

  /* El hilo se apoya abajo: con pocos mensajes, quedan cerca de las respuestas. */
  .hilo {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 5px;
    padding: 10px 12px 10px;
  }

  .dia,
  .aviso {
    align-self: center;
    margin: 3px 0;
    padding: 4px 10px;
    border-radius: 8px;
    background: color-mix(in oklab, var(--app-superficie) 72%, transparent);
    font-size: calc(11.5px * var(--escala-ui));
    color: var(--app-tinta-2);
    text-align: center;
    max-width: 88%;
  }
  .dia { padding: 3px 10px; font-weight: 600; letter-spacing: 0.06em; font-size: var(--t-micro); }
  .aviso.alerta { color: var(--est-rechazado); font-weight: 600; }

  .msj {
    align-self: flex-start;
    max-width: 82%;
    padding: 6px 9px 5px;
    border-radius: 12px;
    border-top-left-radius: 4px;
    background: var(--app-superficie);
    box-shadow: 0 1px 0 rgb(21 24 27 / 6%);
    font-size: var(--t-mensaje);
    /* El texto que el jugador tiene que leer nunca se degrada. */
    line-height: 1.38;
    overflow-wrap: anywhere;
  }
  .msj.sigue { border-top-left-radius: 12px; }
  .msj.propio {
    align-self: flex-end;
    background: var(--app-propio);
    border-top-left-radius: 12px;
    border-top-right-radius: 4px;
  }
  .msj.propio.sigue { border-top-right-radius: 12px; }

  .nom {
    display: block;
    margin-bottom: 1px;
    font-size: calc(12px * var(--escala-ui));
    font-weight: 700;
    color: var(--app-tinta-3);
  }

  .meta {
    float: right;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin: 6px 0 -3px 10px;
    font-size: calc(10.5px * var(--escala-ui));
    color: var(--app-tinta-3);
    font-variant-numeric: tabular-nums;
  }
  .visto { color: var(--est-hablando); letter-spacing: -0.25em; margin-right: 0.25em; }
</style>
