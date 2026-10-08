import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { CANALES, type Versiones } from "./canal.js";
import { cargarContenido, ErrorDeContenido, type Contenido } from "../src/datos/cargar.js";
import { cargar, configurarCarpeta, guardar } from "./guardado.js";
import { carpetaBundle } from "./rutas.js";
import {
  cerrarSteam,
  estadoSteam,
  iniciarSteam,
  logros,
  nube,
  prepararOverlay,
  relanzarPorSteamSiHaceFalta,
} from "./steam.js";

const aquí = carpetaBundle;
const esProduccion = app.isPackaged;

// El overlay setea switches de línea de comandos: tiene que ser lo primero,
// antes de que Electron quede listo. Después ya no tienen efecto.
prepararOverlay();

// Si el proceso que nos lanzó ya no está (se cerró la terminal, o el script que
// nos levantó terminó sin matarnos), el próximo log tira EPIPE. Sin esto,
// Electron se lo muestra al jugador como un diálogo de error del proceso
// principal. Los logs son diagnóstico: si nadie los lee, se pierden y listo.
for (const salida of [process.stdout, process.stderr]) {
  salida.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") throw error;
  });
}

// Si Steam tiene que relanzarnos, este proceso sobra.
if (relanzarPorSteamSiHaceFalta(esProduccion)) app.quit();

const estadoInicial = iniciarSteam();
console.log(
  estadoInicial.disponible
    ? `[steam] conectado · app ${estadoInicial.appId} · ${estadoInicial.usuario}`
    : `[steam] sin conexión (${estadoInicial.motivo}) — el juego arranca igual`,
);

/**
 * Diagnóstico headless. Es lo que se corre por SSH en una Steam Deck o en una
 * máquina de CI para verificar la plataforma sin abrir una ventana.
 *
 *   FALTA_UNO_DIAGNOSTICO=1 ./FaltaUno
 */
if (process.env["FALTA_UNO_DIAGNOSTICO"] === "1") {
  void app.whenReady().then(() => {
    console.log(
      JSON.stringify(
        {
          steam: estadoInicial,
          runtime: {
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            node: process.versions.node,
            plataforma: process.platform,
            arquitectura: process.arch,
            empaquetado: esProduccion,
          },
          rutas: { datos: app.getPath("userData"), bundle: aquí },
        },
        null,
        2,
      ),
    );
    app.exit(estadoInicial.disponible ? 0 : 2);
  });
}

/**
 * El contenido lo carga y valida el proceso principal, no la ventana: así el
 * validador con zod corre también en el build empaquetado, y la ventana nunca
 * toca el disco. Si el contenido está roto, el juego no arranca — que es
 * exactamente el contrato prometido en el diseño.
 */
let contenido: Contenido | null = null;

async function cargarContenidoDelJuego(): Promise<void> {
  const raiz = esProduccion ? join(process.resourcesPath, "contenido") : "contenido";
  try {
    contenido = await cargarContenido(raiz);
    console.log(`[contenido] ${contenido.contactos.length} contactos cargados desde ${raiz}`);
  } catch (error) {
    if (error instanceof ErrorDeContenido) {
      console.error(`\n[contenido] EL JUEGO NO PUEDE ARRANCAR\n${error.message}\n`);
    } else {
      console.error(`[contenido] no se pudo leer desde ${raiz}: ${String(error)}`);
    }
    app.exit(3);
  }
}

