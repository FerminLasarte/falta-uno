<!--
  Los créditos son la placa de la formación del cierre: los que hicieron el juego, con un
  número cada uno y su licencia en amarillo. Los aportes de terceros salen de la tabla de
  arte/CREDITOS.md, la única lista; los CC BY tienen que estar sí o sí. Esc vuelve al
  entretiempo: lo atiende la placa.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import creditosMd from "../../../arte/CREDITOS.md?raw";
  import { aportes } from "./creditos.js";

  interface Jugador {
    readonly numero: string;
    readonly nombre: string;
    readonly detalle: string;
    readonly licencia?: string;
  }

  const formacion: Jugador[] = [
    { numero: "DT", nombre: "Fermín Lasarte", detalle: "el juego, de punta a punta" },
    ...aportes(creditosMd).map((a, i) => ({
      numero: String(i + 1),
      // Las aclaraciones entre paréntesis son para el registro de licencias, no para la tele.
      nombre: a.autor.replace(/\s*\([^)]*\)/g, ""),
      detalle: `${a.asset} · ${a.fuente}`,
      licencia: a.licencia,
    })),
    { numero: "", nombre: "Archivo y Public Sans", detalle: "las letras", licencia: "SIL OFL" },
    { numero: "", nombre: "Electron, Svelte y Blender", detalle: "con lo que está hecho" },
  ];
  // Los de sin número son los suplentes: los que no son del arte del juego.
  const mitad = Math.ceil(formacion.length / 2);

  let placa = $state<HTMLElement>();
  onMount(() => placa?.focus());
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="formacion" bind:this={placa} tabindex="0" role="group" aria-label="Créditos">
  <p class="cabeza"><b>Formación</b><span>los que hicieron el juego</span></p>
  <div class="columnas">
    {#each [formacion.slice(0, mitad), formacion.slice(mitad)] as columna, c (c)}
      <div class="columna">
        {#each columna as jugador (jugador.nombre)}
          <div class="jugador" class:dt={jugador.numero === "DT"}>
            <b class="numero">{jugador.numero || "S"}</b>
            <div class="datos">
              <span class="nombre">{jugador.nombre}</span>
              <span class="detalle">{jugador.detalle}{#if jugador.licencia}{" · "}<em>{jugador.licencia}</em>{/if}</span>
            </div>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .formacion {
    position: absolute;
    left: 24px;
    right: 24px;
    top: 46px;
    bottom: 40px;
    outline: none;
  }
  .cabeza { display: flex; align-items: baseline; gap: 12px; margin: 0 0 8px; }
  .cabeza b { font-size: 28px; font-weight: 900; font-style: italic; letter-spacing: -0.01em; text-transform: uppercase; }
  .cabeza span { font-size: 13px; font-weight: 800; font-style: italic; letter-spacing: 0.06em; text-transform: uppercase; color: var(--amarillo); }

  .columnas { display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; }
  .columna { display: flex; flex-direction: column; gap: 4px; }

  .jugador {
    display: grid;
    grid-template-columns: 24px 1fr;
    min-height: 34px;
    transform: skewX(-10deg);
    background: rgb(21 24 27 / 85%);
  }
  .numero {
    display: grid;
    place-items: center;
    background: var(--rojo);
    font-size: 13px;
    font-weight: 900;
    font-style: italic;
  }
  .dt .numero { background: var(--amarillo); color: var(--tinta); }
  .datos {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 2px 8px;
    transform: skewX(10deg);
    line-height: 1.1;
    min-width: 0;
  }
  .nombre { font-size: 14px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .detalle { font-family: var(--fuente-app); font-stretch: normal; font-size: 9.5px; color: rgb(255 255 255 / 62%); }
  .detalle em { font-style: normal; font-weight: 700; color: var(--amarillo); }
</style>
