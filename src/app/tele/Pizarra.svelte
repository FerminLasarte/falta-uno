<!--
  Cómo se juega es la pizarra del programa: una jugada por vez, con su dibujo en tiza,
  como el que explica el partido en el entretiempo. ←→ pasa de jugada; Esc vuelve al
  entretiempo, y eso lo atiende la placa.

  La tiza es la misma Archivo del juego con un filtro: el trazo tiembla y se come en
  granos. Los números (la hora, el plazo, los suplentes) salen de la configuración del
  modo que estás jugando, no del texto: así no quedan viejos.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { Reglas } from "../estado/reglas.js";

  let { reglas }: { reglas: Reglas } = $props();

  const jugadas = $derived([
    {
      titulo: "La lista",
      texto: `Tenés hasta las ${reglas.corte} para llenarla. Arriba del grupo ves qué puestos faltan; el torneo suma ${reglas.suplentes} suplentes, de cualquier puesto.`,
    },
    {
      titulo: "El reloj",
      texto: "Corre cuando hacés algo. Cada mensaje cuesta minutos, y lo ves antes de tocar. Leer no lo mueve.",
    },
    {
      titulo: "La moral",
      texto: "Se va con quejas, peleas y mensajes largos. Atender al que te reclama la recupera, pero cuesta reloj. En cero, apagás el celu.",
    },
    {
      titulo: "La seña",
      texto: "Se paga antes de entrar: tu parte, lo que pone cada uno y lo guardado de la campaña.",
    },
    {
      titulo: "El que duda",
      texto: `Si alguien avisa que no sabe si llega, tenés ${reglas.plazoDuda === null ? `hasta las ${reglas.revision}` : `${reglas.plazoDuda} minutos`} para llamarlo o buscar a otro.`,
    },
    {
      titulo: `Las ${reglas.revision}`,
      texto: "La cancha revisa la lista. Caen los que seguían dudando y los invitados que no vienen.",
    },
  ]);

  let pagina = $state(0);
  let pizarra = $state<HTMLElement>();
  const anterior = $derived(jugadas[pagina - 1]);
  const siguiente = $derived(jugadas[pagina + 1]);

  onMount(() => pizarra?.focus());

  function pasar(paso: number): void {
    pagina = Math.min(jugadas.length - 1, Math.max(0, pagina + paso));
  }

  function teclear(evento: KeyboardEvent): void {
    const paso = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (paso === 0) return;
    evento.preventDefault();
    pasar(paso);
  }
</script>

<svg width="0" height="0" class="definiciones" aria-hidden="true">
  <!-- Tiza: el trazo tiembla un poco y se come en granos, como cuando la tiza no agarra el pizarrón. -->
  <filter id="tiza" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="grano" />
    <feColorMatrix in="grano" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7" result="huecos" />
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="8" result="ondas" />
    <feDisplacementMap in="SourceGraphic" in2="ondas" scale="1.6" result="temblor" />
    <feComposite in="temblor" in2="huecos" operator="in" />
  </filter>
