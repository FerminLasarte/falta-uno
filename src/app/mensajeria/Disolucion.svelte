<!--
  El equipo se disolvió: el grupo se vacía de a uno. Un par se despide, los
  demás se van sin decir nada, y al final quedás solo. No hay nada que tocar:
  cuando termina, pasa al resumen de la campaña.
-->
<script lang="ts">
  import { AGUANTE } from "../../core/campana.js";
  import { CHAT_GRUPO, type EventoFeed } from "../../core/partida.js";
  import Avatar from "./Avatar.svelte";
  import Cabecera from "./Cabecera.svelte";
  import Charla from "./Charla.svelte";
  import { NOMBRE_GRUPO } from "./rotulos.js";

  let {
    nombres,
    minuto,
    alTerminar,
  }: {
    /** Los del grupo, en el orden en que se van a ir. */
    nombres: readonly string[];
    /** El minuto del día en que empieza a vaciarse. */
    minuto: number;
    alTerminar: () => void;
  } = $props();

  const PASO_MS = 900;
  const FINAL_MS = 2400;
  const EN_LETRAS = ["", "un", "dos", "tres", "cuatro", "cinco", "seis"];

  /** Quién dice qué y quién se va, en orden. Lo último: te quedás solo. */
  const guion = $derived.by((): { evento: EventoFeed; seVa: readonly string[] }[] => {
    const [a, b, c, d, e, ...resto] = nombres;
    let m = minuto;
    const dice = (de: string, texto: string) => ({
      evento: { minuto: m++, de, texto, clase: "mensaje" as const, chat: CHAT_GRUPO },
      seVa: [],
    });
    const seVan = (quienes: readonly string[]) => ({
      evento: {
        minuto: m,
        de: "Sistema",
        texto:
          quienes.length === 1
            ? `${quienes[0]} salió del grupo`
            : quienes.length === 2
              ? `${quienes[0]} y ${quienes[1]} salieron del grupo`
              : `${quienes.slice(0, 2).join(", ")} y ${quienes.length - 2} más salieron del grupo`,
        clase: "sistema" as const,
        chat: CHAT_GRUPO,
      },
      seVa: quienes,
    });
    const pasos = [];
    if (a) pasos.push(dice(a, `bueno muchachos, así no da. ${EN_LETRAS[AGUANTE.fechasSinPartido] ?? AGUANTE.fechasSinPartido} viernes sin jugar`));
    if (b) pasos.push(dice(b, "me sumo a otro equipo, sin rencor"), seVan([b]));
    if (d) pasos.push(seVan([d]));
    if (e) pasos.push(seVan([e]));
    if (c) pasos.push(dice(c, "se veía venir"), seVan([c]));
    const quedan = [a, ...resto].filter((x): x is string => x !== undefined);
    if (quedan.length > 0) pasos.push(seVan(quedan));
    pasos.push({
      evento: { minuto: m, de: "Sistema", texto: "Quedaste solo en el grupo", clase: "sistema" as const, chat: CHAT_GRUPO, cierre: true as const },
      seVa: [],
    });
    return pasos;
  });

  let mostrados = $state(0);

  $effect(() => {
    const espera = mostrados >= guion.length ? FINAL_MS : PASO_MS;
    const reloj = setTimeout(() => {
      if (mostrados >= guion.length) alTerminar();
      else mostrados++;
    }, espera);
    return () => clearTimeout(reloj);
  });

  const enPantalla = $derived(guion.slice(0, mostrados));
  const idos = $derived(new Set(enPantalla.flatMap((p) => p.seVa)));
  /* El subtítulo del grupo se va achicando con cada uno que se va. */
  const integrantes = $derived(
    [...nombres.filter((n) => !idos.has(n))].sort((x, y) => x.localeCompare(y, "es")).concat("vos").join(", "),
  );
</script>

<div class="pantalla-app">
  <Cabecera titulo={NOMBRE_GRUPO} subtitulo={integrantes}>
    {#snippet avatar()}
      <Avatar nombre={NOMBRE_GRUPO} id="grupo" grupo tam={38} />
    {/snippet}
  </Cabecera>
  <Charla eventos={enPantalla.map((p) => p.evento)} mostrarNombres />
  <div class="zona-pulgares"></div>
</div>

<style>
  .pantalla-app { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--app-papel); }
  .zona-pulgares { flex: none; min-height: var(--zona-pulgares); }
</style>
