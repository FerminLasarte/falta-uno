<!--
  La acción grande de una pantalla: escribirle a alguien, atender, ir a la
  cancha. Va centrada entre los pulgares, oscura, con lo que cuesta si cuesta.
-->
<script lang="ts">
  import type { AccionChat } from "./rotulos.js";

  let { accion, alTocar }: { accion: AccionChat; alTocar: () => void } = $props();
</script>

<button class="principal" onclick={alTocar}>
  {accion.texto}
  {#if accion.minutos !== undefined}<span class="costo">{accion.minutos} min</span>{/if}
</button>

<style>
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
  .costo {
    font-size: var(--t-micro);
    font-weight: 600;
    color: rgb(255 255 255 / 60%);
    font-variant-numeric: tabular-nums;
  }
</style>
