<!--
  La lista achicada a un renglón, para cuando estás en otro chat. El diseño pide
  que el estado del plantel esté siempre a la vista: acá sigue, y tocarla vuelve
  al grupo.
-->
<script lang="ts">
  import type { VistaRoster } from "../../core/partida.js";
  import Faltantes from "./Faltantes.svelte";
  import { pesos } from "./rotulos.js";

  let {
    roster,
    dinero,
    sena,
    alTocar,
  }: { roster: VistaRoster; dinero: number; sena: number; alTocar: () => void } = $props();
</script>

<button class="franja" onclick={alTocar} aria-label="Ver la lista en el grupo">
  <span class="n">{roster.confirmados}/{roster.necesarios}</span>
  <span class="chips">
    <Faltantes {roster} compacto />
  </span>
  <span class="sena" class:corta={dinero < sena}>
    {pesos(dinero)} / {pesos(sena)}
  </span>
</button>

<style>
  .franja {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px var(--e3);
    background: var(--app-superficie);
    border-bottom: 1px solid var(--app-linea);
    box-shadow: var(--sombra-app);
    position: relative;
    z-index: 2;
  }
  .n {
    font-family: var(--fuente-cromo);
    font-size: calc(13px * var(--escala-ui));
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .chips { flex: 1; min-width: 0; display: flex; gap: 4px; overflow: hidden; }
  .sena {
    flex: none;
    font-size: calc(11.5px * var(--escala-ui));
    color: var(--app-tinta-3);
    font-variant-numeric: tabular-nums;
  }
  .sena.corta { color: var(--est-rechazado); }
</style>
