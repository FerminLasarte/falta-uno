<!--
  El aparato. Su único trabajo es enmarcar la pantalla y derramar luz sobre la
  mesa: ese derrame es el detalle que hace que el teléfono esté APOYADO ahí y
  no pegado encima de un fondo.
-->
<script lang="ts">
  let { children } = $props();
</script>

<div class="telefono">
  <div class="derrame" aria-hidden="true"></div>
  <div class="cuerpo">
    <div class="pantalla">
      {@render children?.()}
      <div class="remate" aria-hidden="true">
        <span class="barra-inicio"></span>
      </div>
    </div>
  </div>
</div>

<style>
  .telefono {
    position: relative;
    height: min(94vh, 880px);
    aspect-ratio: 10 / 19.5;
    /* Que el navegador aísle el repintado del teléfono del resto de la escena. */
    contain: layout paint;
  }

  /* La luz de la pantalla cayendo sobre el hule. */
  .derrame {
    position: absolute;
    inset: -14%;
    border-radius: 50%;
    background: radial-gradient(
      ellipse at center,
      color-mix(in oklab, var(--app-fondo) 40%, transparent) 0%,
      transparent 68%
    );
    opacity: calc(0.5 + var(--luz) * 0.3);
    pointer-events: none;
  }

  .cuerpo {
    position: relative;
    height: 100%;
    border-radius: 30px;
    padding: 6px;
    background: linear-gradient(150deg, #2C3237 0%, var(--bisel) 42%, #05070A 100%);
    box-shadow:
      0 2px 0 rgb(255 255 255 / 6%) inset,
      18px 26px 44px -14px rgb(0 0 0 / 72%),
      0 0 0 1px var(--bisel-borde);
  }

  .pantalla {
    position: relative;
    height: 100%;
    border-radius: 24px;
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