function crearVentana(): void {
  const ventana = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0d1310",
    show: false,
    title: "Falta Uno",
    webPreferences: {
      preload: join(aquí, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // El latido que le pasa el tiempo real al núcleo tiene que ser parejo
      // aunque la ventana no tenga el foco: Chromium no puede frenarle los
      // timers. Con la ventana oculta, es el juego el que frena el tiempo real.
      backgroundThrottling: false,
    },
  });

  ventana.once("ready-to-show", () => ventana.show());

  // Trazas de arranque: son lo que lee el smoke test y lo que te dice qué pasó
  // cuando el juego abre en negro en una máquina que no tenés adelante.
  ventana.webContents.on("did-finish-load", () => {
    console.log("[ventana] cargada");
    void capturarSiSePidio(ventana);
  });
  ventana.webContents.on("did-fail-load", (_e, codigo, descripcion) =>
    console.error(`[ventana] no cargó (${codigo}): ${descripcion}`),
  );
  ventana.webContents.on("preload-error", (_e, ruta, error) =>
    console.error(`[preload] falló ${ruta}: ${error.message}`),
  );
  ventana.webContents.on("render-process-gone", (_e, detalle) =>
    console.error(`[ventana] se murió el renderer: ${detalle.reason}`),
  );
  ventana.webContents.on("console-message", (_e, nivel, mensaje) => {
    if (nivel >= 2) console.error(`[renderer] ${mensaje}`);
  });

  // Nada de este juego navega afuera. Cualquier link externo va al navegador.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  ventana.webContents.on("will-navigate", (evento) => evento.preventDefault());

  const servidorDev = process.env["VITE_DEV_SERVER_URL"];
  if (servidorDev) {
    void ventana.loadURL(servidorDev);
    ventana.webContents.openDevTools({ mode: "detach" });
  } else {
    // FALTA_UNO_MORAL fuerza un estado de moral. Sirve para capturar la
    // degradación en cualquier punto sin tener que jugar hasta ahí, y para
    // sacar las imágenes de la ficha de Steam en el momento exacto.
    const moral = process.env["FALTA_UNO_MORAL"];
    void ventana.loadFile(join(aquí, "..", "renderer", "index.html"), {
      ...(moral ? { query: { moral } } : {}),
    });
  }
}

// Una sola instancia: dos copias peleando por el mismo save es corrupción segura.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [ventana] = BrowserWindow.getAllWindows();
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });

  void app.whenReady().then(async () => {
    configurarCarpeta(app.getPath("userData"));
    await cargarContenidoDelJuego();
    registrarCanales();
    crearVentana();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => cerrarSteam());

/**
 * Captura la ventana a un PNG y cierra. Sirve para verificar la interfaz sin
 * tener la máquina adelante (una Deck por SSH, un runner de CI) y para sacar
 * las imágenes de la ficha de Steam sin pantallazos a mano.
 *
 *   FALTA_UNO_CAPTURA=/ruta/captura.png npm run build && npx electron .
 */
async function capturarSiSePidio(ventana: BrowserWindow): Promise<void> {
  const destino = process.env["FALTA_UNO_CAPTURA"];
  if (!destino) return;
  try {
    // Un respiro para que termine de pintar antes de la foto.
    await new Promise((seguir) => setTimeout(seguir, 900));
    const imagen = await ventana.webContents.capturePage();
    await writeFile(destino, imagen.toPNG());
    console.log(`[ventana] captura guardada en ${destino}`);
  } catch (error) {
    console.error(`[ventana] no se pudo capturar: ${String(error)}`);
  }
  app.exit(0);
}

function registrarCanales(): void {
  ipcMain.handle(CANALES.versiones, (): Versiones => {
    return {
      electron: process.versions.electron ?? "?",
      chrome: process.versions.chrome ?? "?",
      node: process.versions.node,
      v8: process.versions.v8 ?? "?",
      app: app.getVersion(),
      plataforma: process.platform,
      arquitectura: process.arch,
      empaquetado: esProduccion,
    };
  });

  ipcMain.handle(CANALES.contenido, () => contenido);
  ipcMain.handle(CANALES.estadoSteam, () => estadoSteam());
  ipcMain.handle(CANALES.activarLogro, (_e, id: string) => logros.activar(id));
  ipcMain.handle(CANALES.logroActivado, (_e, id: string) => logros.activado(id));
  ipcMain.handle(CANALES.limpiarLogro, (_e, id: string) => logros.limpiar(id));
  ipcMain.handle(CANALES.guardar, (_e, nombre: string, contenido: string) =>
    guardar(nombre, contenido),
  );
  ipcMain.on(CANALES.guardarYa, (evento, nombre: string, contenido: string) => {
    evento.returnValue = guardar(nombre, contenido);
  });
  ipcMain.handle(CANALES.cargar, (_e, nombre: string) => cargar(nombre));
  ipcMain.handle(CANALES.archivosEnNube, () => nube.listar());
}
