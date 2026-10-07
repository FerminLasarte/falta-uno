<script lang="ts">
  import Depurador from "./Depurador.svelte";
  import Escena from "./escena/Escena.svelte";
  import Mensajeria from "./mensajeria/Mensajeria.svelte";
  import BarraEstado from "./telefono/BarraEstado.svelte";
  import Pantalla from "./telefono/Pantalla.svelte";
  import { calcularDeterioro } from "./estado/deterioro.js";
  import { juego } from "./estado/juego.svelte.js";

  /** Override para capturas y revisión de diseño (?moral=15). */
  const moralDeLaUrl = (() => {
    const crudo = new URLSearchParams(location.search).get("moral");
    const valor = crudo === null ? Number.NaN : Number(crudo);
    return Number.isFinite(valor) ? Math.min(100, Math.max(0, valor)) : null;
  })();

  let moralForzada = $state<number | null>(moralDeLaUrl);

  const moralEfectiva = $derived(moralForzada ?? juego.vista?.moral ?? 100);

  /* El ÚNICO lugar de todo el juego donde el deterioro llega al documento. */
  $effect(() => {
    document.documentElement.style.setProperty(
      "--deterioro",
      String(calcularDeterioro(moralEfectiva)),
    );
  });

  void juego.iniciar();
</script>

<Escena>
  <Pantalla>
    {#if juego.error}
      <div class="falla">
        <p class="titulo">No se pudo cargar el juego</p>
        <p class="detalle">{juego.error}</p>
      </div>
    {:else if juego.vista && juego.contenido}
      <BarraEstado hora={juego.vista.hora} restante={juego.vista.restante} />
      <Mensajeria
        contactos={juego.vista.contactos}
        roster={juego.vista.roster}
        dinero={juego.vista.dinero}
        sena={juego.contenido.config.senaCancha}
        alAbrir={(id) => juego.abrirChat(id)}
      />
    {:else}
      <div class="cargando"><span></span></div>
    {/if}
  </Pantalla>
</Escena>

{#if import.meta.env.DEV}
  <Depurador moral={juego.vista?.moral ?? 100} alCambiar={(v) => (moralForzada = v)} />
{/if}

<style>
  .falla,
  .cargando {
    flex: 1;
    display: grid;
    place-content: center;
    gap: var(--e1);
    padding: var(--e4);
    text-align: center;
  }

  .titulo { font-size: var(--t-nombre); font-weight: 600; margin: 0; }
  .detalle { font-size: var(--t-meta); color: var(--app-tinta-2); margin: 0; }

  .cargando span {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid var(--app-linea);
    border-top-color: var(--app-tinta-3);
    animation: girar 900ms linear infinite;
  }

  @keyframes girar { to { transform: rotate(360deg); } }
</style>
