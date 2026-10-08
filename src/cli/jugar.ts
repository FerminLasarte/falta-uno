import { crearLector } from "./entrada.js";
import { alDia, Partida, type EventoFeed } from "../core/partida.js";
import { agendaDe } from "../core/perfiles.js";
import { resolver } from "../core/resolucion.js";
import { formatearHora } from "../core/tiempo.js";
import { cargarContenido, ErrorDeContenido } from "../datos/cargar.js";
import { ROLES, type Rol } from "../core/tipos.js";

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  verde: "\x1b[32m",
  ambar: "\x1b[33m",
  rojo: "\x1b[31m",
  cian: "\x1b[36m",
  gris: "\x1b[90m",
} as const;

const lector = crearLector();

/** Cualquier pregunta sin respuesta (EOF) corta el viernes con lo que haya. */
async function preguntar(prompt: string): Promise<string> {
  const respuesta = await lector.preguntar(prompt);
  if (respuesta === null) throw new SalidaAnticipada();
  return respuesta;
}

class SalidaAnticipada extends Error {}

const contenido = await cargarContenido().catch((error: unknown) => {
  if (error instanceof ErrorDeContenido) {
    console.error(`\n✗ ${error.message}\n`);
    process.exit(1);
  }
  throw error;
});

// --------------------------------------------------------------- arranque

console.log(`\n${C.bold}FALTA UNO${C.reset} ${C.dim}— viernes, 19:00${C.reset}\n`);
contenido.perfiles.forEach((p, i) => {
  console.log(`  ${C.bold}${i + 1}${C.reset}. ${p.nombre}`);
  console.log(`     ${C.verde}+${C.reset} ${p.ventaja}`);
  console.log(`     ${C.rojo}−${C.reset} ${p.desventaja}\n`);
});

const eleccion = Number(await preguntar("Elegí perfil (1-3): "));
const perfil = contenido.perfiles[Math.min(Math.max(eleccion, 1), 3) - 1] ?? contenido.perfiles[0]!;
const semilla = process.env["SEMILLA"] ?? String(Date.now());

const partida = new Partida({
  perfil,
  agenda: agendaDe(perfil, contenido.perfiles, contenido.contactos),
  interrupciones: contenido.interrupciones,
  grupo: contenido.grupo,
  config: contenido.config,
  semilla,
});

console.log(`\n${C.dim}Perfil: ${perfil.nombre} · semilla: ${semilla}${C.reset}`);

// ------------------------------------------------------------------- render

function barra(valor: number, max: number, ancho = 14): string {
  const lleno = Math.round((valor / max) * ancho);
  const color = valor > max * 0.5 ? C.verde : valor > max * 0.25 ? C.ambar : C.rojo;
  return `${color}${"█".repeat(lleno)}${C.gris}${"░".repeat(Math.max(0, ancho - lleno))}${C.reset}`;
}

function pintarEvento(e: EventoFeed): void {
  const hora = `${C.gris}${formatearHora(e.minuto)}${C.reset}`;
  switch (e.clase) {
    case "propio":
      console.log(`  ${hora} ${C.cian}vos →${C.reset} ${e.texto}`);
      break;
    case "mensaje":
      if (e.audio) {
        // Lo que dice un audio recién se sabe escuchándolo.
        console.log(
          `  ${hora} ${C.bold}${e.de}:${C.reset} ${C.cian}▶ audio ${duracion(e.audio.segundos)}${C.reset}` +
            `${C.gris} — [o] para escucharlo (${e.audio.costo}′)${C.reset}`,
        );
        break;
      }
      if (e.cita) console.log(`        ${C.gris}↪ ${e.cita.de}: ${e.cita.texto}${C.reset}`);
      console.log(`  ${hora} ${C.bold}${e.de}:${C.reset} ${e.texto}`);
      break;
    case "alerta":
      console.log(`  ${hora} ${C.ambar}▲ ${e.de}:${C.reset} ${e.texto}`);
      break;
    default:
      console.log(`  ${hora} ${C.gris}${e.texto}${C.reset}`);
  }
}

