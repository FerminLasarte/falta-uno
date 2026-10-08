/**
 * Los sonidos del teléfono, sintetizados. No hay archivos de audio: cada sonido
 * es una función que devuelve sus muestras, así que la licencia es nuestra, se
 * regeneran igual siempre y se pueden testear sin navegador.
 *
 * El tono es de madera, tipo marimba: dos notas que suben para un mensaje y
 * cuatro que van y vienen para algo que te reclama. Sale por un parlantito de
 * celular y rebota un poco en el living. La vibración es el motor amortiguado
 * por la mano: grave y sin brillo.
 */

export const FRECUENCIA_MUESTREO = 44100;

interface Parcial {
  /** Múltiplo de la fundamental. Los de la marimba no son armónicos enteros. */
  readonly razon: number;
  readonly amplitud: number;
  /** Constante de caída, en segundos. */
  readonly caida: number;
}

const MADERA: readonly Parcial[] = [
  { razon: 1, amplitud: 1, caida: 0.16 },
  { razon: 3.93, amplitud: 0.32, caida: 0.035 },
  { razon: 9, amplitud: 0.08, caida: 0.012 },
];

const SOL5 = 784;
const DO6 = 1046.5;
const MENSAJE = { notas: [SOL5, DO6], paso: 0.11 } as const;
const RECLAMO = { notas: [DO6, SOL5, DO6, SOL5], paso: 0.12 } as const;
const DURACION_NOTA = 0.6;

/** Picos de cada sonido. El tono manda; el motor acompaña por debajo. */
const PICO_TONO = 0.56;
const PICO_MOTOR = 0.4;

/** El parlante del celular: sin graves y con los agudos limados. */
const CORTE_GRAVES = 550;
const CORTE_AGUDOS = 7500;

/** Reflexiones cortas, en ms y ganancia: el sonido sale en un living, no en un estudio. */
const REFLEXIONES: readonly (readonly [number, number])[] = [
  [17, 0.22],
  [29, 0.16],
  [43, 0.11],
  [61, 0.07],
  [89, 0.04],
];
const COLA_LIVING = 0.25;

/** El motor: una fundamental grave con algo de segundo y tercer armónico. */
const MOTOR_HZ = 168;
const MOTOR_CORTE = 900;

export function tono(reclamo: boolean, fm = FRECUENCIA_MUESTREO): Float32Array {
  const { notas, paso } = reclamo ? RECLAMO : MENSAJE;
  const salida = new Float32Array(Math.ceil(fm * ((notas.length - 1) * paso + DURACION_NOTA)));
  notas.forEach((f, i) => sumar(salida, nota(f, fm), Math.round(i * paso * fm)));
  return normalizar(living(parlante(salida, fm), fm), PICO_TONO);
}

export function zumbido(tramos: readonly number[], fm = FRECUENCIA_MUESTREO): Float32Array {
  const total = tramos.reduce((t, ms) => t + ms, 0);
  const salida = new Float32Array(Math.round((fm * total) / 1000));
  // Ruido con semilla fija: la aspereza del motor, igual cada vez.
  const ruido = generador("motor");
  let fase = 0;
  let i = 0;
  tramos.forEach((ms, k) => {
    const n = Math.round((fm * ms) / 1000);
    const prendido = k % 2 === 0;
    for (let j = 0; j < n; j++, i++) {
      if (!prendido) continue;
      const t = j / fm;
      const d = ms / 1000;
      // Arranca y frena con una rampa: el motor no salta de cero a todo.
      const envolvente = Math.min(1, t / 0.03, (d - t) / 0.04);
      fase += (2 * Math.PI * MOTOR_HZ * (1 + 0.015 * Math.sin(2 * Math.PI * 9 * t))) / fm;
      const v = Math.sin(fase) + 0.45 * Math.sin(2 * fase) + 0.2 * Math.sin(3 * fase);
      salida[i] = envolvente * v * (0.85 + 0.15 * ruido());
    }
  });
  return normalizar(pasaBajos(salida, MOTOR_CORTE, fm), PICO_MOTOR);
}

