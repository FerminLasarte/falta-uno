<!--
  El menú del juego es lo que pasa en la tele cuando levantás la vista del celular: una
  placa de entretiempo de la transmisión, con el viernes en pausa. Esc lo abre y lo
  cierra, y mientras está abierto el tiempo real no corre. Lo pone en la pantalla de la
  tele Escena.svelte, con la perspectiva del render; acá se diseña plano, a 588 × 336.

  Se maneja con flechas y Enter (y con el mouse): es lo que después toma el gamepad en la
  Deck. Las opciones van numeradas, como una formación. Empezar otra campaña pide
  confirmación. Exportar partidas abre el diálogo del sistema y después dice cómo salió,
  en la misma placa.
-->
<script lang="ts" module>
  /** Quién juega esta noche y en qué: arriba, como el marcador de la transmisión. */
  export interface Marcador {
    readonly local: string;
    readonly rival: string;
    readonly competencia: string;
    readonly fecha: string;
  }
</script>

<script lang="ts">
  import { tick } from "svelte";
  import type { ResultadoExportacion } from "../../electron/canal.js";

  let {
    estado,
    marcador,
    version,
    puedeEmpezarOtra,
    hayQuePerder,
    alSeguir,
    alCampanaNueva,
    alExportar,
    alMostrarExportacion,
    alSalir,
  }: {
    /** Dónde estás: el perfil, la fecha y la hora. */
    estado: string;
    /** Antes de arrancar no hay partido que mostrar. */
    marcador: Marcador | null;
    /** La versión del build, para saber qué jugó cada tester. */
    version: string;
    /** Sin una campaña en curso no hay nada que perder ni que empezar de nuevo. */
    puedeEmpezarOtra: boolean;
    /** Si hay una campaña en juego que se perdería. Terminada, se empieza otra sin preguntar. */
    hayQuePerder: boolean;
    alSeguir: () => void;
    alCampanaNueva: () => void;
    alExportar: () => Promise<ResultadoExportacion>;
    alMostrarExportacion: () => void;
    alSalir: () => void;
  } = $props();

  /** Las opciones, la confirmación de campaña nueva o cómo salió la exportación. */
  type Paso =
    | { tipo: "opciones" }
    | { tipo: "confirmando" }
    | { tipo: "exportada"; resultado: Exclude<ResultadoExportacion, { estado: "cancelado" }> };

  interface Opcion {
    readonly texto: string;
    readonly hacer: () => void;
  }

  let paso = $state<Paso>({ tipo: "opciones" });
  /** Con el diálogo del sistema abierto, un segundo Enter no abre otro. */
  let exportando = false;
  let lista = $state<HTMLElement>();

  const botones = (): HTMLButtonElement[] => [...(lista?.querySelectorAll<HTMLButtonElement>("button") ?? [])];

  /** Qué opción queda elegida después de cambiar de lista: al volver, la de la que saliste. */
  let elegida = 0;

  /* Al abrir, al pasar de una lista a otra y al volver, queda elegida la que corresponde. */
  $effect(() => {
    void paso;
    void tick().then(() => botones()[elegida]?.focus());
  });

  function irA(destino: Paso, enfocada: number): void {
    elegida = enfocada;
    paso = destino;
  }

  /* Las posiciones de la lista de opciones, que cambia si no hay campaña nueva. */
  const enCampanaNueva = 1;
  const enExportar = $derived(puedeEmpezarOtra ? 2 : 1);

  function empezarOtra(): void {
    if (!hayQuePerder) return alCampanaNueva();
    irA({ tipo: "confirmando" }, 0);
  }

  async function exportar(): Promise<void> {
    if (exportando) return;
    exportando = true;
    try {
      const resultado = await alExportar();
      // Cancelar el diálogo es volver a donde estabas, sin nada que contar.
      if (resultado.estado === "cancelado") irA({ tipo: "opciones" }, enExportar);
      else irA({ tipo: "exportada", resultado }, 0);
    } finally {
      exportando = false;
    }
  }

  const viernes = (n: number): string => (n === 1 ? "1 viernes exportado" : `${n} viernes exportados`);
  const volverAOpciones = (): void => irA({ tipo: "opciones" }, enExportar);

  /** El título grande de la placa, lo que se lee al costado y las opciones de cada paso. */
  const placa = $derived.by((): { titulo: string; aparte: string; archivo?: string; opciones: Opcion[] } => {
    if (paso.tipo === "confirmando") {
      return {
        titulo: "¿Campaña nueva?",
        aparte: "Se pierde la que estás jugando.",
        opciones: [
          { texto: "Empezar otra", hacer: alCampanaNueva },
          { texto: "No, seguir con esta", hacer: () => irA({ tipo: "opciones" }, enCampanaNueva) },
        ],
      };
    }
    if (paso.tipo === "exportada") {
      const resultado = paso.resultado;
      if (resultado.estado === "listo") {
        return {
          titulo: "Exportado",
          aparte: `${viernes(resultado.cantidad)}. Quedó en ${resultado.carpeta}:`,
          archivo: resultado.archivo,
          opciones: [
            { texto: "Mostrar el archivo", hacer: alMostrarExportacion },
            { texto: "Volver", hacer: volverAOpciones },
          ],
        };
      }
      if (resultado.estado === "sin-partidas") {
        return {
          titulo: "Sin partidas",
          aparte: "Cada viernes que jugás se guarda solo. Jugá uno y volvé.",
          opciones: [{ texto: "Volver", hacer: volverAOpciones }],
        };
      }
      return {
        titulo: "No se pudo exportar",
        aparte: "Probá guardarlo en otra carpeta.",
        opciones: [
          { texto: "Probar de nuevo", hacer: () => void exportar() },
          { texto: "Volver", hacer: volverAOpciones },
        ],
      };
    }
    return {
      titulo: "Entretiempo",
      aparte: "El viernes está en pausa.\nEsc para volver al celu.",
      opciones: [
        { texto: "Seguir", hacer: alSeguir },
        ...(puedeEmpezarOtra ? [{ texto: "Campaña nueva", hacer: empezarOtra }] : []),
        { texto: "Exportar partidas", hacer: () => void exportar() },
        { texto: "Salir", hacer: alSalir },
      ],
    };
  });

  function mover(evento: KeyboardEvent): void {
    const todos = botones();
    const actual = todos.indexOf(document.activeElement as HTMLButtonElement);
    const paso = evento.key === "ArrowDown" ? 1 : evento.key === "ArrowUp" ? -1 : 0;
    if (paso === 0) return;
    evento.preventDefault();
    todos[(actual + paso + todos.length) % todos.length]?.focus();
  }

  const enfocar = (e: MouseEvent): void => (e.currentTarget as HTMLButtonElement).focus();
