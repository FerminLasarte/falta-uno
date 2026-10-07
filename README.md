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

🟡 **Fases 3 y 4 en curso.** Las fases 1 y 2 están completas: el núcleo simula un viernes entero y
el juego empaqueta y corre en Electron con Steam cableado. La escena en primera persona está
terminada y el viernes se juega de punta a punta adentro del teléfono: el grupo con la lista, los
chats privados con sus respuestas y costos, las interrupciones como chats y la bandeja.

Falta el sonido y las notificaciones que llegan solas, la vida propia del grupo, la pantalla de las
21:00 y la elección de perfil.

## Documentación

- **[GDD.md](GDD.md)** — documento de diseño completo, v3.0. Fuente de la verdad para mecánicas,
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
  La IA se usa en el pipeline de producción, no en el juego. Ver GDD §7.
- **La narración del partido atribuye cada evento a una decisión del jugador.** Misma matemática,
  desenlace que no se siente arbitrario.

## Desarrollo

```bash
npm install
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta el juego en Electron con recarga en caliente. |
| `npm run build` | Compila proceso principal, preload y ventana a `dist/`. |
| `npm run empaquetar` | Genera el build listo para subir a un depot de Steam. |
| `npm run humo` | Smoke test: levanta el juego, verifica que la ventana cargue, lo cierra. |
| `npm run jugar` | Juga un viernes completo por consola. Acepta stdin por pipe. |
| `npm run validar` | Valida todo el contenido y reporta el volumen escrito. |
| `npm run bot -- 500` | Corre 500 viernes headless por perfil y reporta balance. |
| `npm run bot -- 1 --narrar` | Imprime un partido completo con su desglose y narración. |
| `npm test` | Corre la suite. |
| `npm run typecheck` | `tsc --noEmit` estricto, para el lado Node y para la ventana. |

### Variables de entorno

| Variable | Para qué |
|---|---|
| `STEAM_APP_ID` | App ID de Steam. Sin ella se usa `480` (Spacewar, el público de pruebas). |
| `FALTA_UNO_SIN_STEAM=1` | Arranca sin tocar Steam. Útil para reproducir el caso sin cliente. |
| `FALTA_UNO_DIAGNOSTICO=1` | Imprime el diagnóstico de plataforma en JSON y sale, sin abrir ventana. |
| `FALTA_UNO_CAPTURA=x.png` | Captura la ventana a PNG y sale. |
| `FALTA_UNO_MORAL=15` | Fuerza un estado de moral. Para capturar la degradación sin jugar hasta ahí. |
| `SEMILLA` | Fija la semilla del RNG en el CLI de consola. |

`SEMILLA=loquesea npm run jugar` fija la semilla del RNG: la misma semilla y las mismas acciones
producen exactamente la misma partida.

### Estructura

```
electron/        Proceso principal, preload y capa de Steam.
  steam.ts       Logros, cloud y overlay. Degrada con gracia sin Steam.
  guardado.ts    Guardado local + Steam Cloud.
