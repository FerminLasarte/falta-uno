<script lang="ts">
  import { grupo as grupoDeAmigos } from "./estado/grupo.svelte.js";
  import Depurador from "./Depurador.svelte";
  import Menu from "./Menu.svelte";
  import Escena from "./escena/Escena.svelte";
  import Inscripcion from "./mensajeria/Inscripcion.svelte";
  import InfoGrupo from "./mensajeria/InfoGrupo.svelte";
  import Mensajeria from "./mensajeria/Mensajeria.svelte";
  import BarraEstado from "./telefono/BarraEstado.svelte";
  import Apagado from "./telefono/Apagado.svelte";
  import Semana from "./telefono/Semana.svelte";
    import { formatearHora } from "../core/tiempo.js";
  import Isla from "./telefono/Isla.svelte";
  import Pantalla from "./telefono/Pantalla.svelte";
  import { calcularDeterioro } from "./estado/deterioro.js";
  import { juego } from "./estado/juego.svelte.js";
  import { sonido } from "./sonido/sonido.js";
  import { SEPARACION_MS, VIBRACION } from "./telefono/vibracion.js";

  /** Override para capturas y revisión de diseño (?moral=15). */
  const moralDeLaUrl = (() => {
    const crudo = new URLSearchParams(location.search).get("moral");
    const valor = crudo === null ? Number.NaN : Number(crudo);
    return Number.isFinite(valor) ? Math.min(100, Math.max(0, valor)) : null;
  })();

  let moralForzada = $state<number | null>(moralDeLaUrl);

  const moralEfectiva = $derived(moralForzada ?? juego.vista?.moral ?? 100);
  const deterioro = $derived(calcularDeterioro(moralEfectiva));

  /* El ÚNICO lugar de todo el juego donde el deterioro llega al documento y al sonido. */
  $effect(() => {
    document.documentElement.style.setProperty("--deterioro", String(deterioro));
    sonido.deterioro = deterioro;
  });

  let escena = $state<Escena>();

  /*
    Lo que llega a otro chat hace vibrar y sonar el celular. Lo que llega al que
    estás mirando ya lo estás viendo: ni vibra ni suena. La charla del grupo
    tampoco, que está silenciado.
  */
  let ultimoAviso = -Infinity;
  $effect(() =>
    juego.alLlegar((llegada) => {
      if (llegada.aLaVista || llegada.silenciada) return;
      const ahora = performance.now();
      if (ahora - ultimoAviso < SEPARACION_MS) return;
      ultimoAviso = ahora;
      const tramos = llegada.reclamo ? VIBRACION.reclamo : VIBRACION.mensaje;
      escena?.vibrar(tramos);
      sonido.avisar(llegada.reclamo, tramos);
    }),
  );

  void juego.iniciar();

  /* Esc abre y cierra el menú. Con el menú abierto, el tiempo real no corre. */
  function alTeclear(evento: KeyboardEvent): void {
    if (evento.key !== "Escape") return;
    evento.preventDefault();
    juego.pausado = !juego.pausado;
  }

  const estadoDelMenu = $derived.by(() => {
    const vista = juego.vista;
    const perfil = juego.contenido?.perfiles.find((p) => p.id === vista?.campana.perfil);
    if (!vista || !perfil) return "Antes de arrancar";
    return `${perfil.nombre.replace(/^El /, "")} · ${vista.torneo.fecha} · viernes ${vista.hora}`;
  });
</script>

<svelte:window onkeydown={alTeclear} />

<Escena bind:this={escena}>
  <Pantalla oscura={juego.pantalla.tipo === "semana"}>
    {#if juego.error}
      <div class="falla">
        <p class="titulo">No se pudo cargar el juego</p>
        <p class="detalle">{juego.error}</p>
      </div>
    {:else if juego.eleccion}
      <BarraEstado hora={juego.eleccion.hora} restante={juego.eleccion.restante} />
      {#if juego.eleccion.grupo}
        <div class="app-sola"><InfoGrupo info={juego.eleccion.grupo} alListo={(apodos) => juego.empezar(apodos)} /></div>
      {:else}
        <Inscripcion eleccion={juego.eleccion} alElegir={(id) => juego.elegir(id)} />
      {/if}
    {:else if juego.vista && juego.pantalla.tipo === "semana"}
      <Semana
        hora={formatearHora(juego.vista.horaInicio - 2)}
        torneo={juego.vista.torneo}
        campana={juego.vista.campana}
        sena={juego.vista.sena}
        nombreGrupo={grupoDeAmigos.nombre}
        complejo={juego.vista.cancha.de}
        chatCancha={juego.vista.cancha.chat}
        alDesbloquear={() => juego.desbloquear()}
      />
    {:else if juego.vista && juego.contenido}
      <BarraEstado hora={juego.vista.hora} restante={juego.vista.restante} />
      <Mensajeria
        vista={juego.vista}
        sena={juego.vista.sena}
        costoReemplazo={juego.contenido.config.costoVacante}
      />
      <Isla />
      <!-- El teléfono se apaga una vez: cuando prende, ya es después del partido. -->
      {#if juego.vista.motivoFin === "moral_agotada" && !juego.vista.fuisteALaCancha}
        <Apagado alPrender={() => juego.ir({ tipo: "partido" })} />
      {/if}
    {:else}
      <div class="cargando"><span></span></div>
    {/if}
  </Pantalla>
</Escena>

{#if juego.pausado}
  <Menu
    estado={estadoDelMenu}
    puedeEmpezarOtra={juego.vista !== null}
    hayQuePerder={juego.vista !== null && juego.vista.campana.fin === null}
    alSeguir={() => (juego.pausado = false)}
    alCampanaNueva={() => juego.campanaNueva()}
    alSalir={() => void window.faltaUno.salir()}
  />
{/if}

{#if import.meta.env.DEV}
  <Depurador moral={juego.vista?.moral ?? 100} alCambiar={(v) => (moralForzada = v)} />
{/if}

<style>
  /* "Info del grupo" antes de que haya viernes: ocupa la pantalla como la app. */
  .app-sola { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--app-fondo); }

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
