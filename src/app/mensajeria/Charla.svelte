<!--
  Una conversación: burbujas tuyas y de los demás, y los avisos del sistema como
  píldoras al centro. No sabe de qué chat se trata: recibe los eventos ya
  filtrados. Los mensajes seguidos de la misma persona se agrupan, como en una
  app de verdad, y siempre se ve lo último que llegó.

  Un audio se escucha tocándolo: el núcleo cobra el reloj en el momento, y acá
  suena el murmullo unos segundos antes de que aparezca lo que dijo.
-->
<script lang="ts">
  import type { EventoFeed } from "../../core/partida.js";
  import { formatearHora } from "../../core/tiempo.js";
  import { segundosDeEscucha } from "../sonido/sintesis.js";
  import { sonido } from "../sonido/sonido.js";
  import Audio, { type EstadoAudio } from "./Audio.svelte";

  let {
    eventos,
    escribiendo = null,
    mostrarNombres = false,
    colorDe = () => null,
    escuchados = new Set(),
    alEscuchar = () => {},
  }: {
    eventos: readonly EventoFeed[];
    /** Quién está escribiendo en esta conversación ahora mismo. */
    escribiendo?: string | null;
    /** En el grupo hay que saber quién habla; en un chat privado sobra. */
    mostrarNombres?: boolean;
    /** El color del nombre de cada uno según su estado. */
    colorDe?: (nombre: string) => string | null;
    /** Los audios que ya escuchaste: muestran lo que dijeron. */
    escuchados?: ReadonlySet<string>;
    /** Escuchar un audio cuesta reloj: eso lo decide el núcleo. */
    alEscuchar?: (audioId: string) => void;
  } = $props();

  type Item =
    | {
        tipo: "burbuja";
        propio: boolean;
        de: string;
        texto: string;
        minuto: number;
        sigue: boolean;
        audio: EventoFeed["audio"];
        cita: EventoFeed["cita"];
      }
    | { tipo: "aviso"; alerta: boolean; cierre: boolean; texto: string };

  const items = $derived.by((): Item[] => {
    const salida: Item[] = [];
    let anterior: string | null = null;
    for (const e of eventos) {
      const propio = e.clase === "propio";
      const deAlguien = propio || e.clase === "mensaje" || e.de !== "Sistema";
      if (!deAlguien) {
        salida.push({ tipo: "aviso", alerta: e.clase === "alerta", cierre: e.cierre === true, texto: e.texto });
        anterior = null;
        continue;
      }
      const quien = propio ? "Vos" : e.de;
      salida.push({
        tipo: "burbuja",
        propio,
        de: quien,
        texto: e.texto,
        minuto: e.minuto,
        sigue: anterior === quien,
        audio: e.audio,
        cita: e.cita,
      });
      anterior = quien;
    }
    return salida;
  });

  let contenedor = $state<HTMLDivElement | null>(null);

  /* Lo que está sonando: cuánto lleva cada audio, de 0 a 1, y cómo cortarlo. */
  let sonando = $state<Record<string, number>>({});
  const cortes = new Map<string, () => void>();

  function estadoDe(audioId: string): EstadoAudio {
    if (audioId in sonando) return "escuchando";
    return escuchados.has(audioId) ? "escuchado" : "nuevo";
  }

  function escuchar(audio: NonNullable<EventoFeed["audio"]>): void {
    alEscuchar(audio.id);
    // Si el núcleo no lo dejó (se terminó el viernes, por ejemplo), no suena nada.
    if (!escuchados.has(audio.id)) return;
    const dura = segundosDeEscucha(audio.segundos);
    cortes.set(audio.id, sonido.murmurar(audio.id, dura, audio.voz));
    sonando[audio.id] = 0;
    const inicio = performance.now();
    const cuadro = (): void => {
      if (!(audio.id in sonando)) return;
      const progreso = Math.min(1, (performance.now() - inicio) / (dura * 1000));
      sonando[audio.id] = progreso;
      if (progreso < 1) {
        requestAnimationFrame(cuadro);
        return;
      }
      delete sonando[audio.id];
      cortes.delete(audio.id);
      // Lo que dijo aparece abajo de la burbuja: que no quede tapado. Se mueve
      // solo el chat; scrollIntoView arrastraría también la escena.
      requestAnimationFrame(() => {
        const burbuja = contenedor?.querySelector<HTMLElement>(`[data-audio="${audio.id}"]`);
        if (!contenedor || !burbuja) return;
        const sobra = burbuja.getBoundingClientRect().bottom - contenedor.getBoundingClientRect().bottom;
        if (sobra > 0) contenedor.scrollBy({ top: sobra / escalaDe(contenedor) + 10, behavior: "smooth" });
      });
    };
    requestAnimationFrame(cuadro);
  }

  /** La app está escalada al hueco de la pantalla: los rectángulos vienen en píxeles de la ventana. */
  function escalaDe(elemento: HTMLElement): number {
    return elemento.getBoundingClientRect().height / elemento.offsetHeight || 1;
  }

  /* Si te vas del chat con un audio sonando, se corta. */
  $effect(() => () => {
    for (const cortar of cortes.values()) cortar();
  });

  /*
    Lo último que llegó siempre a la vista, como cuando abrís un chat. Pero si
    subiste a leer algo de antes, lo que llega no te arrastra para abajo: el
    grupo habla todo el tiempo.
  */
  let alFondo = true;
  const CERCA_DEL_FONDO = 48;
  $effect.pre(() => {
    void items.length;
    void escribiendo;
    if (contenedor) {
      alFondo = contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight < CERCA_DEL_FONDO;
    }
  });
  $effect(() => {
    void items.length;
    void escribiendo;
    if (contenedor && alFondo) contenedor.scrollTop = contenedor.scrollHeight;
  });