src/app/         La ventana. El único lugar del proyecto que ve el DOM.
  estilos/       Tokens y base. Todo el sistema de diseño vive acá.
  escena/        El living en primera persona: capas renderizadas y su movimiento.
    capas/       Lo que exporta arte/exportar_capas.py. No se edita a mano.
  telefono/      El vidrio de la pantalla y la barra de estado.
  mensajeria/    La app de adentro: el grupo con la lista, los chats privados y la bandeja.
  estado/        El puente al núcleo y la curva de deterioro.
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
arte/            La escena en Blender, el script que la exporta y los créditos de assets.
tests/           Tests sobre el núcleo y el contenido.
```

## Dirección de arte

**Mundo sucio y real por fuera, app impecable que se pudre por dentro.**

La escena es un living de noche visto en primera persona: estás tirado en el sillón con el celular
en las manos, la tele pasa un partido y la lámpara de pie es la única luz cálida. Adentro del
teléfono, la app de mensajería es lo único ordenado de la escena.

### La escena es un render en capas

El living, las manos y el celular salen de Blender ([arte/living.blend](arte/living.blend)), no de
CSS. [arte/exportar_capas.py](arte/exportar_capas.py) los exporta a
[src/app/escena/capas/](src/app/escena/capas/) en tres piezas:

| Capa | Qué es |
|---|---|
| `fondo.webp` | El living, desenfocado como lo ve un ojo enfocado en el celular. |
| `primer_plano.webp` | Manos, buzo y celular, nítidos, con la pantalla agujereada. |
| `escena.json` | Dónde cae la pantalla, la cámara frontal y la tele, en fracciones del cuadro. |

La app de mensajería es HTML de verdad y va entre las dos imágenes: el fondo atrás, la app en el
hueco, las manos adelante. Por eso los pulgares tapan la pantalla como la taparían en la mano.
La app se diseña a 390 px lógicos y se escala al hueco, así el diseño no depende de la ventana.

El movimiento es 2.5D: las manos respiran y se mecen, el fondo se mueve al revés y menos, la luz de
la tele cambia de plano. Con la moral baja, la mano tiembla. Todo se apaga con
`prefers-reduced-motion`.

Si cambia la escena, se vuelve a exportar desde la consola de Python de Blender con `living.blend`
abierto:

```python
exec(open(bpy.path.abspath("//exportar_capas.py")).read())
```

Las texturas de piel y ropa vienen de MPFB (MakeHuman) y los muebles de Poly Haven y Sketchfab.
Origen y licencia de cada uno en [arte/CREDITOS.md](arte/CREDITOS.md).

### La degradación es un solo valor

De la moral sale un único `deterioro` de 0 a 1
([deterioro.ts](src/app/estado/deterioro.ts)) que alimenta todos los tokens de CSS: el aire entre
elementos, la saturación, la interlínea, el grano y el tinte enfermizo
([tokens.css](src/app/estilos/tokens.css)). El living también lo lee: se apaga, se destiñe y la
mano empieza a temblar.

**Ningún componente pregunta por la moral.** Leen tokens, y los tokens ya vienen deteriorados. Eso
significa que la degradación se afina en un archivo, se puede animar, y un componente nuevo viene
degradado sin que nadie se acuerde de degradarlo.

La regla que la acota: **la degradación nunca toca la legibilidad del texto que el jugador necesita
leer.** Toca el aire, el color, el ruido y el cromo. Nunca desenfoca un mensaje. Si leer se vuelve
difícil de verdad, dejamos de simular el desgaste y se lo pasamos al ojo del jugador, que es
exactamente lo que este juego no quiere hacer.

Para verla sin jugar hasta quedarte sin moral: **F2** en `npm run dev` abre un slider.

### Cómo se hace cumplir la regla del núcleo

`tsconfig.json` compila el núcleo, el CLI y el proceso principal **sin `lib: DOM`**. Si alguien
escribe `document` o `window` en `src/core`, no es una convención violada: es un error de
compilación. Solo `tsconfig.app.json`, que cubre `src/app`, incluye el DOM.

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

## Steam

El juego arranca y es jugable **sin Steam corriendo, sin App ID y sin SDK**. Esa es la
implementación definitiva, no un placeholder: un Steam caído no puede convertir el juego en un
ladrillo.

Lo que ya funciona y está verificado en macOS: el build empaquetado, la carga del módulo nativo
fuera del asar, la preparación del overlay de Chromium, el guardado local, y el diagnóstico headless
que se corre por SSH en una Deck.

Lo que necesita tu cuenta de Steamworks y está cableado pero sin probar: logros reales, cuota de
Steam Cloud, overlay in-game y detección de Deck en hardware. El paso a paso está en
[docs/steam.md](docs/steam.md).

## Licencia

Todos los derechos reservados. Código y contenido propietarios.
