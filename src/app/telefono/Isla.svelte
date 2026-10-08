<!--
  Lo que llega a otro chat mientras estás en uno. Es la notificación del sistema,
  no de la app, y crece desde la cámara frontal, que está en el render y queda
  encima: la isla es negra como el agujero y la cámara se funde en ella.

  Abierta, muestra lo último que llegó y tapa la cabecera, nunca la lista. Cerrada,
  abraza la cámara y dice cuántos te esperan hasta que los leas. Se toca para abrir
  ese chat. Lo que llega al chat que estás mirando no pasa por acá.
-->
<script lang="ts">
  import { grupo as grupoDeAmigos } from "../estado/grupo.svelte.js";
  import { untrack } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import { CHAT_GRUPO } from "../../core/partida.js";
  import { juego, mismaPantalla, type Llegada } from "../estado/juego.svelte.js";
  import Avatar from "../mensajeria/Avatar.svelte";
  
  /** Lo que dura abierta si no llega nada más. */
  const ABIERTA_MS = 4500;
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

  interface Aviso {
    readonly chat: string;
    readonly titulo: string;
    readonly texto: string;
    /** Cuántos llegaron de ese chat desde que lo abriste por última vez. */
    readonly cuantos: number;
    readonly grupo: boolean;
    /** Sube con cada llegada: sirve de clave para animar el cambio. */
    readonly serie: number;
  }

  /** El más nuevo primero. Un aviso por chat: lo que sigue llegando de ahí se suma. */
  let avisos = $state<Aviso[]>([]);
  let abierta = $state(false);
  let serie = 0;
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  $effect(() => juego.alLlegar(llegar));

  function llegar(llegada: Llegada): void {
    if (llegada.aLaVista) return;
    const grupo = llegada.chat === CHAT_GRUPO;
    const previo = avisos.find((a) => a.chat === llegada.chat);
    const aviso: Aviso = {
      chat: llegada.chat,
      titulo: grupo ? grupoDeAmigos.nombre : llegada.de,
      texto: grupo ? `${llegada.de}: ${llegada.texto}` : llegada.texto,
      cuantos: (previo?.cuantos ?? 0) + 1,
      grupo,
      serie: ++serie,
    };
    avisos = [aviso, ...avisos.filter((a) => a.chat !== llegada.chat)];
    abierta = true;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => (abierta = false), ABIERTA_MS);
  }

  /* Abrir un chat, por la isla o por la bandeja, se lleva sus avisos. */
  $effect(() => {
    const actual = juego.pantalla;
    untrack(() => {
      avisos = avisos.filter((a) => !mismaPantalla(juego.pantallaDe(a.chat), actual));
      if (avisos.length === 0) abierta = false;
    });
  });

  function abrir(aviso: Aviso): void {
    clearTimeout(temporizador);
    abierta = false;
    juego.ir(juego.pantallaDe(aviso.chat));
  }

  const esperando = $derived(avisos.reduce((t, a) => t + a.cuantos, 0));
  const ultimo = $derived(avisos[0] ?? null);
</script>

<div class="lugar" role="status" aria-live="polite">
  {#if ultimo}
    {@const a = ultimo}
    <button
      class="isla"
      class:abierta
      onclick={() => abrir(a)}
      aria-label="{a.titulo}: {a.texto}. Abrir el chat"
      transition:scale={{ start: 0.3, opacity: 0, duration: quieto ? 0 : 280, easing: cubicOut }}
    >
      {#key a.serie}
        <span class="foto">
          <Avatar nombre={a.titulo} id={a.grupo ? "grupo" : a.chat} grupo={a.grupo} tam={abierta ? 40 : 22} />
        </span>
      {/key}
      {#if abierta}
        <span class="nombre"><strong>{a.titulo}</strong></span>
        <span class="meta">{a.cuantos > 1 ? `${a.cuantos} · ` : ""}ahora</span>
        <span class="texto">{a.texto}</span>
      {:else}
        <span class="cuenta">{esperando}</span>
      {/if}
    </button>
  {/if}
</div>

<style>
  .lugar {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    z-index: 4;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .isla {
    --alto-cerrada: 30px;
    /* Para poder animar hasta el alto del contenido. */
    interpolate-size: allow-keywords;
    pointer-events: auto;
    /* Cerrada, centrada en la cámara: de ahí crece y ahí se esconde. */
    margin-top: calc(var(--camara-centro) - var(--alto-cerrada) / 2);
    transform-origin: 50% 50%;
    width: 112px;
    height: var(--alto-cerrada);
    border-radius: 999px;
    background: #000000;
    color: #FFFFFF;
    overflow: hidden;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: var(--alto-cerrada);
    align-items: center;
    padding: 0 6px;
    box-shadow: 0 10px 30px -12px rgb(0 0 0 / 70%);
    transition:
      width 460ms cubic-bezier(0.2, 0.9, 0.25, 1.08),
      height 460ms cubic-bezier(0.2, 0.9, 0.25, 1.08),
      border-radius 460ms ease,
      margin-top 460ms cubic-bezier(0.2, 0.9, 0.25, 1.08),
      padding 460ms ease;
  }

  .isla.abierta {
    width: calc(100% - 14px);
    height: auto;
    margin-top: 6px;
    /* La cámara queda en la primera fila: si se esconde abierta, se esconde ahí. */
    transform-origin: 50% calc(var(--camara-centro) - 6px);
    border-radius: 30px;
    padding: 0 16px 13px 12px;
    /* La primera fila queda a la altura de la cámara; el texto, debajo. */
    grid-template-rows: calc((var(--camara-centro) - 6px) * 2) auto;
    column-gap: 10px;
    align-content: start;
  }

  .foto { grid-row: 1; display: grid; }
  .abierta .foto { grid-row: 1 / span 2; align-self: start; padding-top: 4px; }

  .nombre {
    grid-column: 2;
    min-width: 0;
    /* Que el nombre no se meta debajo de la cámara. */
    max-width: calc(50% - 30px);
    font-size: var(--t-meta);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nombre strong { font-weight: 600; }

  .meta {
    grid-column: 3;
    font-size: var(--t-micro);
    color: rgb(255 255 255 / 55%);
    font-variant-numeric: tabular-nums;
  }

  .texto {
    grid-column: 2 / span 2;
    grid-row: 2;
    font-size: var(--t-meta);
    line-height: 1.32;
    color: rgb(255 255 255 / 86%);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    animation: aparecer 300ms 120ms both;
  }

  .cuenta {
    grid-column: 3;
    min-width: 20px;
    padding: 0 6px;
    font-size: var(--t-micro);
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  @keyframes aparecer {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .isla { transition: none; }
    .texto { animation: none; }
  }
</style>
