<!--
  El grupo del equipo: la pantalla principal, donde arranca el juego. Arriba la
  lista fijada; en el medio lo que pasa en el grupo; abajo no hay teclado sino
  acciones con su costo, centradas porque las esquinas son de los pulgares.
-->
<script lang="ts">
  import type { EventoFeed, VistaContacto, VistaPuesto, VistaRoster } from "../../core/partida.js";
  import { COSTO } from "../../core/tiempo.js";
  import type { Rol } from "../../core/tipos.js";
  import Avatar from "./Avatar.svelte";
  import BotonPrincipal from "./BotonPrincipal.svelte";
  import Cabecera from "./Cabecera.svelte";
  import Charla from "./Charla.svelte";
  import ListaGrupo from "./ListaGrupo.svelte";
  import { COLOR_ESTADO, enumerar, NOMBRE_GRUPO, pesos, ROL_CORTO } from "./rotulos.js";

  let {
    eventos,
    escribiendo,
    lista,
    contactos,
    roster,
    dinero,
    sena,
    costoReemplazo,
    sinLeerAfuera,
    alVolver,
    alAbrir,
    alEscribirAAlguien,
    alPagar,
    calmar,
    alCalmar,
    alIrALaCancha,
    complejo,
    escuchados,
    alEscuchar,
  }: {
    eventos: readonly EventoFeed[];
    /** Quién escribe en el grupo ahora mismo. */
    escribiendo: string | null;
    lista: readonly VistaPuesto[];
    contactos: readonly VistaContacto[];
    roster: VistaRoster;
    dinero: number;
    sena: number;
    costoReemplazo: number;
    sinLeerAfuera: number;
    alVolver: () => void;
    alAbrir: (id: string) => void;
    alEscribirAAlguien: () => void;
    alPagar: (rol: Rol) => void;
    /** Calmar a los que se están peleando: quiénes son y lo que cuesta. Null si nadie se pelea. */
    calmar: { readonly texto: string; readonly costoReloj: number; readonly entre: readonly string[] } | null;
    alCalmar: () => void;
    /** Ya son las 21:00: lo único que queda es ir a la cancha. Null mientras se juega el viernes. */
    alIrALaCancha: (() => void) | null;
    /** Dónde se juega: va en el título de la lista. */
    complejo: string;
    escuchados: ReadonlySet<string>;
    alEscuchar: (audioId: string) => void;
  } = $props();

  /* El subtítulo de un grupo de WhatsApp: los integrantes por orden alfabético. */
  const integrantes = $derived(
    [...contactos.map((c) => c.nombre)].sort((a, b) => a.localeCompare(b, "es")).join(", ") + ", vos",
  );

  const enDuda = $derived(
    contactos
      .filter((c) => c.estado === "hablando" || c.estado === "esperando")
      .sort((a, b) => (a.minutoUltimo ?? 0) - (b.minutoUltimo ?? 0)),
  );

  const estadoPorNombre = $derived(new Map(contactos.map((c) => [c.nombre, c.estado])));
  const colorDe = (nombre: string): string | null => {
    const estado = estadoPorNombre.get(nombre);
    return estado ? COLOR_ESTADO[estado] : null;
  };

  const puedePagar = $derived(roster.faltantes.length > 0 && dinero >= costoReemplazo);
  let eligiendoPuesto = $state(false);

  function pagar(rol: Rol): void {
    eligiendoPuesto = false;
    alPagar(rol);
  }
</script>

<div class="pantalla-app">
  <!-- Cerrada la lista, el grupo queda como uno de solo administradores: ya nadie escribe. -->
  <Cabecera
    titulo={NOMBRE_GRUPO}
    subtitulo={alIrALaCancha ? "Solo los administradores pueden enviar mensajes" : escribiendo ? `${escribiendo} está escribiendo…` : integrantes}
    volver={{ cuenta: sinLeerAfuera, alVolver }}
  >
    {#snippet avatar()}
      <Avatar nombre={NOMBRE_GRUPO} id="grupo" grupo tam={38} />
    {/snippet}
  </Cabecera>

  <ListaGrupo {lista} {enDuda} {roster} {dinero} {sena} titulo="Viernes 21 h · {complejo}" {alAbrir} />

  <Charla {eventos} {escribiendo} mostrarNombres {colorDe} {escuchados} {alEscuchar} />

  <!--
    Mientras alguien se pelea, queda a la vista arriba de las acciones, aunque la
    pelea ya haya quedado arriba en el chat: cada acción tuya los calienta más.
  -->
  {#if calmar}
    <div class="roce" role="status">
      <span class="quienes">{enumerar(calmar.entre)} se están peleando</span>
      <button class="accion" onclick={alCalmar}>
        {calmar.texto} <span class="costo">{calmar.costoReloj} min</span>
      </button>
    </div>
  {/if}

  <div class="acciones">
    {#if alIrALaCancha}
      <BotonPrincipal accion={{ texto: "Ir a la cancha" }} alTocar={alIrALaCancha} />
    {:else if eligiendoPuesto}
      <span class="pregunta">¿Qué puesto pagás?</span>
      <div class="fila">
        {#each roster.faltantes as f (f.rol)}
          <button class="accion" onclick={() => pagar(f.rol)}>{ROL_CORTO[f.rol]}</button>
        {/each}
        <button class="accion tenue" onclick={() => (eligiendoPuesto = false)}>Cancelar</button>
      </div>
    {:else}
      <div class="fila">
        <button class="accion" onclick={alEscribirAAlguien}>Escribir a alguien</button>
        {#if puedePagar}
          <button class="accion" onclick={() => (eligiendoPuesto = true)}>
            Pagar reemplazo <span class="costo">{pesos(costoReemplazo)} · {COSTO.pagarVacante} min</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .pantalla-app { flex: 1; min-height: 0; display: flex; flex-direction: column; }

  .roce {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 12px 0;
    background: var(--app-papel);
    border-top: 1px solid var(--app-linea);
  }
  .quienes { font-size: var(--t-micro); font-weight: 600; color: var(--est-rechazado); }

  .acciones {
    flex: none;
    min-height: var(--zona-pulgares);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 12px 0;
    background: var(--app-papel);
  }
  .fila { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; max-width: 78%; }
  .pregunta { font-size: var(--t-micro); font-weight: 600; color: var(--app-tinta-3); }

  .accion {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 7px 12px;
    border-radius: var(--radio-chip);
    background: var(--app-superficie);
    border: 1px solid var(--app-linea);
    box-shadow: 0 1px 0 rgb(21 24 27 / 5%);
    font-size: var(--t-meta);
    font-weight: 600;
    color: var(--app-tinta);
    white-space: nowrap;
  }
  .accion:hover { background: var(--app-hover); }
  .accion.tenue { color: var(--app-tinta-3); }
  .costo { font-size: var(--t-micro); font-weight: 600; color: var(--app-tinta-3); font-variant-numeric: tabular-nums; }
</style>
