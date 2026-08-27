/**
 * Capa de Steam. Todo pasa por acá y todo degrada con gracia: el juego tiene
 * que arrancar y ser jugable sin Steam corriendo, sin App ID y sin SDK.
 * En desarrollo eso es lo normal; en producción es lo que hace que un Steam
 * caído no convierta el juego en un ladrillo.
 */
import * as steamworks from "steamworks.js";
import type { Client } from "steamworks.js";

/** App ID público de Spacewar: el que usa todo el mundo para probar sin App ID propio. */
export const APP_ID_DESARROLLO = 480;

export interface EstadoSteam {
  readonly disponible: boolean;
  readonly motivo?: string;
  readonly appId?: number;
  readonly usuario?: string;
  readonly steamId?: string;
  readonly enSteamDeck?: boolean;
  readonly cloudHabilitadoEnCuenta?: boolean;
  readonly cloudHabilitadoEnApp?: boolean;
  readonly idioma?: string;
  readonly overlayPreparado?: boolean;
}

type ClienteSteam = Omit<Client, "init" | "runCallbacks">;

let cliente: ClienteSteam | null = null;
let estado: EstadoSteam = { disponible: false, motivo: "todavía no se inicializó" };
let overlayPreparado = false;

export function steamDeshabilitado(): boolean {
  return process.env["FALTA_UNO_SIN_STEAM"] === "1";
}

export function appIdConfigurado(): number {
  const crudo = Number(process.env["STEAM_APP_ID"]);
  return Number.isFinite(crudo) && crudo > 0 ? crudo : APP_ID_DESARROLLO;
}

/**
 * El overlay de Steam no engancha solo sobre Chromium: la librería lo habilita
 * agregando switches de línea de comandos (`in-process-gpu`,
 * `disable-direct-composition`) y repintando cada frame. Los switches solo
 * valen si se setean ANTES de que Electron esté listo, así que esto va lo más
 * arriba posible del proceso principal. Sin esto no andan ni las capturas con
 * F12 ni el overlay in-game, que es requisito para la verificación en Deck.
 */
export function prepararOverlay(): boolean {
  if (steamDeshabilitado()) return false;
  try {
    steamworks.electronEnableSteamOverlay();
    overlayPreparado = true;
  } catch {
    overlayPreparado = false;
  }
  return overlayPreparado;
}

/**
 * Si el juego se abrió por fuera de Steam teniéndolo instalado, Steam lo
 * relanza por su cuenta y este proceso se tiene que morir.
 *
 * Tres guardas, y las tres hacen falta:
 *   · solo en producción, porque en desarrollo relanzaría el build empaquetado
 *     en vez del que estás tocando;
 *   · nunca con el App ID de pruebas, porque `steam://run/480` abre Spacewar,
 *     no este juego: sin esta guarda, cualquier build de prueba en una máquina
 *     con Steam instalado se cierra sola y lanza otro juego;
 *   · nunca con Steam deshabilitado a mano.
 */
export function relanzarPorSteamSiHaceFalta(esProduccion: boolean): boolean {
  if (!esProduccion || steamDeshabilitado()) return false;
  const appId = appIdConfigurado();
  if (appId === APP_ID_DESARROLLO) return false;
  try {
    return steamworks.restartAppIfNecessary(appId);
  } catch {
    return false;
  }
}

export function iniciarSteam(): EstadoSteam {
  if (steamDeshabilitado()) {
    estado = { disponible: false, motivo: "deshabilitado por FALTA_UNO_SIN_STEAM=1" };
    return estado;
  }

  const appId = appIdConfigurado();
  try {
    // init() arranca por su cuenta el bombeo de callbacks de Steam.
    cliente = steamworks.init(appId);
    estado = {
      disponible: true,
      overlayPreparado,
      appId: cliente.utils.getAppId(),
      usuario: cliente.localplayer.getName(),
      steamId: cliente.localplayer.getSteamId().steamId64.toString(),
      enSteamDeck: cliente.utils.isSteamRunningOnSteamDeck(),
      cloudHabilitadoEnCuenta: cliente.cloud.isEnabledForAccount(),
      cloudHabilitadoEnApp: cliente.cloud.isEnabledForApp(),
      idioma: cliente.apps.currentGameLanguage(),
    };
  } catch (error) {
    cliente = null;
    estado = {
      disponible: false,
      appId,
      overlayPreparado,
      motivo: error instanceof Error ? error.message : String(error),
    };
  }
  return estado;
}

export function estadoSteam(): EstadoSteam {
  return estado;
}

export function cerrarSteam(): void {
  cliente = null;
}

function seguro<T>(accion: (c: ClienteSteam) => T, sinSteam: T): T {
  if (!cliente) return sinSteam;
  try {
    return accion(cliente);
  } catch {
    return sinSteam;
  }
}

export const logros = {
  activar: (id: string): boolean => seguro((c) => c.achievement.activate(id), false),
  activado: (id: string): boolean => seguro((c) => c.achievement.isActivated(id), false),
  limpiar: (id: string): boolean => seguro((c) => c.achievement.clear(id), false),
};

export const nube = {
  disponible: (): boolean => cliente !== null && estado.cloudHabilitadoEnApp === true,
  escribir: (nombre: string, contenido: string): boolean =>
    seguro((c) => c.cloud.writeFile(nombre, contenido), false),
  leer: (nombre: string): string | null =>
    seguro((c) => (c.cloud.fileExists(nombre) ? c.cloud.readFile(nombre) : null), null),
  listar: (): { nombre: string; bytes: number }[] =>
    seguro(
      (c) => c.cloud.listFiles().map((f) => ({ nombre: f.name, bytes: Number(f.size) })),
      [] as { nombre: string; bytes: number }[],
    ),
};