</svg>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="pizarra" bind:this={pizarra} tabindex="0" role="group" aria-label="Cómo se juega" onkeydown={teclear}>
  <span class="tiza amarilla numero">La pizarra · {pagina + 1} de {jugadas.length}</span>
  <h2 class="tiza titulo">{jugadas[pagina]!.titulo}</h2>
  <p class="tiza texto">{jugadas[pagina]!.texto}</p>

  <svg class="tiza dibujo" viewBox="0 0 250 170" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if pagina === 0}
      <!-- La lista del grupo, con los puestos que faltan. -->
      <rect x="40" y="12" width="150" height="146" rx="4" />
      <path d="M56 38 h12 M78 38 h70" /><path d="M56 62 h12 M78 62 h56" /><path d="M56 86 h12 M78 86 h76" /><path d="M56 110 h12" />
      <path d="M150 34 l6 6 l12 -14" /><path d="M140 58 l6 6 l12 -14" /><path d="M160 82 l6 6 l12 -14" />
      <rect x="76" y="100" width="40" height="18" rx="9" /><rect x="122" y="100" width="40" height="18" rx="9" />
      <text x="85" y="114" class="letra" font-size="11">ARQ</text><text x="130" y="114" class="letra" font-size="11">DEF</text>
    {:else if pagina === 1}
      <!-- Un mensaje que se vuelve minutos. -->
      <path d="M14 30 h92 a10 10 0 0 1 10 10 v28 a10 10 0 0 1 -10 10 h-70 l-14 12 v-12 h-8 a10 10 0 0 1 -10 -10 v-28 a10 10 0 0 1 10 -10 z" />
      <path d="M30 48 h64 M30 60 h40" />
      <path d="M120 56 C 140 50, 150 60, 160 76" /><path d="M152 74 l9 4 l1 -10" />
      <circle cx="196" cy="108" r="44" /><path d="M196 108 v-30 M196 108 l20 12" />
      <path d="M196 70 v6 M196 140 v6 M158 108 h6 M228 108 h6" />
      <text x="62" y="150" class="letra amarilla" font-size="24">+2 min</text>
    {:else if pagina === 2}
      <!-- La moral como una pila que se gasta con cada queja. -->
      <rect x="120" y="50" width="100" height="56" rx="6" /><rect x="220" y="66" width="10" height="24" rx="2" />
      <path d="M134 62 v32 M154 62 v32" stroke-width="10" />
      <path d="M22 30 h70 a10 10 0 0 1 10 10 v24 a10 10 0 0 1 -10 10 h-46 l-14 12 v-12 h-10 a10 10 0 0 1 -10 -10 v-24 a10 10 0 0 1 10 -10 z" />
      <text x="40" y="62" class="letra" font-size="22">!!</text>
      <path d="M100 76 C 108 80, 112 80, 118 76" /><path d="M110 72 l8 4 l-6 7" />
      <text x="168" y="138" class="letra amarilla" font-size="22">−1</text>
    {:else if pagina === 3}
      <!-- La plata de cada uno, que junta la seña. -->
      <ellipse cx="50" cy="128" rx="26" ry="8" /><path d="M24 128 v-14 M76 128 v-14" /><ellipse cx="50" cy="114" rx="26" ry="8" />
      <ellipse cx="50" cy="100" rx="26" ry="8" /><path d="M24 100 v14 M76 100 v14" />
      <rect x="92" y="34" width="70" height="38" rx="3" /><circle cx="127" cy="53" r="9" />
      <path d="M170 92 C 186 86, 196 84, 210 86" /><path d="M202 80 l9 6 l-8 7" />
      <rect x="184" y="98" width="56" height="44" rx="4" />
      <text x="190" y="126" class="letra amarilla" font-size="15">SEÑA</text>
    {:else if pagina === 4}
      <!-- El que avisa que no sabe si llega, y el tiempo para llamarlo. -->
      <path d="M14 24 h120 a10 10 0 0 1 10 10 v26 a10 10 0 0 1 -10 10 h-96 l-14 12 v-12 h-10 a10 10 0 0 1 -10 -10 v-26 a10 10 0 0 1 10 -10 z" />
      <text x="26" y="52" class="letra" font-size="15">no sé si llego…</text>
      <path d="M150 104 c -4 -10 2 -20 10 -22 l8 14 c -4 4 -4 10 0 16 c 4 6 10 8 16 6 l10 12 c -6 8 -18 10 -28 0 c -8 -8 -14 -18 -16 -26 z" />
      <circle cx="210" cy="52" r="28" /><path d="M210 52 v-18 M210 52 l12 8" />
      <text x="168" y="158" class="letra amarilla" font-size="20">{reglas.plazoDuda === null ? reglas.revision : `${reglas.plazoDuda} min`}</text>
    {:else}
      <!-- La revisión: la lista de la cancha, con uno que se cae. -->
      <rect x="30" y="20" width="110" height="140" rx="4" /><rect x="66" y="12" width="38" height="14" rx="3" />
      <path d="M46 50 l5 5 l10 -12 M68 50 h56" /><path d="M46 78 l5 5 l10 -12 M68 78 h50" />
      <path d="M46 106 l12 12 m0 -12 l-12 12 M68 112 h56" /><path d="M64 112 h64" stroke-width="2" />
      <path d="M46 134 l5 5 l10 -12 M68 134 h44" />
      <text x="150" y="98" class="letra amarilla" font-size="30">{reglas.revision}</text>
    {/if}
  </svg>

  <div class="pie">
    {#if anterior}<button class="tiza amarilla" onclick={() => pasar(-1)}>◀ {anterior.titulo}</button>{:else}<span></span>{/if}
    {#if siguiente}<button class="tiza amarilla" onclick={() => pasar(1)}>{siguiente.titulo} ▶</button>{/if}
  </div>
</div>

<style>
  .definiciones { position: absolute; }

  /* El pizarrón del programa, con su marco de madera y el polvo de lo que se borró. */
  .pizarra {
    position: absolute;
    left: 14px;
    right: 14px;
    top: 44px;
    bottom: 40px;
    padding: 14px 22px 12px;
    background: radial-gradient(120% 90% at 40% 30%, #34503F 0%, #2A4134 55%, #213428 100%);
    border: 7px solid #6B4B2E;
    border-radius: 3px;
    box-shadow: inset 0 0 30px rgb(0 0 0 / 45%), 0 4px 14px rgb(0 0 0 / 50%);
    outline: none;
  }
  .pizarra::before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0.5;
    background:
      radial-gradient(40% 25% at 70% 60%, rgb(255 255 255 / 7%), transparent),
      radial-gradient(30% 20% at 20% 75%, rgb(255 255 255 / 6%), transparent);
  }

  .tiza { filter: url(#tiza); color: #EFEDE4; font-family: var(--fuente-cromo); }
  .amarilla { color: #F3DD8A; }
  .letra { fill: currentColor; stroke: none; font-family: var(--fuente-cromo); font-weight: 800; font-stretch: 80%; }
  text.amarilla { fill: #F3DD8A; }

  .numero { position: absolute; left: 22px; top: 14px; font-size: 15px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
  .titulo {
    position: absolute;
    left: 22px;
    top: 38px;
    margin: 0;
    font-size: 40px;
    font-weight: 800;
    font-stretch: 80%;
    line-height: 1;
    text-transform: uppercase;
  }
  .texto {
    position: absolute;
    left: 22px;
    top: 92px;
    width: 240px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    font-stretch: 80%;
    line-height: 1.3;
  }
  .dibujo { position: absolute; right: 20px; top: 12px; width: 250px; height: 170px; }

  .pie {
    position: absolute;
    left: 22px;
    right: 22px;
    bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  /* Las flechas vienen de otra tipografía y suben la línea: con alto fijo, los dos lados quedan parejos. */
  .pie button { font: inherit; font-size: 14px; font-weight: 700; line-height: 18px; }
</style>
