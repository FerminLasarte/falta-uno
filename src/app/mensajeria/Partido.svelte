<!--
  El partido, contado. Después de las 21:00 el teléfono muestra la app del
  torneo: el marcador arriba y el relato debajo, que llega de a un momento, como
  un minuto a minuto. Cada momento dice, aparte y en gris, qué decisión tuya lo
  explica: la matemática del resultado es la misma, pero no se siente un dado.

  Los nombres se pintan con el color del estado de cada uno, como en la lista y
  el grupo. Lo único que se toca va entre los pulgares: ver todo de una, y al
  final volver al grupo.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { AGUANTE, type CierreFecha } from "../../core/campana.js";
  import type { Resolucion } from "../../core/resolucion.js";
  import Avatar from "./Avatar.svelte";
  import BotonPrincipal from "./BotonPrincipal.svelte";
  import Cabecera from "./Cabecera.svelte";
  import type { Vista } from "../estado/juego.svelte.js";
  import { NOMBRE_GRUPO, pesos, resaltarNombres } from "./rotulos.js";

  let {
    resolucion,
    torneo,
    colores,
    visto,
    cierre,
    volver,
    alVer,
    alSiguiente,
  }: {
    resolucion: Resolucion;
    torneo: Vista["torneo"];
    /** El color de cada nombre según su estado. */
    colores: ReadonlyMap<string, string>;
    /** Cuántos momentos ya viste antes: esos aparecen de una. */
    visto: number;
    /** Cómo cierra la fecha: va al final, cuando ya se contó todo. */
    cierre: CierreFecha | null;
    volver: { cuenta: number; alVolver: () => void };
    alVer: (cuantos: number) => void;
    /** Cerrar la fecha y pasar al viernes siguiente. */
    alSiguiente: () => void;
  } = $props();

  /** Lo que tarda en llegar cada momento. Lo justo para leerlo sin que se haga largo. */
  const PASO_MS = 1700;
  const PRIMERO_MS = 900;

  const momentos = $derived(resolucion.narracion);
  let mostrados = $state(untrack(() => visto));
  const terminado = $derived(!resolucion.hayPartido || mostrados >= momentos.length);
  const enPantalla = $derived(momentos.slice(0, mostrados));

  $effect(() => {
    if (terminado) return;
    const espera = mostrados === 0 ? PRIMERO_MS : PASO_MS;
    const reloj = setTimeout(() => {
      mostrados++;
      alVer(mostrados);
    }, espera);
    return () => clearTimeout(reloj);
  });

  function verTodo(): void {
    mostrados = momentos.length;
    alVer(mostrados);
  }

  /* El marcador va con el relato: cuenta los goles que ya se vieron. */
  const nuestros = $derived(enPantalla.filter((b) => b.gol === "favor").length);
  const suyos = $derived(enPantalla.filter((b) => b.gol === "contra").length);
  const estado = $derived.by(() => {
    if (terminado) return "Final";
    const ultimo = enPantalla.at(-1);
    return ultimo ? `En juego · ${ultimo.minuto}′` : "Por empezar";
  });

  let porQue = $state(false);

  const prestigio = $derived(
    `${resolucion.recompensa.prestigio > 0 ? "+" : "−"}${Math.abs(resolucion.recompensa.prestigio)} prestigio`,
  );

  /** "+$9.000", "−$15.000". */
  const conSigno = (monto: number): string => `${monto >= 0 ? "+" : "−"}${pesos(Math.abs(monto))}`;

  /*
    La cuenta de la fecha: con qué se llegó, lo que se juntó, la cancha (que se
    paga igual si no hubo partido), el premio, y cómo queda. Si queda deuda, qué
    pasa si se repite.
  */
  const cuenta = $derived.by(() => {
    if (!cierre) return null;
    const { inicial, juntado, sena, premio, campana } = cierre;
    const filas: { concepto: string; monto: string }[] = [];
    // En la primera fecha lo que había es tu plata; después, lo que quedó a favor de la anterior.
    const primera = campana.jugadas.length === 1;
    if (inicial > 0) filas.push({ concepto: primera ? "Tu plata" : "Tenían a favor", monto: pesos(inicial) });
    if (inicial < 0) filas.push({ concepto: "Debían de la fecha anterior", monto: conSigno(inicial) });
    filas.push({ concepto: "Juntaron entre todos", monto: pesos(juntado - inicial) });
    filas.push({ concepto: resolucion.hayPartido ? "La cancha" : "La cancha, igual", monto: conSigno(-sena) });
    if (premio > 0) filas.push({ concepto: "Premio por ganar", monto: conSigno(premio) });
    const total =
      campana.dinero >= 0
        ? { concepto: campana.fin ? "Les queda" : `Para la fecha ${campana.fecha}`, monto: pesos(campana.dinero) }
        : { concepto: "Le quedan debiendo al complejo", monto: pesos(-campana.dinero) };
    let aviso: string | null = null;
    if (campana.dinero < 0 && campana.fin === "bancarrota") aviso = "Es la segunda fecha seguida debiendo.";
    else if (campana.dinero < 0 && !campana.fin) {
      aviso = `Si la fecha ${campana.fecha} también termina debiendo, el complejo los saca del torneo.`;
    } else if (!campana.fin && campana.fechasSinPartido === AGUANTE.fechasSinPartido - 1) {
      aviso = "Una fecha más sin partido y el equipo se desarma.";
    }
    return { filas, total, aviso };
  });

  /* Lo último que llegó siempre a la vista. */
  let feed = $state<HTMLDivElement | null>(null);
  $effect(() => {
    void mostrados;
    if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  });
