<!--
  El menú del juego, afuera del teléfono: Esc lo abre y lo cierra, y mientras
  está abierto el tiempo real no corre. Va a la izquierda, sobre el living
  oscurecido, con el teléfono todavía a la vista: se siente como pausar, no como
  una ventana que salta.

  Se maneja con flechas y Enter (y con el mouse): es lo que después toma el
  gamepad en la Deck. Empezar otra campaña pide confirmación.
-->
<script lang="ts">
  import { tick } from "svelte";

  let {
    estado,
    puedeEmpezarOtra,
    hayQuePerder,
    alSeguir,
    alCampanaNueva,
    alSalir,
  }: {
    /** Dónde estás: el perfil, la fecha y la hora. */
    estado: string;
    /** Sin una campaña en curso no hay nada que perder ni que empezar de nuevo. */
    puedeEmpezarOtra: boolean;
    /** Si hay una campaña en juego que se perdería. Terminada, se empieza otra sin preguntar. */
    hayQuePerder: boolean;
    alSeguir: () => void;
    alCampanaNueva: () => void;
    alSalir: () => void;
  } = $props();

  let confirmando = $state(false);
  let columna = $state<HTMLElement>();

  const opciones = (): HTMLButtonElement[] => [...(columna?.querySelectorAll<HTMLButtonElement>("button") ?? [])];

  /** Qué opción queda elegida después de cambiar de lista: al volver, la de la que saliste. */
  let elegida = 0;

  /* Al abrir, al pasar a confirmar y al volver, queda elegida la que corresponde. */
  $effect(() => {
    void confirmando;
    void tick().then(() => opciones()[elegida]?.focus());
  });

  function empezarOtra(): void {
    if (!hayQuePerder) return alCampanaNueva();
    elegida = 0;
    confirmando = true;
  }

  function noEmpezar(): void {
    elegida = 1;
    confirmando = false;
  }

  function mover(evento: KeyboardEvent): void {
    const lista = opciones();
    const actual = lista.indexOf(document.activeElement as HTMLButtonElement);
    const paso = evento.key === "ArrowDown" ? 1 : evento.key === "ArrowUp" ? -1 : 0;
    if (paso === 0) return;
    evento.preventDefault();
    lista[(actual + paso + lista.length) % lista.length]?.focus();
  }

  const enfocar = (e: MouseEvent): void => (e.currentTarget as HTMLButtonElement).focus();
</script>

<div class="menu" role="dialog" aria-modal="true" aria-label="Menú">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="columna" bind:this={columna} onkeydown={mover}>
    <span class="marca">Falta Uno</span>
    <span class="estado">{estado}</span>

    {#if confirmando}
      <p class="pregunta">¿Empezar otra campaña?</p>
      <p class="detalle">Se pierde la que estás jugando.</p>
      <button class="opcion" onmouseenter={enfocar} onclick={alCampanaNueva}>Empezar otra</button>
      <button class="opcion" onmouseenter={enfocar} onclick={noEmpezar}>No, seguir con esta</button>
    {:else}
      <button class="opcion" onmouseenter={enfocar} onclick={alSeguir}>Seguir</button>
      {#if puedeEmpezarOtra}
        <button class="opcion" onmouseenter={enfocar} onclick={empezarOtra}>Campaña nueva</button>
      {/if}
      <button class="opcion" onmouseenter={enfocar} onclick={alSalir}>Salir</button>
    {/if}

    <span class="ayuda">Esc para volver al teléfono</span>
  </div>
</div>

<style>
  /* Fuera del teléfono, el menú no es la app: tipografía del cromo, blanco sobre la noche. */
  .menu {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: linear-gradient(
      90deg,
      rgb(8 7 5 / 92%) 0%,
      rgb(8 7 5 / 80%) 34%,
      rgb(8 7 5 / 30%) 62%,
      rgb(8 7 5 / 15%) 100%
    );
    animation: aparecer 180ms ease-out both;
  }

  .columna {
    position: absolute;
    left: max(32px, 6%);
    top: 50%;
    translate: 0 -50%;
    width: 260px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    color: #FFFFFF;
  }

  .marca {
    font-family: var(--fuente-cromo);
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  .estado { margin-bottom: 18px; font-size: 13px; color: rgb(255 255 255 / 62%); }

  .pregunta { margin: 0; font-family: var(--fuente-cromo); font-size: 20px; font-weight: 700; }
  .detalle { margin: 2px 0 10px; font-size: 13px; color: rgb(255 255 255 / 62%); }

  .opcion {
    padding: 8px 0;
    font-family: var(--fuente-cromo);
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: rgb(255 255 255 / 55%);
    transition: color 120ms ease, translate 160ms ease;
  }
  /* La elegida se ve sin depender del hover: con teclado y gamepad no hay mouse. */
  .opcion:focus { outline: none; color: #FFFFFF; translate: 4px 0; }
  .opcion:focus::before { content: "— "; color: rgb(255 255 255 / 70%); }

  .ayuda { margin-top: 18px; font-size: 12px; color: rgb(255 255 255 / 45%); }

  @keyframes aparecer {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
