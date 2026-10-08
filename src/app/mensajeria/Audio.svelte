<!--
  Un audio del grupo, adentro de su burbuja. Escucharlo cuesta reloj, y el costo
  se ve antes de tocar, como en cualquier respuesta. Mientras suena se oye un
  murmullo que no se entiende; cuando termina, queda escrito lo que dijo.
-->
<script lang="ts" module>
  export type EstadoAudio = "nuevo" | "escuchando" | "escuchado";
</script>

<script lang="ts">
  import { formaDeOnda } from "../sonido/sintesis.js";
  import { duracionAudio } from "./rotulos.js";

  let {
    semilla,
    segundos,
    tonoHz,
    costo,
    estado,
    progreso = 0,
    transcripcion,
    alEscuchar,
  }: {
    /** Identifica al audio: de ahí salen su murmullo y su forma de onda. */
    semilla: string;
    /** Lo que dura el audio, como lo diría el teléfono. */
    segundos: number;
    /** La voz de quien lo mandó. */
    tonoHz: number;
    /** Minutos de reloj que cuesta escucharlo. */
    costo: number;
    estado: EstadoAudio;
    /** De 0 a 1, mientras suena. */
    progreso?: number;
    transcripcion: string;
    alEscuchar: () => void;
  } = $props();

  const BARRAS = 30;
  const ondas = $derived(formaDeOnda(semilla, segundos, tonoHz, BARRAS));
  /* Solo mientras suena se marca lo sonado. Ya escuchado, lo que importa es lo que dijo. */
  const sonadas = $derived(estado === "escuchando" ? Math.floor(progreso * BARRAS) : 0);

  const duracion = $derived(duracionAudio(estado === "escuchando" ? progreso * segundos : segundos));
</script>

<div class="audio" class:nuevo={estado === "nuevo"}>
  <div class="reproductor">
    <button
      class="boton"
      onclick={alEscuchar}
      disabled={estado !== "nuevo"}
      aria-label={estado === "nuevo" ? `Escuchar el audio, ${costo} min` : "Audio escuchado"}
    >
      {#if estado === "escuchando"}
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="6" width="3.6" height="12" rx="1" /><rect x="13.4" y="6" width="3.6" height="12" rx="1" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.8v12.4c0 .8.9 1.3 1.6.8l9.3-6.2c.6-.4.6-1.2 0-1.6l-9.3-6.2c-.7-.5-1.6 0-1.6.8z" /></svg>
      {/if}
    </button>
    <span class="ondas" aria-hidden="true">
      {#each ondas as nivel, i (i)}
        <i class:sonada={i < sonadas} style:--nivel={nivel}></i>
      {/each}
    </span>
  </div>
  <div class="pie">
    <span class="duracion">{#if estado === "nuevo"}<b class="punto"></b>{/if}{duracion}</span>
    {#if estado === "nuevo"}<span class="costo">escuchar · {costo} min</span>{/if}
  </div>
  {#if estado === "escuchado"}
    <p class="transcripcion">{transcripcion}</p>
  {/if}
</div>

<style>
  .audio { display: flex; flex-direction: column; gap: 2px; }

  .reproductor { display: flex; align-items: center; gap: 10px; }

  .boton {
    flex: none;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--app-linea);
    color: var(--app-tinta-2);
  }
  .nuevo .boton { background: var(--app-cromo); color: #FFFFFF; }
  .boton svg { width: 18px; height: 18px; fill: currentColor; }
  .boton:disabled { cursor: default; }

  .ondas {
    flex: 1;
    height: 28px;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .ondas i {
    flex: 1;
    min-width: 2px;
    height: calc(12% + var(--nivel) * 88%);
    border-radius: 2px;
    background: color-mix(in oklab, var(--app-tinta-3) 55%, transparent);
    transition: background 120ms linear;
  }
  .ondas i.sonada { background: var(--app-tinta-2); }

  .pie {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    /* Alineado con las ondas, no con el botón. */
    padding-left: 44px;
    font-size: calc(10.5px * var(--escala-ui));
    color: var(--app-tinta-3);
    font-variant-numeric: tabular-nums;
  }
  .duracion { display: inline-flex; align-items: center; gap: 5px; }
  /* Sin escuchar: un punto, como en cualquier app. */
  .punto { width: 6px; height: 6px; border-radius: 50%; background: var(--app-tinta-2); }
  .costo { font-weight: 600; }

  .transcripcion {
    margin: 6px 0 0;
    padding-top: 6px;
    border-top: 1px solid var(--app-linea);
    font-size: var(--t-mensaje);
    /* Es texto que el jugador tiene que leer: no se degrada. */
    line-height: 1.38;
    color: var(--app-tinta);
  }

  @media (prefers-reduced-motion: reduce) {
    .ondas i { transition: none; }
  }
</style>
