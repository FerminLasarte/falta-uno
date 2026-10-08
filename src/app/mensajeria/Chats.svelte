<!--
  La bandeja: todo lo que te reclama a la vez. Arriba el grupo y las
  interrupciones, que son chats como cualquier otro. Después la gente, separada
  por en qué está con vos. Los que todavía no escribiste van al final, en una
  grilla compacta: doce filas iguales se leen como un error, no como una agenda.
-->
<script lang="ts">
  import { grupo as grupoDeAmigos } from "../estado/grupo.svelte.js";
  import { CHAT_GRUPO, type EventoFeed, type VistaRoster } from "../../core/partida.js";
  import type { EstadoContacto } from "../../core/tipos.js";
  import type { ContactoEnVista, VistaInterrupcion } from "../estado/juego.svelte.js";
  import Avatar from "./Avatar.svelte";
  import Cabecera from "./Cabecera.svelte";
  import Franja from "./Franja.svelte";
  import ItemChat from "./ItemChat.svelte";
  import { ROL_CORTO, ROTULO_ESTADO, vistaPrevia } from "./rotulos.js";

  let {
    contactos,
    interrupciones,
    escribiendo,
    ultimoDelGrupo,
    grupoSinLeer,
    roster,
    dinero,
    sena,
    alAbrirGrupo,
    alAbrirContacto,
    alAbrirInterrupcion,
  }: {
    contactos: readonly ContactoEnVista[];
    interrupciones: readonly VistaInterrupcion[];
    /** Los chats donde alguien está escribiendo. */
    escribiendo: ReadonlySet<string>;
    ultimoDelGrupo: EventoFeed | null;
    grupoSinLeer: number;
    roster: VistaRoster;
    dinero: number;
    sena: number;
    alAbrirGrupo: () => void;
    alAbrirContacto: (id: string) => void;
    alAbrirInterrupcion: (id: string) => void;
  } = $props();

  const SECCIONES: { titulo: string; estados: readonly EstadoContacto[] }[] = [
    { titulo: "Hablando", estados: ["hablando", "esperando"] },
    { titulo: "En la lista", estados: ["confirmado"] },
    { titulo: "No vienen", estados: ["rechazado", "bajado"] },
  ];

  const recientes = (a: ContactoEnVista, b: ContactoEnVista): number =>
    (b.minutoUltimo ?? 0) - (a.minutoUltimo ?? 0);

  const secciones = $derived(
    SECCIONES.map((s) => ({
      titulo: s.titulo,
      filas: contactos.filter((c) => s.estados.includes(c.estado)).sort(recientes),
    })).filter((s) => s.filas.length > 0),
  );

  const agenda = $derived(contactos.filter((c) => c.estado === "sin_contactar"));

  /* Interrupciones nuevas arriba de todo; las atendidas quedan como chats viejos. */
  const avisos = $derived([...interrupciones].sort((a, b) => b.minuto - a.minuto));

  function lineaDe(c: ContactoEnVista): string {
    return c.ultimoMensaje ?? ROTULO_ESTADO[c.estado];
  }
</script>

<div class="pantalla-app">
  <Cabecera titulo="Chats" />
  <Franja {roster} {dinero} {sena} alTocar={alAbrirGrupo} />

  <div class="bandeja">
    <ItemChat
      titulo={grupoDeAmigos.nombre}
      linea={ultimoDelGrupo ? vistaPrevia(ultimoDelGrupo) : "La lista está vacía"}
      minuto={ultimoDelGrupo?.minuto ?? null}
      sinLeer={grupoSinLeer}
      escribiendo={escribiendo.has(CHAT_GRUPO)}
      alAbrir={alAbrirGrupo}
    >
      {#snippet avatar()}<Avatar nombre={grupoDeAmigos.nombre} id="grupo" grupo />{/snippet}
    </ItemChat>

    {#each avisos as a (a.id)}
      <ItemChat
        titulo={a.de}
        linea={a.atendida ? "Atendido" : a.texto}
        minuto={a.minuto}
        sinLeer={a.sinLeer}
        escribiendo={escribiendo.has(a.id)}
        alAbrir={() => alAbrirInterrupcion(a.id)}
      >
        {#snippet avatar()}<Avatar nombre={a.de} id={a.id} />{/snippet}
      </ItemChat>
    {/each}

    {#each secciones as s (s.titulo)}
      <h3 class="seccion">{s.titulo}</h3>
      {#each s.filas as c (c.id)}
        <ItemChat
          titulo={c.nombre}
          linea={lineaDe(c)}
          minuto={c.minutoUltimo}
          sinLeer={c.sinLeer}
          escribiendo={escribiendo.has(c.id)}
          alAbrir={() => alAbrirContacto(c.id)}
        >
          {#snippet avatar()}<Avatar nombre={c.nombre} id={c.id} estado={c.estado} />{/snippet}
        </ItemChat>
      {/each}
    {/each}

    {#if agenda.length > 0}
      <h3 class="seccion">Agenda · {agenda.length} sin escribir</h3>
      <div class="agenda">
        {#each agenda as c (c.id)}
          <button onclick={() => alAbrirContacto(c.id)}>
            <Avatar nombre={c.nombre} id={c.id} tam={24} />
            <span class="nom">{c.nombre}</span>
            <span class="rol">{ROL_CORTO[c.rol]}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .pantalla-app { flex: 1; min-height: 0; display: flex; flex-direction: column; }

  .bandeja {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    background: var(--app-superficie);
    padding-bottom: var(--zona-pulgares);
  }

  .seccion {
    margin: 0;
    padding: 12px var(--e3) 5px;
    font-size: calc(10.5px * var(--escala-ui));
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--app-tinta-3);
    background: var(--app-fondo);
    border-bottom: 1px solid var(--app-linea);
  }

  .agenda { display: grid; grid-template-columns: 1fr 1fr; }
  .agenda button {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px var(--e3);
    border-bottom: 1px solid var(--app-linea);
    font-size: calc(13.5px * var(--escala-ui));
    font-weight: 500;
  }
  .agenda button:nth-child(odd) { border-right: 1px solid var(--app-linea); }
  .agenda button:hover { background: var(--app-hover); }
  .nom { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rol {
    font-size: calc(9.5px * var(--escala-ui));
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--app-tinta-3);
  }
</style>
