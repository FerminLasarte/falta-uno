/**
 * Los ajustes del juego: volumen, pantalla completa y movimiento. Son de esta máquina, no
 * de la partida: no van al guardado, que viaja por la nube de Steam, porque la pantalla
 * completa de la Deck no es la de la compu. Viven en el almacenamiento de la ventana.
 *
 * Nadie más toca el sonido ni la ventana por ellos: App los aplica, como el deterioro.
 */

const CLAVE = "falta-uno:ajustes";

/** El volumen va de 0 a 100, de a este paso: los bloques de la barra de la tele. */
export const PASO_VOLUMEN = 5;

interface Guardados {
  readonly volumen: number;
  readonly pantallaCompleta: boolean;
  readonly movimientoReducido: boolean;
}

function leer(): Partial<Guardados> {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as Partial<Guardados>) : {};
  } catch {
    return {};
  }
}

const limitar = (v: number): number => Math.min(100, Math.max(0, Math.round(v / PASO_VOLUMEN) * PASO_VOLUMEN));

class Ajustes {
  /** De 0 a 100. */
  volumen = $state(60);
  pantallaCompleta = $state(false);
  /** Lo que eligió el jugador: la escena no respira, no tiembla ni vibra. */
  movimientoReducido = $state(false);
  /** Lo que pide el sistema operativo, que vale igual aunque el jugador no lo haya elegido acá. */
  #delSistema = $state(false);

  constructor() {
    const guardados = leer();
    if (typeof guardados.volumen === "number") this.volumen = limitar(guardados.volumen);
    if (typeof guardados.pantallaCompleta === "boolean") this.pantallaCompleta = guardados.pantallaCompleta;
    if (typeof guardados.movimientoReducido === "boolean") this.movimientoReducido = guardados.movimientoReducido;
    const consulta = matchMedia("(prefers-reduced-motion: reduce)");
    this.#delSistema = consulta.matches;
    consulta.addEventListener("change", (e) => (this.#delSistema = e.matches));
  }

  /** La escena va quieta si lo pide el jugador o el sistema. */
  get sinMovimiento(): boolean {
    return this.movimientoReducido || this.#delSistema;
  }

  subirVolumen(pasos: number): void {
    this.volumen = limitar(this.volumen + pasos * PASO_VOLUMEN);
  }

  ponerVolumen(valor: number): void {
    this.volumen = limitar(valor);
  }

  guardar(): void {
    const datos: Guardados = {
      volumen: this.volumen,
      pantallaCompleta: this.pantallaCompleta,
      movimientoReducido: this.movimientoReducido,
    };
    try {
      localStorage.setItem(CLAVE, JSON.stringify(datos));
    } catch {
      // Sin almacenamiento, los ajustes duran lo que dura la ventana.
    }
  }
}

export const ajustes = new Ajustes();
