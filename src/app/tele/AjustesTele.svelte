<!--
  Ajustes es el menú del televisor, no del canal: letras verdes con borde negro y la barra
  de bloques abajo, como cuando subías el volumen de una tele de antes. ↑↓ elige, ←→
  cambia, y Enter da vuelta lo que es sí o no. Esc vuelve al entretiempo: lo atiende la placa.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { ajustes, PASO_VOLUMEN } from "../estado/ajustes.svelte.js";
  import { enfocarAlPasar, moverFoco } from "./foco.js";

  type Que = "volumen" | "pantalla" | "movimiento";

  let lista = $state<HTMLElement>();
  let elegida = $state<Que>("volumen");
  const bloques = Array.from({ length: 100 / PASO_VOLUMEN }, (_, i) => (i + 1) * PASO_VOLUMEN);

  onMount(() => lista?.querySelector("button")?.focus());

  function darVuelta(que: Que): void {
    if (que === "pantalla") ajustes.pantallaCompleta = !ajustes.pantallaCompleta;
    else if (que === "movimiento") ajustes.movimientoReducido = !ajustes.movimientoReducido;
  }

  function cambiar(evento: KeyboardEvent, que: Que): void {
    const paso = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (paso === 0) return;
    evento.preventDefault();
    if (que === "volumen") ajustes.subirVolumen(paso);
    else darVuelta(que);
  }

  function ponerVolumen(evento: MouseEvent, valor: number): void {
    evento.stopPropagation();
    ajustes.ponerVolumen(valor);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tele-vieja" bind:this={lista} onkeydown={(e) => moverFoco(e, lista)}>
  <div class="filas">
    <button class="fila" onmouseenter={enfocarAlPasar} onfocus={() => (elegida = "volumen")} onkeydown={(e) => cambiar(e, "volumen")}>
      Volumen
    </button>
    <button class="fila" onmouseenter={enfocarAlPasar} onfocus={() => (elegida = "pantalla")} onkeydown={(e) => cambiar(e, "pantalla")} onclick={() => darVuelta("pantalla")}>
      Pantalla completa · {ajustes.pantallaCompleta ? "Sí" : "No"}
    </button>
    <button class="fila" onmouseenter={enfocarAlPasar} onfocus={() => (elegida = "movimiento")} onkeydown={(e) => cambiar(e, "movimiento")} onclick={() => darVuelta("movimiento")}>
      Movimiento · {ajustes.movimientoReducido ? "Reducido" : "Normal"}
    </button>
  </div>

  {#if elegida === "movimiento"}
    <p class="aclaracion">Reducido: la escena no tiembla ni vibra con los mensajes.</p>
  {/if}

  <div class="volumen" class:activo={elegida === "volumen"}>
    <span class="cifra">Volumen {ajustes.volumen}</span>
    <div class="bloques" aria-hidden="true">
      {#each bloques as valor (valor)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <i class:prendido={valor <= ajustes.volumen} onclick={(e) => ponerVolumen(e, valor)}></i>
      {/each}
    </div>
  </div>
</div>

<style>
  /* Letra de pantalla de tele vieja: verde, con borde negro duro y un poco de brillo. */
  .tele-vieja {
    position: absolute;
    inset: 0;
    font-family: var(--fuente-cromo);
    font-stretch: 100%;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6CF37A;
    text-shadow: -2px 0 #000, 2px 0 #000, 0 -2px #000, 0 2px #000, 0 0 6px rgb(60 220 90 / 55%);
  }

  .filas {
    position: absolute;
    left: 30px;
    top: 56px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .fila {
    padding: 2px 0 2px 25px;
    font: inherit;
    font-size: 19px;
    line-height: 1.45;
    color: #E6F5E8;
    opacity: 0.8;
    text-transform: inherit;
    letter-spacing: inherit;
  }
  /* La elegida, con la flechita de las teles de antes. Se ve sin mouse: con teclado y gamepad. */
  .fila:focus { outline: none; color: #6CF37A; opacity: 1; padding-left: 0; }
  .fila:focus::before { content: "▶ "; }

  .aclaracion {
    position: absolute;
    left: 55px;
    top: 160px;
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.05em;
    color: #E6F5E8;
  }

  .volumen {
    position: absolute;
    left: 30px;
    right: 30px;
    bottom: 50px;
    opacity: 0.55;
    transition: opacity 120ms ease;
  }
  .volumen.activo { opacity: 1; }
  .cifra { font-size: 22px; }
  .bloques { display: flex; gap: 4px; margin-top: 6px; }
  .bloques i {
    flex: 1;
    height: 18px;
    background: rgb(108 243 122 / 18%);
    box-shadow: 0 0 0 2px rgb(0 0 0 / 60%);
    cursor: pointer;
  }
  .bloques i.prendido { background: #6CF37A; box-shadow: 0 0 0 2px #000, 0 0 8px rgb(60 220 90 / 60%); }
</style>