</script>

<div class="placa-tv" role="dialog" aria-modal="true" aria-label="Menú">
  <div class="marcador">
    {#if marcador}
      <span class="equipo">{marcador.local}</span><span class="hora">21 HS</span><span class="equipo">{marcador.rival}</span>
    {:else}
      <span class="equipo">Falta Uno</span>
    {/if}
  </div>
  {#if marcador}
    <div class="mosca"><b>{marcador.competencia}</b>{marcador.fecha}</div>
  {/if}

  <p class="titulo">{placa.titulo}</p>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="lista" bind:this={lista} onkeydown={mover}>
    {#each placa.opciones as opcion, i (opcion.texto)}
      <button class="opcion" onmouseenter={enfocar} onclick={opcion.hacer}>
        <b class="numero">{i + 1}</b><span class="texto">{opcion.texto}</span>
      </button>
    {/each}
  </div>

  <p class="aparte">
    {placa.aparte}
    {#if placa.archivo}<span class="archivo">{placa.archivo}</span>{/if}
  </p>

  <div class="zocalo">
    <span class="en-pausa">En pausa</span><span class="estado">{estado}<i>·</i>{version}</span>
  </div>
</div>

<style>
  /*
    Una placa de canal de cable de barrio, propia: condensada y en cursiva, rojo, amarillo y
    blanco sobre el partido apagado. Ninguna marca de una transmisión real.
  */
  .placa-tv {
    position: absolute;
    inset: 0;
    overflow: hidden;
    font-family: var(--fuente-cromo);
    font-stretch: 72%;
    color: #FFFFFF;
    --rojo: #C8341F;
    --amarillo: #F2C230;
    --tinta: #15181B;
    --papel: #F4F1E8;
  }
  /* El partido sigue atrás, congelado y apagado. */
  .placa-tv::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgb(8 10 9 / 58%);
  }
  /* Que se vea en la tele: líneas, el borde que oscurece y un reflejo del living. */
  .placa-tv::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(115deg, rgb(255 255 255 / 6%) 0 30%, transparent 30%),
      repeating-linear-gradient(180deg, transparent 0 2px, rgb(0 0 0 / 12%) 2px 3px),
      radial-gradient(120% 120% at 50% 45%, transparent 60%, rgb(0 0 0 / 35%));
  }

  .marcador {
    position: absolute;
    left: 18px;
    top: 16px;
    display: flex;
    transform: skewX(-10deg);
    font-size: 13px;
    font-weight: 800;
    font-style: italic;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .marcador span { padding: 3px 8px 2px; white-space: nowrap; }
  .equipo { background: var(--tinta); }
  .hora { background: var(--papel); color: var(--tinta); font-variant-numeric: tabular-nums; }

  .mosca {
    position: absolute;
    right: 16px;
    top: 14px;
    text-align: right;
    font-size: 11px;
    font-weight: 800;
    font-style: italic;
    letter-spacing: 0.08em;
    line-height: 1.15;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .mosca b { display: block; font-size: 17px; font-weight: 900; letter-spacing: -0.01em; }

  .titulo {
    position: absolute;
    left: 24px;
    top: 50px;
    margin: 0;
    font-size: 34px;
    font-weight: 900;
    font-style: italic;
    letter-spacing: -0.01em;
    line-height: 1;
    text-transform: uppercase;
    text-shadow: 0 0 10px rgb(255 255 255 / 25%);
  }
  .titulo::after {
    content: "";
    display: block;
    width: 96px;
    height: 5px;
    margin-top: 5px;
    background: var(--amarillo);
    transform: skewX(-20deg);
  }

  .lista {
    position: absolute;
    left: 24px;
    top: 104px;
    width: 250px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .opcion {
    display: grid;
    grid-template-columns: 26px 1fr;
    align-items: stretch;
    height: 24px;
    padding: 0;
    transform: skewX(-10deg);
    background: rgb(21 24 27 / 82%);
    color: #FFFFFF;
    font: inherit;
    font-size: 15.5px;
    font-weight: 700;
    text-align: left;
    transition: translate 140ms ease, background 120ms ease;
  }
  .numero {
    display: grid;
    place-items: center;
    background: rgb(255 255 255 / 12%);
    font-size: 13px;
    font-weight: 800;
    font-style: italic;
    font-variant-numeric: tabular-nums;
  }
  .texto { display: flex; align-items: center; padding-left: 9px; transform: skewX(10deg); }

  /* La elegida se ve sin depender del hover: con teclado y gamepad no hay mouse. */
  .opcion:focus {
    outline: none;
    background: var(--amarillo);
    color: var(--tinta);
    translate: 10px 0;
    box-shadow: -10px 0 0 var(--rojo);
  }
  .opcion:focus .numero { background: var(--rojo); color: #FFFFFF; }

  .aparte {
    position: absolute;
    right: 22px;
    top: 136px;
    width: 220px;
    margin: 0;
    text-align: right;
    font-size: 14px;
    font-weight: 700;
    font-style: italic;
    line-height: 1.35;
    color: rgb(255 255 255 / 66%);
    /* Los cortes de línea los decide el texto: un "celu." solo en un renglón queda mal. */
    white-space: pre-line;
  }
  /* El nombre del archivo, para reconocerlo en la carpeta: entero, aunque no entre en una línea. */
  .archivo { display: block; margin-top: 4px; color: #FFFFFF; overflow-wrap: anywhere; }

  .zocalo {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 10px;
    height: 22px;
    display: flex;
    align-items: stretch;
    font-size: 13px;
    font-weight: 700;
    font-style: italic;
  }
  .en-pausa {
    display: flex;
    align-items: center;
    padding: 0 12px 0 18px;
    background: var(--rojo);
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .estado {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    background: rgb(244 241 232 / 94%);
    color: var(--tinta);
    white-space: nowrap;
    overflow: hidden;
  }
  .estado i { font-style: normal; color: #8D959D; }
</style>
