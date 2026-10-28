<!--
  El living en primera persona. Tres capas, de atrás para adelante:

    1. el fondo, renderizado y desenfocado en Blender;
    2. la app de verdad, en el hueco de la pantalla;
    3. las manos y el celular, también renderizados, con la pantalla agujereada.

  Dónde cae cada cosa lo dice escena.json, que exporta arte/exportar_capas.py junto con
  las imágenes. Si cambia el render, cambia solo: acá no hay una sola medida a ojo.

  Arriba de todo, la pausa: levantás la vista del celular y mirás la tele, donde va la
  placa del menú. La mirada que sube son cuadros renderizados (arte/exportar_pausa.py); al
  volver, los mismos al revés. Se puede dar vuelta a mitad de camino.
-->
<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import datos from "./capas/escena.json";
  import fondo from "./capas/fondo.webp";
  import pausa from "./capas/pausa.json";
  import pausaQuieta from "./capas/pausa.webp";
  import primerPlano from "./capas/primer_plano.webp";
  import { matrix3d, type Esquinas } from "./perspectiva.js";

  let {
    children,
    placa,
    mirandoTele = false,
    quieta = false,
    alVolverAlCelu,
  }: {
    children?: Snippet;
    /** Lo que pasa en la pantalla de la tele cuando la mirás: la placa del menú. */
    placa?: Snippet;
    /** Levantaste la vista del celular. */
    mirandoTele?: boolean;
    /** Sin movimiento: lo pide el jugador en Ajustes o el sistema. La escena no respira, no tiembla ni vibra. */
    quieta?: boolean;
    /** La mirada volvió al celular: recién ahí sigue el viernes. */
    alVolverAlCelu?: () => void;
  } = $props();

  /** La app se diseña a este ancho, como un teléfono real, y después se escala al hueco. */
  const ANCHO_LOGICO = 390;

  const { cuadro, pantalla, camaraFrontal, tele } = datos;
  const altoLogico = Math.round(
    (ANCHO_LOGICO * (pantalla.alto * cuadro.alto)) / (pantalla.ancho * cuadro.ancho),
  );

  let anchoCuadro = $state(0);
  let altoCuadro = $state(0);
  const escala = $derived((anchoCuadro * pantalla.ancho) / ANCHO_LOGICO);

  /** La placa se diseña a este tamaño, en la proporción de la pantalla de la tele, y se lleva a sus esquinas. */
  const ANCHO_PLACA = 588;
  const ALTO_PLACA = 336;
  const matrizPlaca = $derived(
    matrix3d(ANCHO_PLACA, ALTO_PLACA, pausa.tele.map(([x, y]) => [x! * anchoCuadro, y! * altoCuadro]) as unknown as Esquinas),
  );

  /** Los cuadros de la mirada que sube, en orden, cargados de entrada para que no titilen. */
  const cuadrosMirada = Object.entries(
    import.meta.glob<string>("./capas/transicion/*.webp", { eager: true, import: "default" }),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, src]) => {
      const imagen = new Image();
      imagen.src = src;
      void imagen.decode().catch(() => {});
      return imagen;
    });

  /** Lo que dura levantar la vista. Los cuadros ya traen la aceleración de la cámara. */
  const MIRADA_MS = 750;
  /**
   * Hasta acá del recorrido, la escena de siempre se funde con los cuadros. En los cuadros
   * la pantalla del celular es una luz pareja, no la app: el fundido la tapa mientras el
   * celular todavía está nítido, y cuando se desenfoca ya no se nota.
   */
  const FUNDIDO = 0.28;

  /** Cuánto subió la mirada: 0 es el celular, 1 la tele. */
  let avance = $state(0);
  let lienzo = $state<HTMLCanvasElement>();
  const enLaTele = $derived(mirandoTele && avance === 1);
  // Sin movimiento, no hay recorrido: se funde de una toma a la otra.
  const opacidadPausa = $derived(quieta ? avance : Math.min(1, avance / FUNDIDO));

  function dibujar(): void {
    const contexto = lienzo?.getContext("2d");
    if (!lienzo || !contexto || cuadrosMirada.length === 0) return;
    const i = quieta ? cuadrosMirada.length - 1 : Math.round(avance * (cuadrosMirada.length - 1));
    const cuadro = cuadrosMirada[i]!;
    if (cuadro.complete) contexto.drawImage(cuadro, 0, 0, lienzo.width, lienzo.height);
  }

  $effect(() => {
    const hacia = mirandoTele ? 1 : 0;
    if (untrack(() => avance) === hacia) return;
    const duracion = quieta ? 200 : MIRADA_MS;
    let antes = performance.now();
    let pedido = requestAnimationFrame(function cuadro(ahora) {
      const paso = (ahora - antes) / duracion;
      antes = ahora;
      avance = hacia === 1 ? Math.min(1, avance + paso) : Math.max(0, avance - paso);
      dibujar();
      if (avance !== hacia) pedido = requestAnimationFrame(cuadro);
      else if (hacia === 0) alVolverAlCelu?.();
    });
    return () => cancelAnimationFrame(pedido);
  });

  /** Fracciones del cuadro a porcentajes para `style`. */
  const pct = (fraccion: number): string => `${fraccion * 100}%`;

  /** Un cuadro de la sacudida, en ms. A 60 fps cada cuadro alterna de lado. */
  const PASO_MS = 17;
  /** Amplitud en ancho del cuadro: cerca de un píxel y medio en una ventana común. */
  const AMPLITUD_CQW = 0.13;

  let vibra = $state<HTMLDivElement>();

  /**
   * El celular vibra en la mano: el teléfono y las manos se sacuden apenas, más
   * rápido que la respiración. Los tramos son de motor prendido y apagado, en ms.
   */
  export function vibrar(tramos: readonly number[]): void {
    if (!vibra || quieta) return;
    const total = tramos.reduce((t, ms) => t + ms, 0);
    const cuadros: Keyframe[] = [];
    let desde = 0;
    tramos.forEach((ms, i) => {
      const prendido = i % 2 === 0;
      for (let t = 0; t < ms; t += PASO_MS) {
        // El motor arranca y frena con una rampa corta: sin eso se ve como un salto.
        const envolvente = prendido ? Math.min(1, t / 40, (ms - t) / 50) : 0;
        const lado = Math.round(t / PASO_MS) % 2 === 0 ? 1 : -1;
        const a = AMPLITUD_CQW * envolvente;
        cuadros.push({
          offset: (desde + t) / total,
          translate: `${lado * a}cqw ${-lado * a * 0.45}cqw`,
          rotate: `${lado * a * 0.35}deg`,
        });
      }
      desde += ms;
    });
    cuadros.push({ offset: 1, translate: "0 0", rotate: "0deg" });
    vibra.animate(cuadros, { duration: total, easing: "linear" });
  }
