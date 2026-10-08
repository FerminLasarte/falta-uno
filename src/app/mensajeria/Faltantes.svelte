<!--
  Lo que falta para completar la lista, por puesto y en suplentes: "1 ARQ",
  "3 DEF", "3 SUP". En un renglón no entra todo: los suplentes aparecen cuando
  ya no falta ningún titular.
-->
<script lang="ts">
  import type { VistaRoster } from "../../core/partida.js";
  import { ROL_CORTO } from "./rotulos.js";

  let { roster, compacto = false }: { roster: VistaRoster; compacto?: boolean } = $props();
</script>

{#each roster.faltantes as f (f.rol)}
  <span class="chip">{f.faltan} {ROL_CORTO[f.rol]}</span>
{/each}
{#if roster.suplentes > 0 && (!compacto || roster.faltantes.length === 0)}
  <span class="chip">{roster.suplentes} SUP</span>
{/if}

<style>
  .chip {
    flex: none;
    font-size: calc(10.5px * var(--escala-ui));
    font-weight: 700;
    letter-spacing: 0.05em;
    font-variant-numeric: tabular-nums;
    color: var(--est-esperando);
    background: color-mix(in oklab, var(--est-esperando) 12%, transparent);
    border-radius: var(--radio-chip);
    padding: 2px 7px;
  }
</style>
