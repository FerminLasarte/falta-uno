<!--
  La campaña terminó. Primero pasa lo que la terminó, adentro del teléfono: el
  grupo se vacía o el complejo te escribe. Sin moral no hace falta: ese momento
  fue el teléfono apagándose. Después, el resumen en la app del torneo.
-->
<script lang="ts">
  import type { EventoFeed } from "../../core/partida.js";
  import type { Vista } from "../estado/juego.svelte.js";
  import Desalojo from "./Desalojo.svelte";
  import Disolucion from "./Disolucion.svelte";
  import ResumenCampana from "./ResumenCampana.svelte";

  let {
    vista,
    cancha,
    rivalDe,
    alVisto,
    alCampanaNueva,
  }: {
    vista: Vista;
    /** El chat con la cancha y quién escribe en él. */
    cancha: { readonly chat: string; readonly de: string };
    rivalDe: (fecha: number) => string;
    alVisto: () => void;
    alCampanaNueva: () => void;
  } = $props();

  const fin = $derived(vista.campana.fin);
  /** Lo que terminó todo cae a la hora que marca el teléfono. */
  const minuto = $derived(vista.minutosEnBarra);

  /* Los que estaban en el grupo, primero los que vinieron: son los que se despiden. */
  const nombres = $derived(
    [...vista.contactos]
      .sort((a, b) => Number(b.estado === "confirmado") - Number(a.estado === "confirmado"))
      .map((c) => c.nombre),
  );
  const conLaCancha = $derived(vista.eventos.filter((e: EventoFeed) => e.chat === cancha.chat));
</script>

{#if !vista.finVisto && fin === "disolucion"}
  <Disolucion {nombres} {minuto} alTerminar={alVisto} />
{:else if !vista.finVisto && fin === "bancarrota"}
  <Desalojo chat={cancha.chat} de={cancha.de} anteriores={conLaCancha} {minuto} alTerminar={alVisto} />
{:else}
  <ResumenCampana campana={vista.campana} torneo={vista.torneo} {rivalDe} {alCampanaNueva} />
{/if}