</script>

<div class="escena" class:quieta>
  <div class="cuadro" bind:clientWidth={anchoCuadro} bind:clientHeight={altoCuadro} style:--proporcion={cuadro.ancho / cuadro.alto}>
    <div class="mundo" aria-hidden="true">
      <img src={fondo} alt="" />
      <div
        class="tele"
        style:left={pct(tele.izquierda)}
        style:top={pct(tele.arriba)}
        style:width={pct(tele.ancho)}
        style:height={pct(tele.alto)}
      ></div>
    </div>

    <div class="manos">
      <div class="vibra" bind:this={vibra}>
        <div class="pulso">
          <div
            class="hueco"
            style:left={pct(pantalla.izquierda)}
            style:top={pct(pantalla.arriba)}
            style:width={pct(pantalla.ancho)}
            style:height={pct(pantalla.alto)}
          >
            <div
              class="vidrio"
              style:width="{ANCHO_LOGICO}px"
              style:height="{altoLogico}px"
              style:transform="scale({escala})"
              style:--radio-pantalla="{pantalla.radio * ANCHO_LOGICO}px"
              style:--camara-centro="{camaraFrontal.centroY * altoLogico}px"
            >
              {@render children?.()}
            </div>
          </div>
          <img class="frente" src={primerPlano} alt="" />
        </div>
      </div>
    </div>

    <div class="pausa" class:oculta={avance === 0} style:opacity={opacidadPausa}>
      <canvas bind:this={lienzo} width="1280" height="800" aria-hidden="true"></canvas>
      <img class="toma" class:llego={enLaTele} src={pausaQuieta} alt="" />
      {#if enLaTele}
        <div class="placa" style:width="{ANCHO_PLACA}px" style:height="{ALTO_PLACA}px" style:transform={matrizPlaca}>
          {@render placa?.()}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .escena {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--mundo-fondo);
    container-type: size;
  }

  /*
    El cuadro del render cubre la ventana, como un background-size: cover. Con un tope:
    en una pantalla ultra ancha "cubrir" cortaría el celular, así que el alto del cuadro
    nunca pasa de 1,12 veces el de la ventana y sobran bandas a los costados.
  */
  .cuadro {
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(max(100cqw, calc(100cqh * var(--proporcion))), calc(112cqh * var(--proporcion)));
    aspect-ratio: var(--proporcion);
    translate: -50% -50%;
  }

  .mundo,
  .manos,
  .vibra,
  .pulso {
    position: absolute;
    inset: 0;
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  /* El living se apaga y se destiñe con la moral, como la app. */
  .mundo {
    filter: brightness(var(--luz)) saturate(var(--sat));
    scale: 1.03;
    animation: contraluz 5.2s ease-in-out infinite;
  }

  /* En ultra ancho, los bordes del render se funden con la noche en vez de cortar. */
  @container (aspect-ratio > 1.79) {
    .mundo,
    .pausa {
      mask-image: linear-gradient(to right, transparent, #000 7%, #000 93%, transparent);
    }
  }

  /*
    La luz de la tele no es fija: cambia de plano, se aclara en una toma abierta, se
    oscurece en un primer plano. Un resplandor encima del fondo, con cortes irregulares.
  */
  .tele {
    position: absolute;
    background: radial-gradient(
      ellipse 70% 70% at 50% 50%,
      rgb(170 235 180 / 55%),
      rgb(120 200 140 / 22%) 55%,
      transparent 80%
    );
    mix-blend-mode: screen;
    scale: 1.5;
    opacity: 0.2;
    animation: tele 9s step-end infinite;
  }

  /*
    Respirar: las manos suben y bajan apenas, y se mecen de costado con otro período,
    para que el movimiento nunca se repita igual. El fondo se mueve al revés y menos:
    eso es lo que da profundidad.
  */
  .manos {
    animation:
      respirar 5.2s ease-in-out infinite,
      mecer 7.7s ease-in-out infinite;
  }

  /* Con la moral baja, la mano tiembla. Solo pasado cierto umbral: antes, quieta. */
  .pulso {
    --temblor: max(0%, calc((var(--deterioro) - 0.45) * 0.16%));
    animation: temblar 140ms linear infinite alternate;
  }

  .hueco {
    position: absolute;
  }

  /* Mirando la tele: la transición, la toma quieta y la placa, arriba de las manos. */
  .pausa {
    position: absolute;
    inset: 0;
  }
  .pausa.oculta { visibility: hidden; }
  .pausa canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  /* Los cuadros van a media resolución: al llegar, la toma quieta entera. */
  .toma { opacity: 0; }
  .toma.llego { opacity: 1; transition: opacity 160ms ease-out; }

  .placa {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    animation: encender 220ms ease-out both;
  }

  @keyframes encender {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* La app vive a 390 px lógicos y se escala al hueco: el diseño no depende de la ventana. */
  .vidrio {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    display: flex;
    flex-direction: column;
  }

  @keyframes respirar {
    0%, 100% { translate: 0 0; }
    45% { translate: 0 -0.22%; }
  }

  @keyframes mecer {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(0.12%); }
  }

  @keyframes contraluz {
    0%, 100% { translate: 0 0; }
    45% { translate: 0 0.06%; }
  }

  @keyframes temblar {
    from { translate: calc(var(--temblor) * -1) 0; }
    to { translate: var(--temblor) calc(var(--temblor) * 0.6); }
  }

  @keyframes tele {
    0% { opacity: 0.2; }
    14% { opacity: 0.32; }
    23% { opacity: 0.12; }
    41% { opacity: 0.26; }
    58% { opacity: 0.38; }
    66% { opacity: 0.18; }
    83% { opacity: 0.3; }
  }

  /* Sin movimiento, por Ajustes o porque lo pide el sistema: la escena queda quieta, no rota. */
  .quieta :is(.mundo, .tele, .manos, .pulso) {
    animation: none;
  }
</style>
