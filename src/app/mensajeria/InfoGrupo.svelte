<!--
  "Info del grupo", como en cualquier app de mensajes: el nombre del grupo, cómo
  te dicen y quién es quién. Cada personaje lleva su retrato de una línea para
  saber a qué amigo le toca, y se le pone el apodo tocándolo.

  Lo que se escribe queda acá hasta "Listo": recién ahí se arma el viernes con
  los nombres nuevos. Con el viernes empezado solo se mira.
-->
<script lang="ts">
  import { tick, untrack } from "svelte";
  import type { Apodos } from "../../core/apodos.js";
  import type { InfoDelGrupo } from "../estado/juego.svelte.js";
  import BotonPrincipal from "./BotonPrincipal.svelte";
  import Cabecera from "./Cabecera.svelte";
  import { ROL_CORTO } from "./rotulos.js";

  let {
    info,
    volver = null,
    alListo,
  }: {
    info: InfoDelGrupo;
    volver?: { cuenta: number; alVolver: () => void } | null;
    alListo: (apodos: Apodos) => void;
  } = $props();

  /** Lo que se va escribiendo, hasta "Listo". Arranca con lo que había: después es del borrador. */
  let nombre = $state(untrack(() => info.nombre));
  let vos = $state(untrack(() => info.vos));
  let apodos = $state<Record<string, string>>(untrack(() => Object.fromEntries(info.personajes.map((p) => [p.id, p.apodo]))));
  /** Qué se está escribiendo ahora: "grupo", "vos" o el id de un personaje. */
  let editando = $state<string | null>(null);
  let campo = $state<HTMLInputElement | null>(null);

  /** Lo que se le pide a un apodo: algo que entre en la lista. */
  const LARGO = 22;

  async function editar(que: string): Promise<void> {
    if (!info.editable) return;
    editando = que;
    await tick();
    campo?.focus();
    campo?.select();
  }

  function terminar(): void {
    editando = null;
  }

  function teclear(evento: KeyboardEvent): void {
    if (evento.key === "Enter") terminar();
    // Esc cierra lo que se está escribiendo, no abre el menú.
    if (evento.key === "Escape") {
      evento.stopPropagation();
      terminar();
    }
  }

  function listo(): void {
    const contactos = Object.fromEntries(
      Object.entries(apodos)
        .map(([id, a]) => [id, a.trim()] as const)
        .filter(([, a]) => a !== ""),
    );
    alListo({
      ...(Object.keys(contactos).length > 0 ? { contactos } : {}),
      ...(vos.trim() ? { vos: vos.trim() } : {}),
      ...(nombre.trim() ? { grupo: nombre.trim() } : {}),
    });
  }

  const inicial = (s: string): string => s.replace(/^(el|la)\s+/i, "").charAt(0).toUpperCase();
</script>

