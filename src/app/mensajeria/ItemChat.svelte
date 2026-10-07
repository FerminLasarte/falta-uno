<!--
  Una fila de la bandeja. Es el componente que más se repite, así que no sabe
  nada del juego: recibe la foto, el nombre, una línea y avisa cuando la tocan.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { formatearHora } from "../../core/tiempo.js";

  let {
    titulo,
    linea,
    minuto = null,
    sinLeer = 0,
    avatar,
    alAbrir,
  }: {
    titulo: string;
    linea: string;
    minuto?: number | null;
    sinLeer?: number;
    avatar: Snippet;
    alAbrir: () => void;
  } = $props();
</script>

<button class="item" class:sinleer={sinLeer > 0} onclick={alAbrir}>
  {@render avatar()}
  <span class="cuerpo">
    <span class="renglon">
      <strong>{titulo}</strong>
      {#if minuto !== null}<span class="hora">{formatearHora(minuto)}</span>{/if}
    </span>
    <span class="renglon">
      <span class="linea">{linea}</span>
      {#if sinLeer > 0}<span class="badge">{sinLeer}</span>{/if}
    </span>
  </span>
</button>

<style>
  .item {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 9px var(--e3);
    border-bottom: 1px solid var(--app-linea);
    background: var(--app-superficie);
  }
  .item:hover { background: var(--app-hover); }
  .item:focus-visible { outline-offset: -2px; }

  .cuerpo { flex: 1; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px; }
  .renglon { display: flex; align-items: baseline; gap: 8px; min-width: 0; }

  strong {
    flex: 1;
    min-width: 0;
    font-size: var(--t-nombre);
    font-weight: 600;
    letter-spacing: var(--apretado);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hora { flex: none; font-size: var(--t-micro); color: var(--app-tinta-3); font-variant-numeric: tabular-nums; }
  .sinleer strong { font-weight: 700; }
  .sinleer .hora { color: var(--est-hablando); font-weight: 600; }

  .linea {
    flex: 1;
    min-width: 0;
    font-size: calc(13.5px * var(--escala-ui));
    line-height: 1.35;
    color: var(--app-tinta-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sinleer .linea { color: var(--app-tinta); }

  .badge {
    flex: none;
    min-width: calc(19px * var(--escala-ui));
    height: calc(19px * var(--escala-ui));
    padding: 0 6px;
    display: grid;
    place-items: center;
    border-radius: var(--radio-chip);
    background: var(--est-hablando);
    color: #FFFFFF;
    font-size: var(--t-micro);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
