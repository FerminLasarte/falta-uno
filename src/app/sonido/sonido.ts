/**
 * El parlante del celular. Toca lo que sintetiza `sintesis.ts` y lo degrada con
 * el deterioro, como todo lo demás: el tono se desafina y se opaca a medida que
 * se te cae la moral. Nunca hasta dejar de oírse, por la misma regla que la
 * degradación nunca toca la legibilidad.
 *
 * No pregunta por la moral: App le pasa el deterioro ya calculado, igual que a
 * los tokens de CSS.
 */
import { FRECUENCIA_MUESTREO, murmullo, tono, zumbido } from "./sintesis.js";

const VOLUMEN = 0.6;
/** El tono sale apenas después de que arranca el motor, como en un teléfono. */
const RETRASO_TONO_S = 0.02;

/** Con el deterioro al máximo: cuánto se va de afinación (en cents) y cuánto tiembla esa desafinación. */
const DESAFINACION = -60;
const VAIVEN = 25;
/** El brillo del tono: el corte del filtro va de acá… */
const BRILLO_INTACTO = 7500;
/** …hasta acá, que sigue siendo claramente audible. */
const BRILLO_MINIMO = 2100;

class Sonido {
  /** De 0 a 1. Lo escribe App, y solo App. */
  deterioro = 0;
  #contexto: AudioContext | null = null;
  #salida: GainNode | null = null;
  #memoria = new Map<string, AudioBuffer>();

  /** Suena un aviso: el motor de vibración con su patrón, y encima el tono. */
  avisar(reclamo: boolean, tramos: readonly number[]): void {
    const contexto = this.#abrir();
    if (!contexto || !this.#salida) return;
    const ahora = contexto.currentTime;

    const motor = contexto.createBufferSource();
    motor.buffer = this.#buffer(`motor:${tramos.join(",")}`, () => zumbido(tramos));
    motor.connect(this.#salida);
    motor.start(ahora);

    const campana = contexto.createBufferSource();
    campana.buffer = this.#buffer(reclamo ? "tono:reclamo" : "tono:mensaje", () => tono(reclamo));
    campana.detune.value = this.deterioro * (DESAFINACION + (Math.random() * 2 - 1) * VAIVEN);
    this.#opacar(campana);
    campana.start(ahora + RETRASO_TONO_S);
  }

  /**
   * Un audio del grupo, escuchado a toda velocidad: el murmullo de esa voz. Se
   * degrada igual que el tono. Devuelve cómo cortarlo si te vas antes de que termine.
   */
  murmurar(semilla: string, segundos: number, tonoHz: number): () => void {
    const contexto = this.#abrir();
    if (!contexto || !this.#salida) return () => {};
    const voz = contexto.createBufferSource();
    voz.buffer = this.#buffer(`murmullo:${semilla}:${segundos}:${tonoHz}`, () => murmullo(semilla, segundos, tonoHz));
    voz.detune.value = this.deterioro * DESAFINACION;
    this.#opacar(voz);
    voz.start();
    return () => voz.stop();
  }

  /** El contexto se abre con el primer sonido y se reusa. Sin audio en la máquina, el juego sigue mudo. */
  #abrir(): AudioContext | null {
    if (this.#contexto) {
      if (this.#contexto.state === "suspended") void this.#contexto.resume();
      return this.#contexto;
    }
    try {
      this.#contexto = new AudioContext({ sampleRate: FRECUENCIA_MUESTREO });
      this.#salida = this.#contexto.createGain();
      this.#salida.gain.value = VOLUMEN;
      this.#salida.connect(this.#contexto.destination);
      return this.#contexto;
    } catch {
      return null;
    }
  }

  /** Conecta a la salida a través del filtro que le saca brillo con el deterioro. */
  #opacar(fuente: AudioNode): void {
    if (!this.#contexto || !this.#salida) return;
    const filtro = this.#contexto.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = BRILLO_INTACTO - (BRILLO_INTACTO - BRILLO_MINIMO) * this.deterioro;
    fuente.connect(filtro).connect(this.#salida);
  }

  #buffer(clave: string, generar: () => Float32Array): AudioBuffer {
    const guardado = this.#memoria.get(clave);
    if (guardado) return guardado;
    const muestras = generar();
    const buffer = new AudioBuffer({ length: muestras.length, sampleRate: FRECUENCIA_MUESTREO });
    buffer.getChannelData(0).set(muestras);
    this.#memoria.set(clave, buffer);
    return buffer;
  }
}

export const sonido = new Sonido();
