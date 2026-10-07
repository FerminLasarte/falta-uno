<!--
  Avatar de un contacto. Sin fotos: iniciales sobre un tono derivado del id, que
  es estable entre partidas y no necesita ningún asset. El anillo de color dice
  en qué está esa persona con vos.
-->
<script lang="ts">
  import type { EstadoContacto } from "../../core/tipos.js";
  import { COLOR_ESTADO } from "./rotulos.js";

  let {
    nombre,
    id,
    estado = null,
    tam = 42,
    grupo = false,
    fondo = "var(--app-superficie)",
  }: {
    nombre: string;
    id: string;
    estado?: EstadoContacto | null;
    tam?: number;
    grupo?: boolean;
    /** Color de lo que hay detrás, para separar el anillo de la foto. */
    fondo?: string;
  } = $props();

  /** Hash estable: el mismo contacto tiene siempre el mismo tono. */
  function tono(texto: string): number {
    let h = 0;
    for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) % 360;
    return h;
  }

  /* "El Tano" se agenda como Tano: los artículos no van en las iniciales. */
  const ARTICULOS = new Set(["el", "la", "los", "las"]);

  const iniciales = $derived(
    nombre
      .split(/\s+/)
      .filter((p) => !ARTICULOS.has(p.toLowerCase()))
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || nombre.slice(0, 1).toUpperCase(),
  );

  const anillo = $derived(estado && estado !== "sin_contactar" ? COLOR_ESTADO[estado] : null);
</script>

<span
  class="avatar"
  class:grupo
  style:--tono={tono(id)}
  style:--tam={tam}
  style:--anillo={anillo}
  style:--detras={fondo}
  class:con-anillo={anillo !== null}
  aria-hidden="true"
>
  {#if grupo}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2l3.6 2.6-1.4 4.2H9.8L8.4 9.8z" fill="currentColor" stroke="none" />
      <path d="M12 3v4.2M15.6 9.8l4.6-1.6M14.2 14l2.8 3.9M9.8 14L7 17.9M8.4 9.8L3.8 8.2" />
    </svg>
  {:else}
    {iniciales}
  {/if}
</span>

<style>
  .avatar {
    flex: none;
    display: grid;
    place-items: center;
    width: calc(var(--tam) * 1px * var(--escala-ui));
    height: calc(var(--tam) * 1px * var(--escala-ui));
    border-radius: 50%;
    background: hsl(var(--tono) calc(22% * var(--sat)) 62%);
    color: #FFFFFF;
    /* Nunca menos de 9 px: en los avatares chicos de la agenda la inicial se tiene que leer. */
    font-size: max(calc(9px * var(--escala-ui)), calc(var(--tam) * 0.3px * var(--escala-ui)));
    font-weight: 600;
    letter-spacing: 0.02em;
    /* El avatar pierde color con la moral, como todo lo demás. */
    filter: saturate(var(--sat));
  }

  .con-anillo {
    box-shadow: 0 0 0 2px var(--detras), 0 0 0 3.5px var(--anillo);
  }

  .grupo {
    background: #2B3138;
    color: #E9EDF0;
  }

  .grupo svg {
    width: 52%;
    height: 52%;
  }
</style>
