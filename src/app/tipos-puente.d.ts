import type { ApiPuente } from "../../electron/canal.js";

declare global {
  interface Window {
    readonly faltaUno: ApiPuente;
  }
}

export {};
