/**
 * Diagnóstico de plataforma. No es el juego: es la pantalla que hace visible el
 * riesgo de plataforma en cada máquina donde se corra, incluida la Steam Deck.
 * Vive hasta que la Fase 3 la reemplace por el teléfono.
 */
import type { EstadoSteam } from "../../electron/steam.js";
import type { Versiones } from "../../electron/canal.js";

const LOGRO_DE_PRUEBA = "PRIMER_VIERNES";
const ARCHIVO_DE_PRUEBA = "prueba-plataforma.json";

const app = document.getElementById("app")!;
const bitacora: string[] = [];

function anotar(texto: string): void {
  const hora = new Date().toLocaleTimeString("es-AR", { hour12: false });
  bitacora.unshift(`${hora}  ${texto}`);
  const consola = document.getElementById("consola");
  if (consola) consola.textContent = bitacora.slice(0, 40).join("\n");
}

function fila(termino: string, valor: string): string {
  return `<div class="fila"><dt>${termino}</dt><dd>${escapar(valor)}</dd></div>`;
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

function siNo(valor: boolean | undefined): string {
  return valor === undefined ? "—" : valor ? "sí" : "no";
}

function gamepads(): string {
  const conectados = [...navigator.getGamepads()].filter((g) => g !== null);
  if (conectados.length === 0) return "ninguno conectado";
  return conectados.map((g) => g!.id).join(", ");
}

async function dibujar(): Promise<void> {
  const [versiones, steam] = await Promise.all([
    window.faltaUno.versiones() as Promise<Versiones>,
    window.faltaUno.estadoSteam() as Promise<EstadoSteam>,
  ]);

  const clase = steam.disponible ? "ok" : "alerta";
  const rotulo = steam.disponible ? "Steam conectado" : "Sin Steam — el juego arranca igual";

  app.innerHTML = `
    <h1><span>Falta Uno · Fase 2</span>Diagnóstico de plataforma</h1>

    <section class="panel">
      <h2>Steam</h2>
      <p class="estado ${clase}">${rotulo}</p>
      ${steam.disponible ? "" : `<p class="motivo">${escapar(steam.motivo ?? "motivo desconocido")}</p>`}
      <dl class="filas" style="margin-top:16px">
        ${fila("App ID", String(steam.appId ?? "—"))}
        ${fila("Usuario", steam.usuario ?? "—")}
        ${fila("Steam ID", steam.steamId ?? "—")}
        ${fila("Corriendo en Steam Deck", siNo(steam.enSteamDeck))}
        ${fila("Cloud habilitado en la cuenta", siNo(steam.cloudHabilitadoEnCuenta))}
        ${fila("Cloud habilitado en la app", siNo(steam.cloudHabilitadoEnApp))}
        ${fila("Idioma del cliente", steam.idioma ?? "—")}
      </dl>
    </section>

    <section class="panel">
      <h2>Runtime</h2>
      <dl class="filas">
        ${fila("Versión del juego", versiones.app)}
        ${fila("Electron", versiones.electron)}
        ${fila("Chromium", versiones.chrome)}
        ${fila("Node", versiones.node)}
        ${fila("V8", versiones.v8)}
        ${fila("Plataforma", `${versiones.plataforma} · ${versiones.arquitectura}`)}
        ${fila("Build", versiones.empaquetado ? "empaquetado" : "desarrollo")}
        ${fila("Pantalla", `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`)}
        ${fila("Gamepads", gamepads())}
      </dl>
    </section>

    <section class="panel">
      <h2>Pruebas</h2>
      <div class="acciones">
        <button id="logro-activar">Activar logro de prueba</button>
        <button id="logro-consultar">¿Está activado?</button>
        <button id="logro-limpiar">Limpiar logro</button>
        <button id="guardar">Guardar partida de prueba</button>
        <button id="cargar">Cargar partida</button>
        <button id="listar">Listar archivos en la nube</button>
      </div>
      <div class="consola" id="consola"></div>
    </section>

    <footer>
      Probá con Tab y con el D-pad: todo tiene que ser alcanzable sin mouse.
    </footer>
  `;

  conectar("logro-activar", async () => {
    const ok = await window.faltaUno.activarLogro(LOGRO_DE_PRUEBA);
    anotar(ok ? `logro "${LOGRO_DE_PRUEBA}" activado` : `no se pudo activar (¿Steam conectado?)`);
  });

  conectar("logro-consultar", async () => {
    const activo = await window.faltaUno.logroActivado(LOGRO_DE_PRUEBA);
    anotar(`logro "${LOGRO_DE_PRUEBA}": ${activo ? "activado" : "sin activar"}`);
  });

  conectar("logro-limpiar", async () => {
    const ok = await window.faltaUno.limpiarLogro(LOGRO_DE_PRUEBA);
    anotar(ok ? "logro limpiado" : "no se pudo limpiar");
  });

  conectar("guardar", async () => {
    const carga = JSON.stringify({ guardadoEl: new Date().toISOString(), semilla: "prueba" });
    const destino = await window.faltaUno.guardar(ARCHIVO_DE_PRUEBA, carga);
    anotar(`guardado → local: ${siNo(destino.local)} · nube: ${siNo(destino.nube)}`);
  });

  conectar("cargar", async () => {
    const { contenido, origen } = await window.faltaUno.cargar(ARCHIVO_DE_PRUEBA);
    anotar(contenido === null ? "no hay partida guardada" : `leído de ${origen}: ${contenido}`);
  });

  conectar("listar", async () => {
    const archivos = await window.faltaUno.archivosEnNube();
    anotar(
      archivos.length === 0
        ? "la nube no devolvió archivos"
        : archivos.map((a) => `${a.nombre} (${a.bytes} B)`).join(", "),
    );
  });

  anotar(
    steam.disponible
      ? `Steam listo · app ${steam.appId} · ${steam.usuario}`
      : "Steam no disponible: las pruebas de logro y nube van a fallar, y está bien.",
  );
}

function conectar(id: string, accion: () => Promise<void>): void {
  const boton = document.getElementById(id);
  boton?.addEventListener("click", () => {
    void accion().catch((error: unknown) => anotar(`error: ${String(error)}`));
  });
}

window.addEventListener("gamepadconnected", () => void dibujar());
void dibujar();
