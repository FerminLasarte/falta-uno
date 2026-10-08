<!--
  Te quedaste sin moral: apagás el teléfono. La pantalla se va a negro de golpe,
  sin animación ni botón, y un rato después vuelve a prenderse con lo que pasó
  esa noche.
-->
<script lang="ts">
  let { alPrender }: { alPrender: () => void } = $props();

  /** Lo que dura apagado. Lo justo para que se sienta que lo dejaste a un costado. */
  const APAGADO_MS = 3500;

  $effect(() => {
    const reloj = setTimeout(alPrender, APAGADO_MS);
    return () => clearTimeout(reloj);
  });
</script>

<div class="apagado" aria-label="El teléfono está apagado"></div>

<style>
  .apagado {
    position: absolute;
    inset: 0;
    z-index: 6;
    background: #000000;
  }
</style>
