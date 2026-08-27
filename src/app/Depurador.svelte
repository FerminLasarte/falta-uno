<!--
  Panel de desarrollo. Solo existe en `npm run dev`: sirve para revisar la
  degradación sin tener que jugar hasta quedarte sin moral. Se muestra con F2.
-->
<script lang="ts">
  let { moral, alCambiar }: { moral: number; alCambiar: (valor: number | null) => void } = $props();

  let visible = $state(false);
  let forzada = $state<number | null>(null);

  function tecla(evento: KeyboardEvent): void {
    if (evento.key === "F2") {
      visible = !visible;
      if (!visible) {
        forzada = null;
        alCambiar(null);
      }
    }
  }

  function mover(evento: Event): void {
    const valor = Number((evento.currentTarget as HTMLInputElement).value);
    forzada = valor;
    alCambiar(valor);
  }
</script>

<svelte:window onkeydown={tecla} />

{#if visible}
  <div class="panel">
    <label for="moral">moral <b>{forzada ?? moral}</b></label>
    <input id="moral" type="range" min="0" max="100" value={forzada ?? moral} oninput={mover} />
    <span class="ayuda">F2 para cerrar</span>
  </div>
{/if}

<style>
  .panel {
    position: fixed;
    left: 14px;
    bottom: 14px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    border-radius: 8px;
    background: rgb(10 12 14 / 88%);
    color: #E6ECE7;
    font-size: 12px;
    font-family: var(--fuente-cromo);
    backdrop-filter: blur(6px);
  }
  label { display: flex; gap: 6px; }
  b { font-variant-numeric: tabular-nums; min-width: 24px; }
  input { width: 180px; }
  .ayuda { opacity: 0.45; }
</style>
