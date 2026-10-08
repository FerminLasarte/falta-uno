<!--
  Pasó la semana. El teléfono está bloqueado un momento antes de las 19 del
  viernes siguiente: el torneo avisa contra quién se juega y cómo vienen, y el
  complejo recuerda la seña y lo que tenés a favor o debés. Se ve un rato y se
  desbloquea solo en el grupo: no hay nada que tocar.
-->
<script lang="ts">
  import type { Campana } from "../../core/campana.js";
  import Avatar from "../mensajeria/Avatar.svelte";
  import { pesos } from "../mensajeria/rotulos.js";
  import type { Vista } from "../estado/juego.svelte.js";

  let {
    hora,
    torneo,
    campana,
    sena,
    nombreGrupo,
    complejo,
    chatCancha,
    alDesbloquear,
  }: {
    /** La hora del bloqueo: un rato antes de que arranque el viernes. */
    hora: string;
    torneo: Vista["torneo"];
    campana: Campana;
    sena: number;
    nombreGrupo: string;
    /** Quién escribe por la cancha, y su chat: con eso sale la misma foto que en la app. */
    complejo: string;
    chatCancha: string;
    alDesbloquear: () => void;
  } = $props();

  /** Lo que dura a la vista. Lo justo para leer las dos notificaciones. */
  const BLOQUEADO_MS = 3000;

  $effect(() => {
    const reloj = setTimeout(alDesbloquear, BLOQUEADO_MS);
    return () => clearTimeout(reloj);
  });

  /** "Van 1 ganado y 2 perdidos.", "Van 1 sin jugar." */
  const comoVienen = $derived.by(() => {
    const ganados = campana.jugadas.filter((j) => j.hayPartido && j.gano).length;
    const perdidos = campana.jugadas.filter((j) => j.hayPartido && !j.gano).length;
    const sinJugar = campana.jugadas.filter((j) => !j.hayPartido).length;
    const partes = [
      ...(ganados > 0 ? [`${ganados} ${ganados === 1 ? "ganado" : "ganados"}`] : []),
      ...(perdidos > 0 ? [`${perdidos} ${perdidos === 1 ? "perdido" : "perdidos"}`] : []),
      ...(sinJugar > 0 ? [`${sinJugar} sin jugar`] : []),
    ];
    if (partes.length === 0) return "";
    const ultima = partes.pop();
    return ` Van ${partes.length > 0 ? `${partes.join(", ")} y ${ultima}` : ultima}.`;
  });

  const saldo = $derived(
    campana.dinero > 0
      ? ` Tienen ${pesos(campana.dinero)} a favor.`
      : campana.dinero < 0
        ? ` Y nos deben ${pesos(-campana.dinero)} de la fecha pasada.`
        : "",
  );
</script>

<div class="bloqueo" aria-label="Teléfono bloqueado">
  <div class="arriba">
    <span class="dia">viernes</span>
    <span class="reloj">{hora}</span>
  </div>
  <div class="notis">
    <article class="noti" style:--orden={0}>
      <span class="ic">{torneo.fecha.replace("Fecha ", "F")}</span>
      <span class="de">{torneo.nombre}</span>
      <span class="cuando">18:30</span>
      <p class="txt"><b>{torneo.fecha}, hoy 21 h:</b> {nombreGrupo} contra {torneo.rival}.{comoVienen}</p>
    </article>
    <article class="noti" style:--orden={1}>
      <span class="foto"><Avatar nombre={complejo} id={chatCancha} tam={30} /></span>
      <span class="de">{complejo}</span>
      <span class="cuando">18:41</span>
      <p class="txt">Les recordamos que la seña de hoy son {pesos(sena)}.{saldo}</p>
    </article>
  </div>
</div>

<style>
  .bloqueo {
    flex: 1;
    display: flex;
    flex-direction: column;
    color: #FFFFFF;
    background: radial-gradient(120% 70% at 50% 0%, #3A3F45 0%, #1C1F23 55%, #101214 100%);
    padding-top: calc(var(--camara-centro) * 2);
  }

  .arriba { display: grid; justify-items: center; margin-top: 8px; }
  .dia { font-size: calc(15px * var(--escala-ui)); font-weight: 600; color: rgb(255 255 255 / 78%); }
  .reloj {
    font-family: var(--fuente-cromo);
    font-weight: 600;
    font-size: calc(84px * var(--escala-ui));
    letter-spacing: -0.03em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  /* Las notificaciones quedan por encima de los pulgares. */
  .notis {
    margin-top: auto;
    padding: 0 10px calc(var(--zona-pulgares) + 6px);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .noti {
    display: grid;
    grid-template-columns: 30px 1fr auto;
    column-gap: 10px;
    padding: 10px 12px 11px;
    border-radius: 18px;
    background: rgb(255 255 255 / 13%);
    animation: llegar 420ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
    animation-delay: calc(250ms + var(--orden) * 350ms);
  }
  .ic {
    grid-row: 1 / span 2;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: #2B3138;
    display: grid;
    place-items: center;
    font-size: calc(10px * var(--escala-ui));
    font-weight: 700;
    color: #E9EDF0;
  }
  .foto { grid-row: 1 / span 2; }
  .de { font-size: calc(13px * var(--escala-ui)); font-weight: 700; }
  .cuando { font-size: calc(11.5px * var(--escala-ui)); color: rgb(255 255 255 / 55%); }
  .txt {
    grid-column: 2 / span 2;
    margin: 0;
    font-size: calc(13.5px * var(--escala-ui));
    line-height: 1.33;
    color: rgb(255 255 255 / 88%);
  }
  .txt b { color: #FFFFFF; }

  @keyframes llegar {
    from { opacity: 0; translate: 0 10px; }
    to { opacity: 1; translate: 0 0; }
  }
</style>
