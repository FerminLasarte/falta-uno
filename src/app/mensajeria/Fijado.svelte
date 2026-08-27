<!--
  El HUD de roster, fijado arriba de la lista como el mensaje anclado de un
  grupo. El diseño pide que esté SIEMPRE visible y sin un click de por medio:
  es la información central del juego.
-->
<script lang="ts">
  import type { VistaRoster } from "../../core/partida.js";

  let { roster, dinero, sena }: { roster: VistaRoster; dinero: number; sena: number } = $props();

  const completo = $derived(roster.confirmados >= roster.necesarios);
  const alcanza = $derived(dinero >= sena);

  /* Abreviado: el renglón tiene que entrar de una línea o deja de ser un HUD. */
  const CORTO: Record<string, string> = {
    arquero: "ARQ",
    defensor: "DEF",
    mediocampista: "MED",
    delantero: "DEL",
  };
</script>

<div class="fijado" class:completo>
  <div class="cabecera">
    <span class="grupo">Los Pibes F5</span>
    <span class="chincheta" aria-hidden="true">📌</span>
  </div>

  <div class="cuenta">
    <span class="numero">{roster.confirmados}<span class="de">/{roster.necesarios}</span></span>
    <div class="detalle">
      {#if completo}
        <span class="listo">Están los diez</span>
      {:else}
        <span class="faltan">
          {#each roster.faltantes as f (f.rol)}
            <span class="chip">{f.faltan} {CORTO[f.rol] ?? f.rol}</span>
          {/each}
        </span>
      {/if}
      <span class="plata" class:corto={!alcanza}>
        ${dinero.toLocaleString("es-AR")} de ${sena.toLocaleString("es-AR")} de seña
      </span>
    </div>
  </div>

  <div class="progreso" aria-hidden="true">
    <span style="width: {Math.min(100, (roster.confirmados / roster.necesarios) * 100)}%"></span>
  </div>
</div>

<style>
  .fijado {
    flex: none;
    padding: var(--e2) var(--e3);
    background: var(--app-superficie);
    border-bottom: 1px solid var(--app-linea);
    box-shadow: var(--sombra-app);
    position: relative;
    z-index: 2;
  }

  .cabecera { display: flex; align-items: center; justify-content: space-between; }

  .grupo {
    font-size: var(--t-micro);
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: var(--app-tinta-3);
  }
  .chincheta { font-size: var(--t-micro); opacity: 0.55; filter: saturate(var(--sat)); }

  .cuenta { display: flex; align-items: baseline; gap: var(--e2); margin-top: var(--e0); }

  .numero {
    font-family: var(--fuente-cromo);
    font-size: calc(30px * var(--escala-ui));
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    color: var(--app-tinta);
  }
  .de { font-size: calc(17px * var(--escala-ui)); color: var(--app-tinta-3); font-weight: 600; }
  .completo .numero { color: var(--est-confirmado); }

  .detalle { display: flex; flex-direction: column; gap: 1px; min-width: 0; }

  .faltan { display: flex; flex-wrap: wrap; gap: var(--e0); }
  .chip {
    font-size: var(--t-micro);
    font-weight: 700;
    letter-spacing: 0.05em;
    font-variant-numeric: tabular-nums;
    color: var(--est-esperando);
    background: color-mix(in oklab, var(--est-esperando) 12%, transparent);
    border-radius: var(--radio-chip);
    padding: 2px 7px;
  }
  .listo { font-size: var(--t-meta); color: var(--est-confirmado); font-weight: 600; }

  .plata { font-size: var(--t-micro); color: var(--app-tinta-3); font-variant-numeric: tabular-nums; }
  .corto { color: var(--est-rechazado); }

  .progreso {
    margin-top: var(--e1);
    height: 3px;
    border-radius: 2px;
    background: var(--app-linea);
    overflow: hidden;
  }
  .progreso span {
    display: block;
    height: 100%;
    background: var(--est-confirmado);
    border-radius: 2px;
    transition: width 260ms ease;
  }
</style>
