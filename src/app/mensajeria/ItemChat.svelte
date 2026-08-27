<!--
  Una fila de la lista de chats. Es el componente que más se repite del juego,
  así que no sabe nada del juego: recibe una VistaContacto y avisa cuando la
  tocan.
-->
<script lang="ts">
  import type { VistaContacto } from "../../core/partida.js";
  import { formatearHora } from "../../core/tiempo.js";
  import Avatar from "./Avatar.svelte";

  let { contacto, alAbrir }: { contacto: VistaContacto; alAbrir: (id: string) => void } = $props();

  const ROTULO: Record<string, string> = {
    sin_contactar: "sin escribir",
    esperando: "esperando",
    hablando: "abierto",
    confirmado: "viene",
    rechazado: "no viene",
    bajado: "se bajó",
  };

  /* Sin mensajes, el renglón lo ocupa el rol: informa algo distinto en cada
     fila. Repetir "todavía no le escribiste" doce veces se lee como un bug. */
  const preview = $derived(contacto.ultimoMensaje);
</script>

<button class="item" onclick={() => alAbrir(contacto.id)} class:sinabrir={contacto.sinLeer > 0}>
  <Avatar nombre={contacto.nombre} id={contacto.id} estado={contacto.estado} />

  <span class="centro">
    <span class="linea">
      <span class="nombre">{contacto.nombre}</span>
      <span class="hora">
        {contacto.minutoUltimo === null ? "" : formatearHora(contacto.minutoUltimo)}
      </span>
    </span>
    <span class="linea">
      {#if preview}
        <span class="preview">{preview}</span>
      {:else}
        <span class="rol">{contacto.rol} · {ROTULO[contacto.estado]}</span>
      {/if}
      {#if contacto.sinLeer > 0}
        <span class="badge">{contacto.sinLeer}</span>
      {:else if contacto.estado === "confirmado"}
        <span class="tilde" data-estado="confirmado" aria-label="confirmado">✓</span>
      {/if}
    </span>
  </span>
</button>

<style>
  .item {
    display: flex;
    gap: var(--e2);
    align-items: flex-start;
    width: 100%;
    padding: calc(var(--e1) + 1px) var(--e3);
    border-bottom: 1px solid var(--app-linea);
    background: var(--app-superficie);
  }
  .item:hover { background: var(--app-hover); }
  .item:focus-visible { outline-offset: -2px; }

  .centro { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }

  .linea { display: flex; align-items: baseline; gap: var(--e1); }

  .nombre {
    flex: 1;
    min-width: 0;
    font-size: var(--t-nombre);
    font-weight: 600;
    color: var(--app-tinta);
    letter-spacing: var(--apretado);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hora {
    flex: none;
    font-size: var(--t-micro);
    font-variant-numeric: tabular-nums;
    color: var(--app-tinta-3);
  }

  .preview {
    flex: 1;
    min-width: 0;
    font-size: var(--t-mensaje);
    /* El texto que el jugador tiene que leer nunca se degrada. */
    line-height: 1.35;
    color: var(--app-tinta-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sinabrir .nombre { font-weight: 700; }
  .sinabrir .preview { color: var(--app-tinta); }

  .badge {
    flex: none;
    min-width: calc(19px * var(--escala-ui));
    height: calc(19px * var(--escala-ui));
    padding: 0 6px;
    display: grid;
    place-items: center;
    border-radius: var(--radio-chip);
    background: var(--est-hablando);
    color: #FFFFFF;
    font-size: var(--t-micro);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .rol {
    flex: 1;
    min-width: 0;
    font-size: var(--t-meta);
    color: var(--app-tinta-3);
    letter-spacing: 0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tilde {
    flex: none;
    font-size: var(--t-meta);
    font-weight: 700;
    line-height: 1;
  }
  .tilde[data-estado="confirmado"] { color: var(--est-confirmado); }
</style>
