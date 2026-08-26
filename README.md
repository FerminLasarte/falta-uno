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

🟢 **Fase 1 completa.** El núcleo de simulación funciona, tiene 78 tests y se puede jugar un viernes
entero por consola. No hay interfaz gráfica todavía: eso es la Fase 3.

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

```bash
npm install
```

| Comando | Qué hace |
|---|---|
| `npm run jugar` | Juga un viernes completo por consola. Acepta stdin por pipe. |
| `npm run validar` | Valida todo el contenido y reporta el volumen escrito. |
| `npm run bot -- 500` | Corre 500 viernes headless por perfil y reporta balance. |
| `npm run bot -- 1 --narrar` | Imprime un partido completo con su desglose y narración. |
| `npm test` | Corre la suite. |
| `npm run typecheck` | `tsc --noEmit` en modo estricto. |

`SEMILLA=loquesea npm run jugar` fija la semilla del RNG: la misma semilla y las mismas acciones
producen exactamente la misma partida.

### Estructura

```
src/core/        Núcleo de simulación. TypeScript puro, cero DOM.
  rng.ts         RNG determinista y serializable.
  tiempo.ts      El reloj que avanza por acción.
  partida.ts     El agregado: estado, comandos, triggers.
  roster.ts      Composición del plantel, química y roces.
  resolucion.ts  El algoritmo del partido y la narración atribuida.
  bitacora.ts    Registro de por qué pasó cada cosa.
src/datos/       Schema, validador de grafo y carga de contenido.
src/cli/         Herramientas de consola: jugar, validar, bot.
contenido/       Los datos del juego. Un archivo por contacto.
tests/           78 tests sobre el núcleo y el contenido.
```

### El contrato del contenido

`npm run validar` falla si un árbol de diálogo tiene un link roto, un nodo inalcanzable, ids de
opción duplicados, un campo que no existe en el schema o un contacto al que es imposible decirle
que sí. Un error de contenido rompe la validación, nunca la partida.

### Balance

El bot juega miles de viernes contra el núcleo headless. Estado actual (300 viernes por perfil):

| Perfil | Llega a 10 | Gana | Moral al final |
|---|---|---|---|
| El Acomodado | 100% | 62% | 21 |
| El Pibe de Barrio | 100% | 66% | 29 |
| El Oficinista | 100% | 63% | 24 |

**Pendiente de la Fase 6:** un jugador competente arma el equipo el 100% de las veces. La presión de
moral y de reloj funciona (se termina con ~20 de moral y usando 112 de los 120 minutos), pero con 12
contactos para 10 lugares y todos convencibles, no hay forma real de fracasar. La dificultad tiene
que salir del contenido: menos margen, más contactos que dicen que no, más interrupciones.

## Licencia

Todos los derechos reservados. Código y contenido propietarios.