</script>

<div class="pantalla-app">
  <Cabecera titulo="{torneo.nombre} · {torneo.fecha}" subtitulo={torneo.cancha} {volver}>
    {#snippet avatar()}
      <Avatar nombre={torneo.fecha} id="torneo" tam={38} />
    {/snippet}
  </Cabecera>

  <section class="marcador" aria-label="Marcador">
    {#if resolucion.hayPartido}
      <div class="equipos">
        <span class="eq">{NOMBRE_GRUPO}</span>
        <span class="goles" aria-label="{nuestros} a {suyos}">{nuestros}<span>–</span>{suyos}</span>
        <span class="eq rival">{torneo.rival}</span>
      </div>
      <div class="estado">
        <b>{estado}</b>
        <button class="porque" onclick={() => (porQue = !porQue)} aria-expanded={porQue}>
          Salían con {resolucion.probabilidad}% · {porQue ? "cerrar" : "por qué"}
        </button>
      </div>
      {#if porQue}
        <ul class="desglose">
          {#each resolucion.desglose as d (d.concepto)}
            <li><span>{d.concepto}</span><span class="valor">{d.valor >= 0 ? "+" : "−"}{Math.abs(d.valor)}</span></li>
          {/each}
          <li class="total"><span>Probabilidad de ganar</span><span class="valor">{resolucion.probabilidad}%</span></li>
        </ul>
      {/if}
    {:else}
      <p class="sin-partido">No hubo partido</p>
      <p class="motivo">{resolucion.motivoSinPartido}</p>
    {/if}
  </section>

  <div class="feed" bind:this={feed}>
    <div class="hilo">
      <!-- Sin partido también se cuenta: quién faltó y qué hiciste para que faltara. -->
      {#each resolucion.porQueNo as m, i (i)}
        <article class="momento motivo">
          <span class="minuto">{m.hora ?? ""}</span>
          <p class="texto">
            {#each resaltarNombres(m.texto, colores) as t, j (j)}
              {#if t.color}<span class="nombre" style:color={t.color}>{t.texto}</span>{:else}{t.texto}{/if}
            {/each}
          </p>
          {#if m.porque}<p class="causa">{m.porque}</p>{/if}
        </article>
      {/each}
      {#each enPantalla as b, i (i)}
        <article class="momento" class:contra={b.signo < 0 && !b.gol} class:gol={b.gol === "favor"} class:final={terminado && i === momentos.length - 1}>
          <span class="minuto">{b.minuto}′{#if b.gol}<small class:de-ellos={b.gol === "contra"}>GOL</small>{/if}</span>
          <p class="texto">
            {#each resaltarNombres(b.texto, colores) as t, j (j)}
              {#if t.color}<span class="nombre" style:color={t.color}>{t.texto}</span>{:else}{t.texto}{/if}
            {/each}
          </p>
          {#if b.porque}<p class="causa">{b.porque}</p>{/if}
        </article>
      {/each}
      {#if terminado && cuenta}
        <section class="cuenta" aria-label="La cuenta de la fecha">
          <h3>La cuenta de la fecha</h3>
          {#each cuenta.filas as f (f.concepto)}
            <p class="fila"><span>{f.concepto}</span><b>{f.monto}</b></p>
          {/each}
          <p class="fila total"><span>{cuenta.total.concepto}</span><b>{cuenta.total.monto}</b></p>
          {#if cuenta.aviso}<p class="aviso">{cuenta.aviso}</p>{/if}
        </section>
      {/if}
    </div>
  </div>

  <div class="zona-pulgares">
    {#if terminado}
      <span class="saldo">{prestigio}</span>
      <BotonPrincipal accion={{ texto: "Al viernes que viene" }} alTocar={alSiguiente} />
    {:else}
      <button class="gesto" onclick={verTodo}>Ver todo</button>
    {/if}
  </div>
</div>

<style>
  .pantalla-app { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--app-papel); }

  .marcador {
    flex: none;
    position: relative;
    z-index: 2;
    padding: 14px var(--e3) 12px;
    background: var(--app-superficie);
    border-bottom: 1px solid var(--app-linea);
    box-shadow: var(--sombra-app);
  }
  .equipos { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; }
  .eq { font-family: var(--fuente-cromo); font-weight: 700; font-size: calc(14px * var(--escala-ui)); }
  .eq.rival { text-align: right; color: var(--app-tinta-2); }
  .goles {
    font-family: var(--fuente-cromo);
    font-weight: 800;
    font-size: calc(34px * var(--escala-ui));
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .goles span { margin: 0 6px; font-weight: 500; color: var(--app-tinta-3); }

  .estado { margin-top: 2px; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .estado b {
    font-size: calc(10.5px * var(--escala-ui));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .porque { font-size: calc(11.5px * var(--escala-ui)); color: var(--app-tinta-3); }
  .porque:hover { color: var(--app-tinta-2); }

  .desglose { margin: 10px 0 0; padding: 8px 0 0; list-style: none; border-top: 1px solid var(--app-linea); display: grid; gap: 3px; }
  .desglose li { display: flex; justify-content: space-between; gap: 12px; font-size: var(--t-meta); color: var(--app-tinta-2); }
  .desglose .valor { font-variant-numeric: tabular-nums; font-weight: 600; }
  .desglose .total { margin-top: 3px; padding-top: 5px; border-top: 1px solid var(--app-linea); color: var(--app-tinta); font-weight: 600; }

  .sin-partido { margin: 0; font-family: var(--fuente-cromo); font-size: calc(22px * var(--escala-ui)); font-weight: 800; letter-spacing: -0.01em; }
  .motivo { margin: 4px 0 0; font-size: var(--t-meta); line-height: 1.4; color: var(--app-tinta-2); }

  .feed { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; }
  .hilo { display: flex; flex-direction: column; gap: 6px; padding: 12px 12px 10px; }

  .momento {
    display: grid;
    grid-template-columns: 34px 1fr;
    column-gap: 8px;
    padding: 9px 12px 9px 6px;
    border-radius: 12px;
    background: var(--app-superficie);
    box-shadow: 0 1px 0 rgb(21 24 27 / 6%);
    animation: llegar 320ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }
  /* Lo que explica que no hubo partido lleva la hora, que es más ancha que un minuto. */
  .momento.motivo { grid-template-columns: 40px 1fr; }

  /* Lo que salió mal no se pinta de rojo, que es de los jugadores: se apaga. */
  .momento.contra { background: color-mix(in oklab, var(--app-superficie) 55%, var(--app-papel)); box-shadow: none; border: 1px dashed var(--app-linea); }
  .momento.gol .texto, .momento.final .texto { font-weight: 700; }

  .minuto {
    grid-row: 1 / span 2;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding-top: 1px;
    font-family: var(--fuente-cromo);
    font-size: calc(13px * var(--escala-ui));
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--app-tinta-2);
  }
  .minuto small { margin-top: 1px; font-size: calc(9px * var(--escala-ui)); font-weight: 800; letter-spacing: 0.1em; color: var(--app-tinta); }
  .minuto small.de-ellos { color: var(--app-tinta-3); }

  /* El texto del relato es para leer: no se degrada. */
  .texto { margin: 0; font-size: calc(14px * var(--escala-ui)); line-height: 1.38; }
  .nombre { font-weight: 700; }
  .causa {
    grid-column: 2;
    margin: 5px 0 0;
    display: flex;
    gap: 6px;
    font-size: calc(12px * var(--escala-ui));
    line-height: 1.3;
    color: var(--app-tinta-3);
  }
  .causa::before {
    content: "";
    flex: none;
    width: 9px;
    height: 9px;
    margin-top: -1px;
    border-left: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    border-bottom-left-radius: 3px;
  }

  .cuenta {
    margin-top: 4px;
    padding: 11px 14px 12px;
    border-radius: 12px;
    background: var(--app-superficie);
    box-shadow: 0 1px 0 rgb(21 24 27 / 6%);
    animation: llegar 320ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
  }
  .cuenta h3 {
    margin: 0 0 6px;
    font-size: calc(10.5px * var(--escala-ui));
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--app-tinta-3);
  }
  .cuenta .fila {
    margin: 0;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: calc(13px * var(--escala-ui));
    line-height: 1.6;
    color: var(--app-tinta-2);
    font-variant-numeric: tabular-nums;
  }
  .cuenta .total { margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--app-linea); font-weight: 700; color: var(--app-tinta); }
  .cuenta .aviso { margin: 6px 0 0; font-size: calc(12px * var(--escala-ui)); line-height: 1.35; color: var(--app-tinta-3); }

  .zona-pulgares {
    flex: none;
    min-height: var(--zona-pulgares);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding-top: 10px;
  }
  .saldo { display: flex; gap: 14px; font-size: var(--t-meta); font-weight: 600; color: var(--app-tinta-2); font-variant-numeric: tabular-nums; }
  .gesto { font-size: calc(12.5px * var(--escala-ui)); font-weight: 600; color: var(--app-tinta-3); padding: 6px 10px; }

  @keyframes llegar {
    from { opacity: 0; translate: 0 6px; }
    to { opacity: 1; translate: 0 0; }
  }
</style>
