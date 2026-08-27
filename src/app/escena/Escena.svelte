<!--
  La cocina, siempre desde arriba. El teléfono va en el slot: la escena no sabe
  nada de él, solo le hace lugar y le pone la luz encima.
-->
<script lang="ts">
  import Mesa from "./Mesa.svelte";
  import Objetos from "./Objetos.svelte";

  let { children } = $props();
</script>

<div class="escena">
  <Mesa />
  <Objetos />
  <div class="tubo" aria-hidden="true"></div>
  <div class="vineta" aria-hidden="true"></div>
  <div class="hueco">
    {@render children?.()}
  </div>
</div>

<style>
  .escena {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--mundo-fondo);
  }

  /*
    Tubo fluorescente arriba a la izquierda: luz fría con verde, que es lo que
    hace que la cocina se vea barata y que la pantalla del teléfono se vea
    limpia por contraste.
  */
  /*
    Charco de luz, no un baño uniforme. La mesa es oscura de base y el tubo
    ilumina una zona: sin esa caída no hay noche, hay pared verde.
  */
  .tubo {
    position: absolute;
    inset: 0;
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: calc(0.9 * var(--luz));
    background: radial-gradient(
      ellipse 64% 56% at 47% 38%,
      color-mix(in oklab, var(--mundo-luz) 52%, transparent) 0%,
      color-mix(in oklab, var(--mundo-luz) 26%, transparent) 46%,
      transparent 78%
    );
  }

  .hueco {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 2vh 0;
  }

  .vineta {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      ellipse 62% 58% at 47% 42%,
      transparent 18%,
      rgb(16 13 9 / 38%) 60%,
      rgb(16 13 9 / 82%) 86%,
      rgb(11 9 6 / 94%) 100%
    );
  }
</style>
