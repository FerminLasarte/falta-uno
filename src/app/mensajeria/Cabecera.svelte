<!--
  El encabezado de cualquier pantalla de la app: volver (con lo que te espera
  sin leer), la foto, el nombre y una línea de estado. A la derecha, una acción
  opcional, como llamar.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    titulo,
    subtitulo = null,
    volver = null,
    avatar,
    accion,
  }: {
    titulo: string;
    subtitulo?: string | null;
    volver?: { cuenta: number; alVolver: () => void } | null;
    avatar?: Snippet;
    accion?: Snippet;
  } = $props();
</script>

<header class="cabecera" class:sin-volver={!volver}>
  {#if volver}
    <button
      class="volver"
      onclick={volver.alVolver}
      aria-label={volver.cuenta > 0 ? `Volver, ${volver.cuenta} sin leer` : "Volver"}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {#if volver.cuenta > 0}<span class="cuenta">{volver.cuenta}</span>{/if}
    </button>
  {/if}

  {@render avatar?.()}

  <span class="titulo" class:solo={!avatar}>
    <strong>{titulo}</strong>
    {#if subtitulo}<span>{subtitulo}</span>{/if}
  </span>

  {@render accion?.()}
</header>

<style>
  .cabecera {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 16px 10px 10px;
    background: var(--app-cromo);
    color: #FFFFFF;
  }
  .sin-volver { padding-left: 16px; }

  .volver {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 4px 4px 2px;
    color: rgb(255 255 255 / 92%);
    font-size: var(--t-meta);
    font-weight: 600;
  }
  .volver svg { width: 20px; height: 20px; }
  .cuenta {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    display: grid;
    place-items: center;
    border-radius: var(--radio-chip);
    background: rgb(255 255 255 / 16%);
    font-size: var(--t-micro);
    font-variant-numeric: tabular-nums;
  }

  .titulo { flex: 1; min-width: 0; display: grid; }
  .titulo strong {
    font-family: var(--fuente-cromo);
    font-size: calc(16.5px * var(--escala-ui));
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .titulo.solo strong { font-size: calc(20px * var(--escala-ui)); }
  .titulo span {
    font-size: calc(12px * var(--escala-ui));
    color: rgb(255 255 255 / 60%);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
