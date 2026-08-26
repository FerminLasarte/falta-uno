# Falta Uno

> Sos el que arma el partido. Son las 19:00, tenés cuatro confirmados, ocho mensajes sin leer
> y dos horas para que esto no se caiga.

Juego de gestión de recursos disfrazado de app de mensajería, para PC (Steam). Manejás la agenda
de contactos de un equipo de fútbol amateur contra reloj: conseguir 10 jugadores con roles
funcionales para las 21:00, pagar la seña de la cancha y sobrevivir a las excusas, las
cancelaciones de último minuto y las crisis personales.

**Género:** gestión de recursos / thriller psicológico de interfaz / texto interactivo
**Plataforma:** Windows, macOS y Linux vía Steam. Steam Deck como objetivo de primera clase.

---

## Estado

🟡 **Pre-producción.** No hay código todavía. El diseño está cerrado en la v2 del GDD y la Fase 1
(núcleo de simulación) es lo próximo.

## Documentación

- **[GDD.md](GDD.md)** — documento de diseño completo, v2.0. Fuente de la verdad para mecánicas,
  arquitectura y hoja de ruta.

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Empaquetado | **Electron** | Chromium bundleado: mismo render y mismo audio en las tres plataformas. Tauri usa el webview del sistema y WebKitGTK es el punto flojo justo en Linux/Deck. |
| Lenguaje | **TypeScript** | El contenido son cientos de nodos de diálogo enlazados. Un link roto tiene que romper el build, no la partida. |
| UI | **Svelte** | El estado cambia constantemente; un MVC a mano con listeners no escala a la Fase 6. |
| Contenido | Datos validados por schema | Un archivo por contacto, validado en build. |
| Steam | `steamworks.js` | Logros, cloud saves, rich presence. |

## Arquitectura

```
Vista (Svelte)          El teléfono, los chats, el HUD. Sin lógica de negocio.
      ▲ ▼
Store reactivo          Puente. Traduce intención en comando.
      ▲ ▼
Núcleo (TS puro)        Partida · Contacto · Reloj · Resolución.
                        CERO DOM. Testeable headless. RNG con semilla.
      ▲ ▼
Contenido               Un archivo por contacto, validado por schema.
```

**Regla dura:** el núcleo de simulación no contiene una sola referencia al DOM. Es lo que habilita
los tests headless y el bot de balanceo, y no se negocia.

## Hoja de ruta

| Fase | Qué |
|---|---|
| 1 | Motor y datos — núcleo lógico por consola, con tests. Sin interfaz. |
| 2 | Empaquetado y Steam — "hola mundo" en Electron corriendo desde Steam, en las tres plataformas. |
| 3 | Maquetación UI y audio — el teléfono, el HUD de roster, navegación por foco. |
| 4 | Integración — chatear de verdad, ver bajar Moral y Reloj. |
| 5 | El simulador — la pantalla de las 21:00 y la narración atribuida. |
| 6 | Contenido — escribir el guion. La fase más larga. |
| 7 | Pulido y lanzamiento. |

Las fases 2 y 3 subieron desde el final a propósito: descubrir en la semana 30 que el overlay de
Steam no anda sobre Electron, o que el juego no se siente estresante sin sonido, es el peor momento
posible para descubrirlo.

## Decisiones de diseño que conviene conocer antes de tocar el código

- **El reloj avanza por acción, no en tiempo real.** Un cronómetro real castigaría al jugador por
  leer, que es justo lo que el juego le pide hacer. La ansiedad la generan las notificaciones.
- **Perder un partido no termina la campaña.** Las únicas derrotas reales son de recursos: Moral en
  0, bancarrota, disolución del equipo.
- **Los NPCs no usan LLM en tiempo de ejecución.** Costo recurrente sobre venta única, dependencia de
  internet, latencia que rompe el ritmo y pérdida de determinismo sobre los modificadores ocultos.
  La IA se usa en el pipeline de producción, no en el juego. Ver GDD §6.
- **La narración del partido atribuye cada evento a una decisión del jugador.** Misma matemática,
  desenlace que no se siente arbitrario.

## Desarrollo

Todavía no hay setup. Se documenta acá cuando arranque la Fase 1.

## Licencia

Todos los derechos reservados. Código y contenido propietarios.
