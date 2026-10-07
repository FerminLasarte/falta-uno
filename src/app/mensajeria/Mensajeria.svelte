<!--
  La app de mensajería adentro del teléfono. Impecable a propósito: es lo único
  ordenado de toda la escena, y se pudre a medida que se te cae la moral.
-->
<script lang="ts">
  import type { VistaContacto, VistaRoster } from "../../core/partida.js";
  import Fijado from "./Fijado.svelte";
  import ItemChat from "./ItemChat.svelte";

  let {
    contactos,
    roster,
    dinero,
    sena,
    alAbrir,
  }: {
    contactos: readonly VistaContacto[];
    roster: VistaRoster;
    dinero: number;
    sena: number;
    alAbrir: (id: string) => void;
  } = $props();

  /* Los que tienen algo pendiente suben. Es lo que hace una app de verdad y es
     lo que el jugador necesita: lo urgente arriba. */
  const PRIORIDAD: Record<string, number> = {
    hablando: 0,
    esperando: 1,
    sin_contactar: 2,
    confirmado: 3,
    bajado: 4,
    rechazado: 5,
  };

  const ordenados = $derived(
    [...contactos].sort((a, b) => {
      if (b.sinLeer !== a.sinLeer) return b.sinLeer - a.sinLeer;
      const pa = PRIORIDAD[a.estado] ?? 9;
      const pb = PRIORIDAD[b.estado] ?? 9;
      if (pa !== pb) return pa - pb;
      return (b.minutoUltimo ?? 0) - (a.minutoUltimo ?? 0);
    }),
  );

  const sinLeerTotal = $derived(contactos.reduce((t, c) => t + c.sinLeer, 0));
</script>

<div class="app">
  <header class="encabezado">
    <span class="marca">Mensajes</span>
    {#if sinLeerTotal > 0}
      <span class="total">{sinLeerTotal} sin leer</span>
    {/if}
  </header>

  <Fijado {roster} {dinero} {sena} />

  <div class="lista" role="list">
    {#each ordenados as contacto (contacto.id)}
      <div role="listitem">
        <ItemChat {contacto} {alAbrir} />
      </div>
    {/each}
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--app-fondo);
  }

  .encabezado {
    flex: none;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--e2);
    padding: var(--e1) var(--e3) var(--e2);
    background: var(--app-cromo);
    color: #FFFFFF;
  }

  .marca {
    font-family: var(--fuente-cromo);
    font-size: var(--t-titulo);
    font-weight: 700;
    letter-spacing: -0.015em;
  }

  .total {
    font-size: var(--t-micro);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: color-mix(in oklab, #FFFFFF 62%, transparent);
    font-variant-numeric: tabular-nums;
  }

  .lista {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    /* Los pulgares del render tapan el pie de la pantalla: sin este aire, el último
       contacto quedaría siempre abajo de un dedo. */
    padding-bottom: 110px;
    scrollbar-width: thin;
    scrollbar-color: var(--app-linea) transparent;
  }
</style>
