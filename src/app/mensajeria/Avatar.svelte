<!--
  Avatar de un contacto. Sin fotos: iniciales sobre un tono derivado del id, que
  es estable entre partidas y no necesita ningún asset.
-->
<script lang="ts">
  import type { EstadoContacto } from "../../core/tipos.js";

  let { nombre, id, estado }: { nombre: string; id: string; estado: EstadoContacto } = $props();

  /** Hash estable: el mismo contacto tiene siempre el mismo tono. */
  function tono(texto: string): number {
    let h = 0;
    for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) % 360;
    return h;
  }

  const iniciales = $derived(
    nombre
      .split(/\s+/)
      .filter((p) => p.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(p))
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || nombre.slice(0, 1).toUpperCase(),
  );
</script>

<span class="avatar" style="--tono: {tono(id)}">
  {iniciales}
  {#if estado === "confirmado" || estado === "bajado" || estado === "rechazado"}
    <span class="marca" data-estado={estado} aria-hidden="true"></span>
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: calc(42px * var(--escala-ui));
    height: calc(42px * var(--escala-ui));
    border-radius: 50%;
    background: hsl(var(--tono) calc(22% * var(--sat)) 62%);
    color: #FFFFFF;
    font-size: var(--t-meta);
    font-weight: 600;
    letter-spacing: 0.02em;
    /* El avatar pierde color con la moral, como todo lo demás. */
    filter: saturate(var(--sat));
  }

  .marca {
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 2px solid var(--app-superficie);
  }
  .marca[data-estado="confirmado"] { background: var(--est-confirmado); }
  .marca[data-estado="rechazado"] { background: var(--est-rechazado); }
  .marca[data-estado="bajado"] { background: var(--est-bajado); }
</style>
