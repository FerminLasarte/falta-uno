/**
 * Los textos del relato del partido, por clave, con varios fraseos cada uno.
 * El relato elige uno al azar y no lo repite en el mismo partido mientras le
 * queden otros: la misma fecha se juega con otra semilla y no puede leerse igual.
 *
 * Marcas: {x} es un nombre, {par} es "Fulano y Mengano", {puesto} es donde
 * juega alguien, {favor} y {contra} son los goles del final.
 */
import type { Rng } from "./rng.js";

/** Cada clave y las marcas que puede usar. */
export const MARCAS_DEL_RELATO = {
  gol_favor: ["x"],
  gol_contra: [],
  gano: ["favor", "contra"],
  perdio: ["favor", "contra"],
  apuro: ["x"],
  plata: ["x"],
  plata_comprado: [],
  grupo_caliente: [],
  roce: ["par"],
  roce_calmado: ["par"],
  baja: ["x"],
  no_vino: ["x"],
  trajo: ["x"],
  favor: ["x"],
  confirmacion_limpia: ["x"],
  ignorado: ["x"],
  cancha_ignorada: [],
  pareja_ignorada: [],
  trabajo_ignorado: [],
  sin_arquero: ["x"],
  fuera_de_puesto: ["x", "puesto"],
  picado: [],
  crack: ["x"],
} as const satisfies Record<string, readonly string[]>;

export type ClaveRelato = keyof typeof MARCAS_DEL_RELATO;
export const CLAVES_DEL_RELATO = Object.keys(MARCAS_DEL_RELATO) as ClaveRelato[];
export type Relato = Readonly<Record<ClaveRelato, readonly string[]>>;

/** Para tests y partidas sin contenido: un fraseo por clave. */
export const RELATO_POR_DEFECTO: Relato = {
  gol_favor: ["{x} la empuja abajo del arco.", "{x} le pega de lejos y entra.", "{x} define cruzado."],
  gol_contra: ["Gol de ellos.", "Se la meten por arriba.", "Contra, y gol de ellos."],
  gano: ["Termina {favor} a {contra}. Ganaron. Alguien propone ir a comer algo."],
  perdio: ["Termina {favor} a {contra}. Perdieron. Nadie habla en el vestuario."],
  apuro: ["{x} vino de mala gana y erra un gol hecho."],
  plata: ["{x} corre como si le fuera la vida."],
  plata_comprado: ["El que conseguiste pagando corre como si le fuera la vida."],
  grupo_caliente: ["Llegan todos calientes de lo que se dijo en el grupo, y en la cancha se nota."],
  roce: ["{par} se gritan todo el partido."],
  roce_calmado: ["{par} se cruzan en una dividida y se dan la mano."],
  baja: ["Se nota el hueco de {x}. Juegan corriendo de atrás."],
  no_vino: ["Falta {x}. Juegan con uno menos de los que esperabas."],
  trajo: ["{x} juega como si los conociera de toda la vida."],
  favor: ["{x} deja todo adentro de la cancha."],
  confirmacion_limpia: ["{x} la descose por la banda."],
  ignorado: ["{x} te lo recuerda toda la noche."],
  cancha_ignorada: ["Llegás y en la entrada te miran torcido. Arrancan con la cancha a medio preparar."],
  pareja_ignorada: ["No podés dejar de mirar el teléfono. Te comés un caño mirando la pantalla."],
  trabajo_ignorado: ["Suena el teléfono del laburo en pleno partido y salís a atender."],
  sin_arquero: ["Nadie quiere ir al arco. Se pone {x}, que no ataja ni un centro."],
  fuera_de_puesto: ["{x} juega de {puesto} y no sabe dónde pararse."],
  picado: ["El partido se pica en serio. Nadie afloja, y eso también es jugar."],
  crack: ["{x} agarra la pelota en la mitad y se lleva a tres."],
};

/** Elige los fraseos de un partido: al azar, sin repetir uno hasta usar todos los de su clave. */
export class Narrador {
  private readonly usados = new Map<ClaveRelato, Set<number>>();

  constructor(
    private readonly relato: Relato,
    private readonly rng: Rng,
  ) {}

  decir(clave: ClaveRelato, marcas: Readonly<Record<string, string | number>> = {}): string {
    const fraseos = this.relato[clave];
    let usados = this.usados.get(clave);
    if (!usados || usados.size >= fraseos.length) {
      usados = new Set();
      this.usados.set(clave, usados);
    }
    const libres = fraseos.map((_, i) => i).filter((i) => !usados.has(i));
    const elegido = this.rng.elegir(libres);
    usados.add(elegido);
    return fraseos[elegido]!.replace(/\{(\w+)\}/g, (_, marca: string) => String(marcas[marca] ?? `{${marca}}`));
  }
}
