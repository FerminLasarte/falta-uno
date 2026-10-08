<!--
  La charla con la cancha con la que arranca todo. Pregunta qué buscan (un
  partido suelto o el torneo), de cuánto es la cancha y cómo van a pagar la seña:
  cada respuesta dice debajo qué implica. No es un menú: es un chat como los
  demás, y lo que contestás queda escrito ahí, arriba de lo que la cancha te
  pregunte más tarde.
-->
<script lang="ts">
  import type { Eleccion } from "../estado/juego.svelte.js";
  import Avatar from "./Avatar.svelte";
  import Cabecera from "./Cabecera.svelte";
  import Chat from "./Chat.svelte";

  let { eleccion, alElegir }: { eleccion: Eleccion; alElegir: (id: string) => void } = $props();

  const opciones = $derived(
    eleccion.opciones.map((o) => ({ id: o.id, texto: o.texto, detalle: { titulo: o.titulo, texto: o.resumen } })),
  );
</script>

<div class="app">
  <Chat
    eventos={eleccion.eventos}
    {opciones}
    nota={eleccion.nota}
    {alElegir}
  >
    {#snippet cabecera()}
      <Cabecera titulo={eleccion.de} subtitulo="en línea">
        {#snippet avatar()}
          <Avatar nombre={eleccion.de} id={eleccion.chat} tam={38} />
        {/snippet}
      </Cabecera>
    {/snippet}
  </Chat>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--app-fondo);
  }
</style>
