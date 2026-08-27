import { mount } from "svelte";
import App from "./App.svelte";
import "./estilos/base.css";

const destino = document.getElementById("app");
if (!destino) throw new Error("Falta el nodo #app en index.html");

export default mount(App, { target: destino });