/**
 * Las vocales del murmullo, como pares de formantes (Hz). Con eso alcanza para
 * que suene a alguien hablando sin que se entienda una palabra.
 */
const VOCALES: readonly (readonly [number, number])[] = [
  [800, 1200], // a
  [500, 1900], // e
  [320, 2300], // i
  [500, 900], //  o
  [330, 800], //  u
];
const SILABAS_POR_SEGUNDO = 7;
const CONTRASTE_ONDA = 2.6;
const PICO_MURMULLO = 0.5;

/**
 * Un audio del grupo escuchado a toda velocidad: una voz que no se entiende, con
 * la entonación de alguien que habla. La misma semilla da siempre el mismo
 * murmullo; `tonoHz` es la voz de cada uno, más grave o más aguda.
 */
export function murmullo(semilla: string, segundos: number, tonoHz: number, fm = FRECUENCIA_MUESTREO): Float32Array {
  const azar = generador(semilla);
  const salida = new Float32Array(Math.round(segundos * fm));

  // El guion de sílabas: cuándo arranca cada una, cuánto dura y qué vocal es.
  const silabas: { desde: number; dura: number; vocal: readonly [number, number]; altura: number; consonante: boolean }[] = [];
  for (let t = 0.04, enFrase = 0; t < segundos - 0.2; ) {
    const dura = (0.6 + 0.5 * azar()) / SILABAS_POR_SEGUNDO;
    silabas.push({
      desde: t,
      dura,
      vocal: VOCALES[Math.floor(azar() * VOCALES.length)]!,
      altura: 1 + (azar() - 0.5) * 0.14,
      consonante: azar() < 0.55,
    });
    t += dura + (azar() < 0.25 ? 0.03 : 0);
    // Cada tanto, una pausa para respirar: es lo que hace que suene a frases.
    if (++enFrase > 7 + azar() * 6) {
      t += 0.16 + azar() * 0.12;
      enFrase = 0;
    }
  }

  let fase = 0;
  const f1 = resonador();
  const f2 = resonador();
  for (const s of silabas) {
    const i0 = Math.round(s.desde * fm);
    const n = Math.round(s.dura * fm);
    for (let j = 0; j < n && i0 + j < salida.length; j++) {
      const t = j / fm;
      const global = (i0 + j) / fm;
      // La entonación sube y baja despacio; cada sílaba se corre un poco.
      const f0 = tonoHz * s.altura * (1 + 0.07 * Math.sin(2 * Math.PI * 0.6 * global));
      fase = (fase + f0 / fm) % 1;
      const glotal = 2 * fase - 1;
      const envolvente = Math.min(1, t / 0.012, (s.dura - t) / 0.03);
      // Una consonante es un soplido corto al principio de la sílaba.
      const soplido = s.consonante && t < 0.018 ? (azar() * 2 - 1) * 0.6 : 0;
      if (j % 32 === 0) {
        f1.afinar(s.vocal[0], 6, fm);
        f2.afinar(s.vocal[1], 8, fm);
      }
      const fuente = glotal * 0.5 + soplido;
      salida[i0 + j] = envolvente * (f1.paso(fuente) + 0.6 * f2.paso(fuente));
    }
  }
  return normalizar(living(parlante(salida, fm), fm).subarray(0, salida.length), PICO_MURMULLO);
}

/**
 * Lo que tarda en sonar un audio cuando lo escuchás. Nunca lo que dura de
 * verdad: el tiempo real no se gasta escuchando, se gasta el reloj del viernes.
 */
export function segundosDeEscucha(nominal: number): number {
  return Math.min(4.5, 1.2 + nominal * 0.05);
}