function duracion(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

function hud(): void {
  const r = partida.roster();
  const faltan = r.faltantes.map((f) => `${f.faltan} ${f.rol}`).join(", ");
  console.log(`\n${C.gris}${"─".repeat(64)}${C.reset}`);
  console.log(
    `  ${C.bold}${formatearHora(partida.reloj.minutos)}${C.reset}  ` +
      `${C.gris}quedan ${partida.reloj.restante}′${C.reset}   ` +
      `moral ${barra(partida.moral, 100)} ${String(partida.moral).padStart(3)}   ` +
      `$${partida.dinero}`,
  );
  const listo = r.confirmados >= r.necesarios;
  console.log(
    `  ${listo ? C.verde : C.ambar}${r.confirmados}/${r.necesarios}${C.reset} confirmados` +
      (faltan ? `${C.gris} — faltan ${faltan}${C.reset}` : `${C.verde} — plantel completo${C.reset}`),
  );
  for (const i of partida.interrupcionesActivas) {
    console.log(`  ${C.rojo}● ${i.definicion.de} sigue esperando respuesta${C.reset}`);
  }
  if (partida.accionCalmar) console.log(`  ${C.rojo}● Hay pelea en el grupo${C.reset}`);
  console.log(`${C.gris}${"─".repeat(64)}${C.reset}`);
}

const ETIQUETA: Record<string, string> = {
  sin_contactar: `${C.gris}sin escribir${C.reset}`,
  esperando: `${C.ambar}esperando${C.reset}`,
  hablando: `${C.cian}hablando${C.reset}`,
  confirmado: `${C.verde}confirmado${C.reset}`,
  rechazado: `${C.rojo}no viene${C.reset}`,
  bajado: `${C.rojo}se bajó${C.reset}`,
};

// --------------------------------------------------------------- bucle

// El grupo ya está hablando cuando abrís el teléfono.
alDia(partida);
for (const e of partida.eventos()) pintarEvento(e);

try {
  await bucle();
} catch (error) {
  if (!(error instanceof SalidaAnticipada)) throw error;
  console.log(`\n  ${C.gris}(se cortó la entrada — resolviendo con lo que hay)${C.reset}`);
}

async function bucle(): Promise<void> {
while (!partida.terminada) {
  hud();
  const contactos = partida.contactos();
  contactos.forEach((c, i) => {
    const accionable =
      c.estado === "sin_contactar" || c.opciones.length > 0
        ? `${C.bold}‹${C.reset}`
        : " ";
    console.log(
      `  ${accionable}${String(i + 1).padStart(2)}. ${c.nombre.padEnd(16)} ` +
        `${C.gris}${c.rol.padEnd(14)}${C.reset} ${ETIQUETA[c.estado] ?? c.estado}`,
    );
  });
  console.log(
    `\n  ${C.gris}[a]${C.reset} atender pendientes   ` +
      `${C.gris}[p]${C.reset} pagar vacante ($${contenido.config.costoVacante})   ` +
      `${C.gris}[e]${C.reset} esperar 10′   ${C.gris}[q]${C.reset} cortar`,
  );
  const calmar = partida.accionCalmar;
  const audios = partida.audiosSinEscuchar();
  if (calmar || audios.length > 0) {
    console.log(
      `  ${C.gris}grupo:${C.reset}` +
        (audios.length > 0 ? `   ${C.gris}[o]${C.reset} escuchar audios (${audios.length})` : "") +
        (calmar ? `   ${C.gris}[c]${C.reset} ${calmar.texto} (${calmar.costoReloj}′)` : ""),
    );
  }

  const entrada = (await preguntar("\n> ")).trim().toLowerCase();
  console.log("");

  if (entrada === "q") return;

  if (entrada === "a") {
    const pendientes = partida.interrupcionesActivas;
    if (pendientes.length === 0) {
      console.log(`  ${C.gris}No hay nada pendiente.${C.reset}`);
      continue;
    }
    pendientes.forEach((i, n) =>
      console.log(`  ${n + 1}. ${i.definicion.de} ${C.gris}(${i.definicion.costoAtender}′)${C.reset}`),
    );
    const cual = Number(await preguntar("  ¿Cuál? ")) - 1;
    const elegida = pendientes[cual];
    if (elegida) mostrar(partida.atender(elegida.definicion.id));
    continue;
  }

  if (entrada === "p") {
    console.log(`  Roles: ${ROLES.map((r, i) => `${i + 1}. ${r}`).join("   ")}`);
    const cual = Number(await preguntar("  ¿Qué rol comprás? ")) - 1;
    const rol = ROLES[cual] as Rol | undefined;
    if (rol) mostrar(partida.pagarVacante(rol));
    continue;
  }

  if (entrada === "c") {
    mostrar(partida.calmar());
    continue;
  }

  if (entrada === "o") {
    const audios = partida.audiosSinEscuchar();
    if (audios.length === 0) {
      console.log(`  ${C.gris}No hay audios sin escuchar.${C.reset}`);
      continue;
    }
    audios.forEach((a, n) =>
      console.log(`  ${n + 1}. ${a.de} ${C.gris}${duracion(a.segundos)} (${a.costo}′)${C.reset}`),
    );
    const elegido = audios[Number(await preguntar("  ¿Cuál? ")) - 1];
    if (!elegido) continue;
    const resultado = partida.escuchar(elegido.id);
    const dicho = partida.eventos().find((e) => e.audio?.id === elegido.id);
    if (resultado.ok && dicho) console.log(`  ${C.bold}${dicho.de}:${C.reset} «${dicho.texto}»`);
    mostrar(resultado);
    continue;
  }

  if (entrada === "e") {
    mostrar(partida.esperar(10));
    continue;
  }

  const indice = Number(entrada) - 1;
  const contacto = contactos[indice];
  if (!contacto) {
    console.log(`  ${C.gris}No entendí.${C.reset}`);
    continue;
  }

  if (contacto.estado === "sin_contactar") {
    mostrar(partida.escribir(contacto.id));
    continue;
  }

  if (contacto.opciones.length === 0) {
    const puedeLlamar = contacto.estado === "hablando" || contacto.estado === "confirmado";
    if (!puedeLlamar) {
      console.log(`  ${C.gris}No hay nada que hacer con ${contacto.nombre}.${C.reset}`);
      continue;
    }
    const si = (await preguntar(`  ¿Llamar a ${contacto.nombre}? (8′, −3 moral) [s/N] `)).trim();
    if (si.toLowerCase() === "s") mostrar(partida.llamar(contacto.id));
    continue;
  }

  console.log(`  ${C.bold}${contacto.nombre}${C.reset}`);
  contacto.opciones.forEach((o, n) =>
    console.log(`   ${n + 1}. ${o.texto} ${C.gris}(${o.costoReloj}′)${C.reset}`),
  );
  console.log(`   0. ${C.gris}volver${C.reset}`);
  const cual = Number(await preguntar("  > ")) - 1;
  const opcion = contacto.opciones[cual];
  if (opcion) mostrar(partida.responder(contacto.id, opcion.id));
}

}

function mostrar(resultado: { ok: boolean; error?: string; nuevos: readonly EventoFeed[] }): void {
  if (!resultado.ok && resultado.error) {
    console.log(`  ${C.rojo}${resultado.error}${C.reset}`);
    return;
  }
  for (const e of resultado.nuevos) pintarEvento(e);
  // En la consola no hay tiempo real: después de cada acción llega todo lo que estaba en camino.
  const desde = partida.eventos().length;
  alDia(partida);
  for (const e of partida.eventos().slice(desde)) pintarEvento(e);
}

// ------------------------------------------------------------- resolución

console.log(`\n${C.gris}${"═".repeat(64)}${C.reset}`);
console.log(`  ${C.bold}21:00 — se corta el chat${C.reset}\n`);

const r = resolver(partida);

if (!r.hayPartido) {
  console.log(`  ${C.rojo}${r.motivoSinPartido}${C.reset}\n`);
} else {
  for (const d of r.desglose) {
    const signo = d.valor >= 0 ? `${C.verde}+` : `${C.rojo}−`;
    console.log(
      `  ${d.concepto.padEnd(44)} ${signo}${String(Math.abs(d.valor)).padStart(3)}${C.reset}`,
    );
  }
  console.log(`  ${C.gris}${"─".repeat(52)}${C.reset}`);
  console.log(`  ${C.bold}Probabilidad de victoria${C.reset}${" ".repeat(20)} ${C.bold}${r.probabilidad}%${C.reset}\n`);

  for (const beat of r.narracion) {
    const color = beat.signo > 0 ? C.verde : beat.signo < 0 ? C.rojo : C.ambar;
    console.log(`  ${C.gris}${String(beat.minuto).padStart(2)}′${C.reset} ${color}│${C.reset} ${beat.texto}`);
    if (beat.porque) console.log(`      ${color}│${C.reset} ${C.gris}↳ ${beat.porque}${C.reset}`);
  }

  console.log(
    `\n  ${r.gano ? C.verde + "GANARON" : C.rojo + "PERDIERON"} ${r.golesFavor}-${r.golesContra}${C.reset}` +
      `  ${C.gris}(+$${r.recompensa.dinero}, prestigio ${r.recompensa.prestigio > 0 ? "+" : ""}${r.recompensa.prestigio})${C.reset}\n`,
  );
}

lector.cerrar();
