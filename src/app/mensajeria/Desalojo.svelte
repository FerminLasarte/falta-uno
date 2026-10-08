<!--
  Bancarrota: el complejo te escribe que le da el turno a otro equipo. Llega
  como cualquier mensaje, después de verlo escribir, en el mismo chat donde te
  anotaste. No hay nada que tocar: cuando termina, pasa al resumen.
-->
<script lang="ts">
  import { AGUANTE } from "../../core/campana.js";
  import type { EventoFeed } from "../../core/partida.js";
  import Avatar from "./Avatar.svelte";
  import Cabecera from "./Cabecera.svelte";
  import Charla from "./Charla.svelte";

  let {
    chat,
    de,
    anteriores,
    minuto,
    alTerminar,
  }: {
    chat: string;
    de: string;
    /** Lo que ya había en el chat con la cancha. */
    anteriores: readonly EventoFeed[];
    minuto: number;
    alTerminar: () => void;
  } = $props();

  const ESCRIBE_MS = 1800;
  const FINAL_MS = 3200;
  const EN_LETRAS = ["", "una", "dos", "tres", "cuatro"];

  let llego = $state(false);

  $effect(() => {
    const reloj = setTimeout(() => (llego ? alTerminar() : (llego = true)), llego ? FINAL_MS : ESCRIBE_MS);
    return () => clearTimeout(reloj);
  });

  const aviso = $derived<EventoFeed>({
    minuto,
    de,
    chat,
    clase: "mensaje",
    texto:
      `Buenas. Con ${EN_LETRAS[AGUANTE.fechasConDeuda] ?? AGUANTE.fechasConDeuda} fechas seguidas sin pagar la cancha, ` +
      "le damos el turno de los viernes a otro equipo. Cuando quieran saldar lo que deben, nos escriben.",
  });
</script>

<div class="pantalla-app">
  <Cabecera titulo={de} subtitulo={llego ? "en línea" : "escribiendo…"}>
    {#snippet avatar()}
      <Avatar nombre={de} id={chat} tam={38} />
    {/snippet}
  </Cabecera>
  <Charla eventos={llego ? [...anteriores, aviso] : anteriores} escribiendo={llego ? null : de} />
  <div class="zona-pulgares"></div>
</div>

<style>
  .pantalla-app { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--app-papel); }
  .zona-pulgares { flex: none; min-height: var(--zona-pulgares); }
</style>
