/**
 * El commit con el que se construye el juego, para saber con qué versión jugó
 * cada tester. Con "+" al final si había cambios sin commitear. Sin git, "?".
 */
import { execSync } from "node:child_process";

export function commitActual() {
  try {
    const hash = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const sucio = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() !== "";
    return sucio ? `${hash}+` : hash;
  } catch {
    return "?";
  }
}

/** Lo que esbuild reemplaza en el proceso principal. */
export function definiciones() {
  return { __COMMIT__: JSON.stringify(commitActual()) };
}
