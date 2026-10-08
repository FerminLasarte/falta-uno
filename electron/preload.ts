/**
 * Puente entre la ventana y el proceso principal. La ventana no ve Node ni
 * Steam: solo estas funciones. Es la superficie completa, a propósito.
 */
import { contextBridge, ipcRenderer } from "electron";
import { CANALES } from "./canal.js";

const api = {
  contenido: () => ipcRenderer.invoke(CANALES.contenido),
  versiones: () => ipcRenderer.invoke(CANALES.versiones),
  estadoSteam: () => ipcRenderer.invoke(CANALES.estadoSteam),
  activarLogro: (id: string) => ipcRenderer.invoke(CANALES.activarLogro, id),
  logroActivado: (id: string) => ipcRenderer.invoke(CANALES.logroActivado, id),
  limpiarLogro: (id: string) => ipcRenderer.invoke(CANALES.limpiarLogro, id),
  guardar: (nombre: string, contenido: string) =>
    ipcRenderer.invoke(CANALES.guardar, nombre, contenido),
  guardarYa: (nombre: string, contenido: string) =>
    ipcRenderer.sendSync(CANALES.guardarYa, nombre, contenido),
  cargar: (nombre: string) => ipcRenderer.invoke(CANALES.cargar, nombre),
  archivosEnNube: () => ipcRenderer.invoke(CANALES.archivosEnNube),
};

contextBridge.exposeInMainWorld("faltaUno", api);
