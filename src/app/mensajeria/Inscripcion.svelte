<!--
  La charla con la cancha con la que arranca la campaña. Pregunta cómo van a
  pagar la seña, y cada respuesta es un perfil: debajo dice qué implica y a quién
  trae a la agenda. No es un menú: es un chat como los demás, y lo que contestás
  queda escrito ahí, arriba de lo que la cancha te pregunte más tarde.
-->
<script lang="ts">
  import type { PerfilId } from "../../core/tipos.js";
  import type { Eleccion } from "../estado/juego.svelte.js";
  import Avatar from "./Avatar.svelte";
  import Cabecera from "./Cabecera.svelte";
  import Chat from "./Chat.svelte";

  let { eleccion, alElegir }: { eleccion: Eleccion; alElegir: (perfilId: PerfilId) => void } = $props();

  const opciones = $derived(
    eleccion.perfiles.map((p) => ({ id: p.id, texto: p.texto, detalle: { titulo: p.titulo, texto: p.resumen } })),
  );
</script>

<div class="app">
  <Chat
    eventos={eleccion.eventos}
    {opciones}
    nota="Lo elegís una vez por campaña"
    alElegir={(id) => {
      const perfil = eleccion.perfiles.find((p) => p.id === id);
      if (perfil) alElegir(perfil.id);
    }}
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