<div class="pantalla-app">
  <Cabecera titulo="Info del grupo" {volver} />

  <div class="cuerpo">
    <section class="grupo">
      <span class="foto" aria-hidden="true">⚽︎</span>
      {#if editando === "grupo"}
        <input
          class="campo grande"
          bind:this={campo}
          bind:value={nombre}
          maxlength={LARGO + 8}
          aria-label="Nombre del grupo"
          onblur={terminar}
          onkeydown={teclear}
        />
      {:else}
        <button class="valor grande" onclick={() => editar("grupo")} disabled={!info.editable}>
          {nombre || "Sin nombre"}
          {#if info.editable}<span class="lapiz" aria-hidden="true">✎</span>{/if}
        </button>
      {/if}
      <span class="meta">Grupo · {info.personajes.length} participantes</span>
    </section>

    <h3>Cómo te dicen</h3>
    {#if editando === "vos"}
      <input
        class="campo"
        bind:this={campo}
        bind:value={vos}
        maxlength={LARGO}
        placeholder="capi"
        aria-label="Cómo te dicen"
        onblur={terminar}
        onkeydown={teclear}
      />
    {:else}
      <button class="valor" onclick={() => editar("vos")} disabled={!info.editable}>
        <span class:vacio={!vos}>{vos || "capi"}</span>
        {#if info.editable}<span class="lapiz" aria-hidden="true">✎</span>{/if}
      </button>
    {/if}

    <h3>Quién es quién · {info.personajes.length}</h3>
    <ul class="personajes">
      {#each info.personajes as p (p.id)}
        {@const apodo = apodos[p.id]?.trim() ?? ""}
        <li>
          <span class="avatar" aria-hidden="true">{inicial(apodo || p.personaje)}</span>
          <span class="quien">
            {#if editando === p.id}
              <input
                class="campo chico"
                bind:this={campo}
                bind:value={apodos[p.id]}
                maxlength={LARGO}
                placeholder={p.personaje}
                aria-label="Apodo para {p.personaje}"
                onblur={terminar}
                onkeydown={teclear}
              />
            {:else}
              <span class="nombre">
                <span class:sin-apodo={!apodo}>{apodo || p.personaje}</span>
                {#if apodo}<small>era {p.personaje}</small>{/if}
              </span>
            {/if}
            <span class="retrato">{p.retrato} · {ROL_CORTO[p.rol]}</span>
          </span>
          {#if info.editable && editando !== p.id}
            <button class="accion" onclick={() => editar(p.id)}>{apodo ? "Cambiar" : "Poner apodo"}</button>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  <div class="pie">
    {#if info.editable}
      <BotonPrincipal accion={{ texto: "Listo" }} alTocar={listo} />
      <span class="nota">Los podés cambiar entre una fecha y otra</span>
    {:else}
      <span class="nota">Se cambian antes de jugar el viernes</span>
    {/if}
  </div>
</div>

<style>
  .pantalla-app { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--app-papel); }
  .cuerpo { flex: 1; min-height: 0; overflow-y: auto; }

  .grupo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 18px 16px 14px;
    background: var(--app-superficie);
    border-bottom: 1px solid var(--app-linea);
  }
  .foto {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--app-cromo);
    color: #FFFFFF;
    font-size: 26px;
  }
  .meta { font-size: var(--t-micro); color: var(--app-tinta-3); }

  h3 {
    margin: 0;
    padding: 14px 16px 6px;
    font-size: var(--t-micro);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--app-tinta-3);
  }

  .valor,
  .campo {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 16px;
    width: calc(100% - 32px);
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--app-linea);
    background: var(--app-superficie);
    font: inherit;
    font-size: var(--t-nombre);
    font-weight: 600;
    color: var(--app-tinta);
    text-align: left;
  }
  .valor.grande,
  .campo.grande {
    width: auto;
    max-width: calc(100% - 32px);
    padding: 6px 12px;
    background: var(--app-papel);
    font-size: var(--t-titulo);
    font-weight: 700;
    text-align: center;
  }
  .campo { outline: none; border-color: var(--app-tinta-3); }
  .campo.chico { margin: 0; width: 100%; padding: 4px 8px; font-size: var(--t-nombre); }
  .valor:disabled { cursor: default; }
  .lapiz { margin-left: auto; font-size: var(--t-micro); color: var(--app-tinta-3); }
  .grande .lapiz { margin-left: 4px; }
  .vacio { color: var(--app-tinta-3); }

  .personajes {
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--app-superficie);
    border-top: 1px solid var(--app-linea);
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 16px;
    border-bottom: 1px solid var(--app-linea);
  }
  .avatar {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--app-superficie);
    border: 1px solid var(--app-linea);
    font-size: var(--t-meta);
    font-weight: 700;
    color: var(--app-tinta-2);
  }
  .quien { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .nombre { display: flex; align-items: baseline; gap: 6px; font-size: var(--t-nombre); font-weight: 600; color: var(--app-tinta); }
  .nombre small { font-size: var(--t-micro); font-weight: 400; color: var(--app-tinta-3); }
  .sin-apodo { color: var(--app-tinta-3); }
  .retrato {
    font-size: var(--t-micro);
    color: var(--app-tinta-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .accion { flex: none; font-size: var(--t-micro); font-weight: 600; color: var(--app-tinta-3); }
  .accion:hover { color: var(--app-tinta); }

  /* Lo que se toca va centrado: las esquinas de abajo son de los pulgares. */
  .pie {
    flex: none;
    min-height: var(--zona-pulgares);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 12px 0;
    background: var(--app-papel);
    border-top: 1px solid var(--app-linea);
  }
  .nota { font-size: var(--t-micro); color: var(--app-tinta-3); }
</style>
