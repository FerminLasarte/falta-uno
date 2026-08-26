import { createInterface, type Interface } from "node:readline";
import { stdin, stdout } from "node:process";

/**
 * Lector de líneas que tolera stdin no interactivo. `readline/promises` se cierra
 * al llegar el EOF de una tubería antes de que lleguemos a preguntar, así que
 * las líneas se bufferean y `preguntar` devuelve null cuando ya no hay más.
 * De paso, el CLI queda scriptable: se le puede pasar una partida por pipe.
 */
export interface Lector {
  preguntar(prompt: string): Promise<string | null>;
  cerrar(): void;
}

export function crearLector(): Lector {
  const rl: Interface = createInterface({ input: stdin, terminal: stdin.isTTY === true });
  const pendientes: string[] = [];
  const esperando: ((linea: string | null) => void)[] = [];
  let cerrado = false;

  rl.on("line", (linea) => {
    const siguiente = esperando.shift();
    if (siguiente) siguiente(linea);
    else pendientes.push(linea);
  });

  rl.on("close", () => {
    cerrado = true;
    while (esperando.length > 0) esperando.shift()!(null);
  });

  return {
    async preguntar(prompt: string): Promise<string | null> {
      stdout.write(prompt);
      const buffereada = pendientes.shift();
      if (buffereada !== undefined) {
        if (!stdin.isTTY) stdout.write(`${buffereada}\n`);
        return buffereada;
      }
      if (cerrado) {
        stdout.write("\n");
        return null;
      }
      return new Promise((resolve) => esperando.push(resolve));
    },
    cerrar(): void {
      rl.close();
    },
  };
}
