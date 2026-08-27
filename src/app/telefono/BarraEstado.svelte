<!--
  La barra de estado del sistema operativo. La hora acá NO es decorativa: es el
  reloj del juego. Que el jugador lea la hora del partido en el mismo lugar
  donde leería la hora real es la mitad del truco.
-->
<script lang="ts">
  let { hora, restante }: { hora: string; restante: number } = $props();

  const bateria = $derived(Math.max(4, Math.round((restante / 120) * 100)));
</script>

<div class="barra">
  <span class="hora">{hora}</span>
  <div class="derecha">
    <span class="senal" aria-hidden="true">
      <i style="height: 4px"></i><i style="height: 6px"></i><i style="height: 8px"></i><i style="height: 10px"></i>
    </span>
    <span class="bateria" class:critica={bateria <= 15}>
      <span class="carga" style="width: {bateria}%"></span>
    </span>
  </div>
</div>

<style>
  .barra {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(var(--e2)) var(--e3) var(--e1);
    background: var(--app-cromo);
    color: color-mix(in oklab, #FFFFFF 88%, var(--enfermizo) calc(var(--enfermo) * 60%));
    font-family: var(--fuente-cromo);
    flex: none;
  }

  .hora {
    font-size: var(--t-meta);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  .derecha { display: flex; align-items: center; gap: var(--e1); }

  .senal { display: flex; align-items: flex-end; gap: 1.5px; }
  .senal i { display: block; width: 2.5px; background: currentColor; border-radius: 1px; opacity: 0.9; }

  .bateria {
    position: relative;
    width: 22px;
    height: 11px;
    border: 1.4px solid currentColor;
    border-radius: 3px;
    opacity: 0.9;
    padding: 1.4px;
  }
  .bateria::after {
    content: "";
    position: absolute;
    right: -3.4px;
    top: 3px;
    width: 2px;
    height: 4px;
    background: currentColor;
    border-radius: 0 1px 1px 0;
  }
  .carga { display: block; height: 100%; background: currentColor; border-radius: 1px; }
  .critica { color: #F08878; }
</style>
