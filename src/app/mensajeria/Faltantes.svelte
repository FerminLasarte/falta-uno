<!-- Lo que falta para completar la lista, por puesto: "1 ARQ", "3 DEF". -->
<script lang="ts">
  import type { VistaRoster } from "../../core/partida.js";
  import { ROL_CORTO } from "./rotulos.js";

  let { faltantes }: { faltantes: VistaRoster["faltantes"] } = $props();
</script>

{#each faltantes as f (f.rol)}
  <span class="chip">{f.faltan} {ROL_CORTO[f.rol]}</span>
{/each}

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