</script>

<div class="charla" bind:this={contenedor}>
  <div class="hilo">
    <span class="dia">HOY</span>
    {#each items as item, i (i)}
      {#if item.tipo === "aviso"}
        <span class="aviso" class:alerta={item.alerta} class:cierre={item.cierre}>{item.texto}</span>
      {:else}
        <div class="msj" class:propio={item.propio} class:sigue={item.sigue} class:es-audio={item.audio} data-audio={item.audio?.id}>
          {#if mostrarNombres && !item.propio && !item.sigue}
            <span class="nom" style:color={colorDe(item.de)}>{item.de}</span>
          {/if}
          {#if item.cita}
            <span class="cita" style:--color-cita={colorDe(item.cita.de) ?? "var(--app-tinta-3)"}>
              <b>{item.cita.de}</b>
              <span>{item.cita.texto}</span>
            </span>
          {/if}
          {#if item.audio}
            {@const audio = item.audio}
            <Audio
              semilla={audio.id}
              segundos={audio.segundos}
              tonoHz={audio.voz}
              costo={audio.costo}
              estado={estadoDe(audio.id)}
              progreso={sonando[audio.id] ?? 0}
              transcripcion={item.texto}
              alEscuchar={() => escuchar(audio)}
            />
            <span class="meta solo">{formatearHora(item.minuto)}</span>
          {:else}
            {item.texto}<span class="meta">{formatearHora(item.minuto)}{#if item.propio}<span class="visto" aria-label="visto">✓✓</span>{/if}</span>
          {/if}
        </div>
      {/if}
    {/each}
    {#if escribiendo}
      {@const sigue = items.at(-1)?.tipo === "burbuja" && (items.at(-1) as { de: string }).de === escribiendo}
      <div class="msj tipeando" class:sigue role="status" aria-label="{escribiendo} está escribiendo">
        {#if mostrarNombres && !sigue}
          <span class="nom" style:color={colorDe(escribiendo)}>{escribiendo}</span>
        {/if}
        <span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
    {/if}
  </div>
</div>

<style>
  .charla {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    background: var(--app-papel);
  }

  /* El hilo se apoya abajo: con pocos mensajes, quedan cerca de las respuestas. */
  .hilo {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 5px;
    padding: 10px 12px 10px;
  }

  .dia,
  .aviso {
    align-self: center;
    margin: 3px 0;
    padding: 4px 10px;
    border-radius: 8px;
    background: color-mix(in oklab, var(--app-superficie) 72%, transparent);
    font-size: calc(11.5px * var(--escala-ui));
    color: var(--app-tinta-2);
    text-align: center;
    max-width: 88%;
  }
  .dia { padding: 3px 10px; font-weight: 600; letter-spacing: 0.06em; font-size: var(--t-micro); }
  .aviso.alerta { color: var(--est-rechazado); font-weight: 600; }
  /* Las 21:00: el último aviso del viernes, que se lea como un sello y no como uno más. */
  .aviso.cierre {
    margin-top: 8px;
    font-weight: 700;
    color: var(--app-tinta);
    background: var(--app-superficie);
    box-shadow: 0 1px 0 rgb(21 24 27 / 6%);
  }

  .msj {
    align-self: flex-start;
    max-width: 82%;
    padding: 6px 9px 5px;
    border-radius: 12px;
    border-top-left-radius: 4px;
    background: var(--app-superficie);
    box-shadow: 0 1px 0 rgb(21 24 27 / 6%);
    font-size: var(--t-mensaje);
    /* El texto que el jugador tiene que leer nunca se degrada. */
    line-height: 1.38;
    overflow-wrap: anywhere;
  }
  .msj.sigue { border-top-left-radius: 12px; }
  .msj.propio {
    align-self: flex-end;
    background: var(--app-propio);
    border-top-left-radius: 12px;
    border-top-right-radius: 4px;
  }
  .msj.propio.sigue { border-top-right-radius: 12px; }

  .nom {
    display: block;
    margin-bottom: 1px;
    font-size: calc(12px * var(--escala-ui));
    font-weight: 700;
    color: var(--app-tinta-3);
  }

  .meta {
    float: right;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin: 6px 0 -3px 10px;
    font-size: calc(10.5px * var(--escala-ui));
    color: var(--app-tinta-3);
    font-variant-numeric: tabular-nums;
  }
  .visto { color: var(--est-hablando); letter-spacing: -0.25em; margin-right: 0.25em; }
  .meta.solo { float: none; display: flex; justify-content: flex-end; margin: 2px 0 0; }

  /* Un audio ocupa casi todo el ancho, como en cualquier app: la forma de onda necesita lugar. */
  .msj.es-audio { width: 78%; padding: 7px 10px 6px 8px; }
  .es-audio .nom { margin-bottom: 4px; }

  /* La respuesta citada: así se ve que uno le contesta al otro, que es como se ve un roce. */
  .cita {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin: 2px 0 5px;
    padding: 4px 8px 5px;
    border-left: 3px solid var(--color-cita);
    border-radius: 6px;
    background: color-mix(in oklab, var(--app-papel) 80%, var(--app-superficie));
    font-size: var(--t-meta);
    line-height: 1.3;
  }
  .cita b { font-size: calc(11.5px * var(--escala-ui)); color: var(--color-cita); }
  .cita span {
    color: var(--app-tinta-2);
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Los tres puntos de alguien escribiendo: laten de a uno, como en cualquier app. */
  /* Mismo alto que un mensaje de un renglón: cuando llega, la burbuja no salta. */
  .puntos { display: flex; align-items: center; gap: 4px; height: calc(var(--t-mensaje) * 1.38); padding: 0 2px; }
  .puntos i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--app-tinta-3);
    animation: latir 1.2s ease-in-out infinite;
  }
  .puntos i:nth-child(2) { animation-delay: 0.16s; }
  .puntos i:nth-child(3) { animation-delay: 0.32s; }

  @keyframes latir {
    0%, 60%, 100% { opacity: 0.35; translate: 0 0; }
    30% { opacity: 1; translate: 0 -2px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .puntos i { animation: none; opacity: 0.6; }
  }
</style>
