<!--
  El mantel de hule visto desde arriba. Todo es CSS: color base, trama del hule,
  grano, manchas viejas y el cerco que dejó un vaso. La suciedad no es
  decoración: es lo que hace que el teléfono se lea como lo único limpio.
-->
<script lang="ts">
  // Sin lógica: es puro dibujo. El script vacío lo marca como TypeScript.
</script>

<div class="mesa" aria-hidden="true">
  <div class="trama"></div>
  <div class="grano"></div>
  <div class="manchas">
    <span class="mancha m1"></span>
    <span class="mancha m2"></span>
    <span class="mancha m3"></span>
    <span class="cerco"></span>
  </div>
  <div class="migas"></div>
</div>

<style>
  .mesa {
    position: absolute;
    inset: 0;
    background: var(--mesa);
    filter: brightness(var(--luz));
  }

  /* Hule con cuadros gastados: dos gradientes cruzados de bajísimo contraste. */
  .trama {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(
        90deg,
        rgb(255 255 255 / 3.5%) 0 2px,
        transparent 2px 46px
      ),
      repeating-linear-gradient(
        0deg,
        rgb(255 255 255 / 3.5%) 0 2px,
        transparent 2px 46px
      ),
      repeating-linear-gradient(
        90deg,
        rgb(0 0 0 / 5%) 0 46px,
        rgb(0 0 0 / 2%) 46px 92px
      );
  }

  .grano {
    position: absolute;
    inset: 0;
    opacity: calc(0.5 + var(--ruido) * 3);
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='r'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23r)'/%3E%3C/svg%3E");
  }

  .manchas { position: absolute; inset: 0; }

  .mancha {
    position: absolute;
    background: radial-gradient(ellipse at 40% 40%, var(--mesa-mancha) 0%, transparent 70%);
    opacity: 0.28;
  }
  .m1 { top: 12%; left: 8%; width: 220px; height: 150px; border-radius: 46% 54% 38% 62% / 58% 42% 58% 42%; }
  .m2 { bottom: 16%; right: 11%; width: 170px; height: 190px; border-radius: 62% 38% 55% 45% / 40% 60% 40% 60%; opacity: 0.2; }
  .m3 { top: 58%; left: 16%; width: 90px; height: 80px; border-radius: 50%; opacity: 0.16; }

  /* El cerco de un vaso apoyado hace rato. */
  .cerco {
    position: absolute;
    top: 17.4%;
    right: 14.9%;
    width: 132px;
    height: 132px;
    border-radius: 50%;
    border: 3px solid var(--mesa-oscura);
    opacity: 0.22;
    filter: blur(0.6px);
  }

  .migas {
    position: absolute;
    inset: 0;
    opacity: 0.4;
    background-image: radial-gradient(circle, var(--mesa-oscura) 0.9px, transparent 1px);
    background-size: 137px 121px;
    background-position: 23px 41px;
  }
</style>
