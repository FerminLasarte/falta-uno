<!--
  El vidrio del celular. Recorta la app con el radio real de las esquinas y le pone la
  barra de inicio. El marco, la cámara frontal y las manos no son HTML: están en el
  render, adelante, y tapan lo que tienen que tapar.
-->
<script lang="ts">
  /** `oscura`: el teléfono bloqueado, sin la app. El remate no puede ser claro ahí. */
  let { children, oscura = false } = $props();
</script>

<div class="pantalla">
  {@render children?.()}
  <div class="remate" class:oscura aria-hidden="true">
    <span class="barra-inicio"></span>
  </div>
</div>

<style>
  .pantalla {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: var(--radio-pantalla);
    overflow: hidden;
    background: var(--app-fondo);
    display: flex;
    flex-direction: column;
  }

  /* Remate inferior: desvanecido para que la lista no se corte a lo bruto,
     más la barra de inicio que termina de convertir esto en un teléfono. */
  .remate {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 42px;
    z-index: 4;
    pointer-events: none;
    display: grid;
    place-items: end center;
    padding-bottom: 8px;
    background: linear-gradient(
      to top,
      var(--app-superficie) 24%,
      color-mix(in oklab, var(--app-superficie) 70%, transparent) 58%,
      transparent 100%
    );
  }

  .remate.oscura { background: none; }
  .remate.oscura .barra-inicio { background: rgb(255 255 255 / 55%); }

  .barra-inicio {
    width: 34%;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in oklab, var(--app-tinta) 34%, transparent);
  }

  /* El ruido que aparece sobre la pantalla cuando la moral se cae. */
  .pantalla::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
    opacity: calc(var(--deterioro) * 0.5);
    mix-blend-mode: multiply;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23p)' opacity='0.45'/%3E%3C/svg%3E");
  }
</style>