/** La forma de onda de un audio: cuánto suena el murmullo en cada tramo, de 0 a 1. */
export function formaDeOnda(semilla: string, nominal: number, tonoHz: number, barras: number): number[] {
  const x = murmullo(semilla, segundosDeEscucha(nominal), tonoHz);
  const tramo = Math.floor(x.length / barras);
  const niveles: number[] = [];
  for (let b = 0; b < barras; b++) {
    let suma = 0;
    for (let i = b * tramo; i < (b + 1) * tramo; i++) suma += x[i]! * x[i]!;
    niveles.push(Math.sqrt(suma / tramo));
  }
  const maximo = Math.max(...niveles) || 1;
  // Una voz tiene energía bastante pareja: con contraste, las barras dibujan las sílabas.
  return niveles.map((n) => (n / maximo) ** CONTRASTE_ONDA);
}

/** Un filtro pasabanda de segundo orden que se puede reafinar en marcha. */
function resonador(): { afinar(f: number, q: number, fm: number): void; paso(x: number): number } {
  let b0 = 0, b2 = 0, a1 = 0, a2 = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return {
    afinar(f, q, fm) {
      const w = (2 * Math.PI * f) / fm;
      const alfa = Math.sin(w) / (2 * q);
      const a0 = 1 + alfa;
      b0 = alfa / a0;
      b2 = -alfa / a0;
      a1 = (-2 * Math.cos(w)) / a0;
      a2 = (1 - alfa) / a0;
    },
    paso(x) {
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x;
      y2 = y1; y1 = y;
      return y;
    },
  };
}

/** Azar con semilla, de 0 a 1: el mismo texto da siempre la misma secuencia. */
function generador(semilla: string): () => number {
  let s = 0;
  for (let i = 0; i < semilla.length; i++) s = (s * 31 + semilla.charCodeAt(i)) % 2147483647;
  s = s || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function nota(f: number, fm: number): Float32Array {
  const salida = new Float32Array(Math.round(DURACION_NOTA * fm));
  for (let i = 0; i < salida.length; i++) {
    const t = i / fm;
    // Golpe de mazo: el ataque es casi instantáneo.
    const ataque = Math.min(1, t / 0.001);
    let v = 0;
    for (const p of MADERA) v += p.amplitud * Math.exp(-t / p.caida) * Math.sin(2 * Math.PI * f * p.razon * t);
    salida[i] = ataque * v;
  }
  return salida;
}

function sumar(destino: Float32Array, fuente: Float32Array, desde: number): void {
  for (let i = 0; i < fuente.length && desde + i < destino.length; i++) {
    destino[desde + i]! += fuente[i]!;
  }
}

function parlante(x: Float32Array, fm: number): Float32Array {
  return pasaBajos(pasaAltos(x, CORTE_GRAVES, fm), CORTE_AGUDOS, fm);
}

function pasaAltos(x: Float32Array, corte: number, fm: number): Float32Array {
  const rc = 1 / (2 * Math.PI * corte);
  const a = rc / (rc + 1 / fm);
  const y = new Float32Array(x.length);
  let previoX = 0;
  let previoY = 0;
  for (let i = 0; i < x.length; i++) {
    previoY = a * (previoY + x[i]! - previoX);
    previoX = x[i]!;
    y[i] = previoY;
  }
  return y;
}

function pasaBajos(x: Float32Array, corte: number, fm: number): Float32Array {
  const b = Math.exp((-2 * Math.PI * corte) / fm);
  const y = new Float32Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    s = (1 - b) * x[i]! + b * s;
    y[i] = s;
  }
  return y;
}

function living(x: Float32Array, fm: number): Float32Array {
  const y = new Float32Array(x.length + Math.round(COLA_LIVING * fm));
  y.set(x);
  for (const [ms, ganancia] of REFLEXIONES) {
    const d = Math.round((fm * ms) / 1000);
    for (let i = 0; i < x.length; i++) y[i + d]! += ganancia * x[i]!;
  }
  return y;
}

function normalizar(x: Float32Array, pico: number): Float32Array {
  let maximo = 0;
  for (const v of x) maximo = Math.max(maximo, Math.abs(v));
  if (maximo === 0) return x;
  return x.map((v) => (v * pico) / maximo);
}
