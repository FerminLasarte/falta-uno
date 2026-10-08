<!--
  La app de mensajería adentro del teléfono. Impecable a propósito: es lo único
  ordenado de toda la escena, y se pudre a medida que se te cae la moral.

  Es el único componente de la app que habla con el puente: decide qué pantalla
  se ve y le pasa a cada una sus datos ya armados. Arranca en el grupo, que es
  donde vive el partido.
-->
<script lang="ts">
  import { CHAT_GRUPO } from "../../core/partida.js";
  import { COSTO } from "../../core/tiempo.js";
  import { juego, type Vista } from "../estado/juego.svelte.js";
  import Avatar from "./Avatar.svelte";
  import Cabecera from "./Cabecera.svelte";
  import Chat from "./Chat.svelte";
  import Chats from "./Chats.svelte";
  import Grupo from "./Grupo.svelte";
  import InfoGrupo from "./InfoGrupo.svelte";
  import Fin from "./Fin.svelte";
  import Partido from "./Partido.svelte";
  import { rivalDe } from "../../core/campana.js";
  import { COLOR_ESTADO, ROTULO_ESTADO, type AccionChat } from "./rotulos.js";

  let { vista, sena, costoReemplazo }: { vista: Vista; sena: number; costoReemplazo: number } = $props();

  const pantalla = $derived(juego.pantalla);
  /** Quién escribe en cada chat ahora mismo. */
  const tipeoPorChat = $derived(new Map(vista.escribiendo.map((t) => [t.chat, t.de])));
  const delGrupo = $derived(vista.eventos.filter((e) => e.chat === CHAT_GRUPO));

  /** Todo lo que te espera sin leer fuera de la pantalla actual: va en el botón de volver. */
  const sinLeerAfuera = $derived.by(() => {
    const p = pantalla;
    const contactos = vista.contactos
      .filter((c) => !(p.tipo === "contacto" && p.id === c.id))
      .reduce((t, c) => t + c.sinLeer, 0);
    const avisos = vista.interrupciones
      .filter((i) => !(p.tipo === "interrupcion" && p.id === i.id))
      .reduce((t, i) => t + i.sinLeer, 0);
    const grupo = p.tipo === "grupo" ? 0 : vista.grupoSinLeer;
    return contactos + avisos + grupo;
  });

  const volver = $derived({ cuenta: sinLeerAfuera, alVolver: () => juego.volver() });
  const irAlGrupo = (): void => juego.ir({ tipo: "grupo" });
  const franja = $derived({ roster: vista.roster, dinero: vista.dinero, sena, alVerLista: irAlGrupo });

  /* A las 21:00 se corta todo: lo único que queda por hacer, en cualquier chat, es ir a la cancha. */
  const irALaCancha = $derived<AccionChat | null>(vista.terminada ? { texto: "Ir a la cancha" } : null);
  const alIrALaCancha = (): void => juego.ir({ tipo: "partido" });

  /* En el relato, los nombres con el color de cómo terminó cada uno. */
  const colores = $derived(
    new Map(vista.contactos.filter((c) => c.estado !== "sin_contactar").map((c) => [c.nombre, COLOR_ESTADO[c.estado]])),
  );
  const abrirContacto = (id: string): void => juego.ir({ tipo: "contacto", id });

  const contacto = $derived(
    pantalla.tipo === "contacto" ? vista.contactos.find((c) => c.id === pantalla.id) ?? null : null,
  );
  const interrupcion = $derived(
    pantalla.tipo === "interrupcion"
      ? vista.interrupciones.find((i) => i.id === pantalla.id) ?? null
      : null,
  );
  const delChat = $derived(
    pantalla.tipo === "contacto" || pantalla.tipo === "interrupcion"
      ? vista.eventos.filter((e) => e.chat === pantalla.id)
      : [],
  );

  const puedeLlamar = $derived(
    contacto !== null && contacto.estado !== "rechazado" && contacto.estado !== "bajado" && !vista.terminada,
  );
</script>

<div class="app">
  {#if pantalla.tipo === "grupo"}
    <Grupo
      eventos={delGrupo}
      escribiendo={tipeoPorChat.get(CHAT_GRUPO) ?? null}
      lista={vista.lista}
      contactos={vista.contactos}
      roster={vista.roster}
      dinero={vista.dinero}
      {sena}
      {costoReemplazo}
      {sinLeerAfuera}
      alVolver={() => juego.volver()}
      alAbrir={abrirContacto}
      alEscribirAAlguien={() => juego.ir({ tipo: "chats" })}
      alPagar={(rol) => juego.pagarReemplazo(rol)}
      calmar={vista.calmar && !vista.terminada ? vista.calmar : null}
      alIrALaCancha={vista.terminada ? alIrALaCancha : null}
      complejo={vista.torneo.complejo}
      alCalmar={() => juego.calmar()}
      cerrar={vista.cerrar}
      alCerrar={() => juego.cerrarLista()}
      alVerInfo={() => juego.ir({ tipo: "info" })}
      escuchados={new Set(vista.audiosEscuchados)}
      alEscuchar={(id) => juego.escuchar(id)}
    />
  {:else if pantalla.tipo === "info"}
    <InfoGrupo
      info={vista.infoDelGrupo}
      {volver}
      alListo={(apodos) => {
        juego.cambiarApodos(apodos);
        juego.ir({ tipo: "grupo" });
      }}
    />
  {:else if pantalla.tipo === "chats"}
    <Chats
      contactos={vista.contactos}
      interrupciones={vista.interrupciones}
      escribiendo={new Set(tipeoPorChat.keys())}
      ultimoDelGrupo={delGrupo.at(-1) ?? null}
      grupoSinLeer={vista.grupoSinLeer}
      roster={vista.roster}
      dinero={vista.dinero}
      {sena}
      alAbrirGrupo={irAlGrupo}
      alAbrirContacto={abrirContacto}
      alAbrirInterrupcion={(id) => juego.ir({ tipo: "interrupcion", id })}
    />
  {:else if pantalla.tipo === "fin" && juego.contenido}
    {@const contenido = juego.contenido}
    <Fin
      {vista}
      cancha={vista.cancha}
      rivalDe={(fecha) => rivalDe(contenido.torneo, fecha)}
      alVisto={() => juego.marcarVisto("fin")}
      alCampanaNueva={() => juego.campanaNueva()}
    />
  {:else if pantalla.tipo === "partido" && vista.resolucion}
    <Partido
      resolucion={vista.resolucion}
      torneo={vista.torneo}
      {colores}
      visto={vista.relatoVisto}
      {volver}
      alVer={(n) => juego.marcarVisto("relato", n)}
      cierre={vista.cierre}
      partidoSuelto={vista.partidoSuelto}
      alSiguiente={() => (vista.partidoSuelto ? juego.campanaNueva() : juego.siguienteFecha())}
    />
  {:else if contacto}
    {@const c = contacto}
    {@const tipea = tipeoPorChat.has(c.id)}
    <Chat
      eventos={delChat}
      escribiendo={tipea ? c.nombre : null}
      opciones={c.opciones}
      principal={irALaCancha ??
        (c.estado === "sin_contactar" ? { texto: `Escribirle a ${c.nombre}`, minutos: COSTO.mensaje } : null)}
      nota={c.enCamino || c.opciones.length > 0
        ? null
        : c.estado === "confirmado" ? `${c.nombre} está en la lista.` : ROTULO_ESTADO[c.estado]}
      {franja}
      alElegir={(opcionId) => juego.responder(c.id, opcionId)}
      alPrincipal={() => (vista.terminada ? alIrALaCancha() : juego.escribir(c.id))}
    >
      {#snippet cabecera()}
        <Cabecera titulo={c.nombre} subtitulo={tipea ? "escribiendo…" : `${c.rol} · ${ROTULO_ESTADO[c.estado]}`} {volver}>
          {#snippet avatar()}
            <Avatar nombre={c.nombre} id={c.id} estado={c.estado} tam={38} fondo="var(--app-cromo)" />
          {/snippet}
          {#snippet accion()}
            {#if puedeLlamar}
              <button class="llamar" onclick={() => juego.llamar(c.id)} aria-label="Llamar a {c.nombre}, {COSTO.llamar} minutos">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                </svg>
                <span>{COSTO.llamar} min</span>
              </button>
            {/if}
          {/snippet}
        </Cabecera>
      {/snippet}
    </Chat>
  {:else if interrupcion}
    {@const i = interrupcion}
    {@const tipea = tipeoPorChat.has(i.id)}
    <Chat
      eventos={delChat}
      escribiendo={tipea ? i.de : null}
      principal={irALaCancha ?? (i.pendiente ? { texto: "Atender", minutos: i.costoAtender } : null)}
      {franja}
      alPrincipal={() => (vista.terminada ? alIrALaCancha() : juego.atender(i.id))}
    >
      {#snippet cabecera()}
        <Cabecera titulo={i.de} subtitulo={tipea ? "escribiendo…" : i.pendiente ? "esperando que contestes" : "en línea"} {volver}>
          {#snippet avatar()}
            <Avatar nombre={i.de} id={i.id} tam={38} />
          {/snippet}
        </Cabecera>
      {/snippet}
    </Chat>
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--app-fondo);
  }

  .llamar {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 2px 4px;
    color: rgb(255 255 255 / 88%);
  }
  .llamar svg { width: 20px; height: 20px; }
  .llamar span { font-size: calc(10px * var(--escala-ui)); color: rgb(255 255 255 / 55%); font-variant-numeric: tabular-nums; }
</style>
