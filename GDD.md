# Documento de Diseño: "Falta Uno"

**Versión 3.0** — 7 de octubre de 2026
Revisión de la v2. Suma la dirección de arte y la interfaz decididas entre septiembre y octubre
(sección 6, nueva), el estado real de cada fase y el plan para cerrar un viernes (sección 8). Las
secciones 1 a 8 son decisiones tomadas; la sección 9 reúne ideas que todavía no lo son.

### Qué cambió respecto de la v2

La v2 describía una cocina vista desde arriba, armada en CSS, con el teléfono apoyado en la mesa y la
lista de chats como pantalla principal. Se probó y no funcionó: los objetos no se leían, la escala se
rompía con el tamaño de la ventana y la lista de doce contactos iguales no generaba ninguna tensión.

| Tema | v2 | v3 |
|---|---|---|
| Escena | Cocina cenital, CSS y SVG | **Living de noche en primera persona**, renderizado en Blender |
| Teléfono | Rectángulo HTML sobre la mesa | Celular modelado, **en tus manos**; la app vive en el hueco de su pantalla |
| Movimiento | Ninguno | **2.5D por capas**: respiración, contraluz, la tele, temblor con moral baja |
| Pantalla principal | Lista de chats | **El grupo del equipo**, con la lista del partido fijada arriba |
| HUD de roster | Tarjeta sobre la lista de chats | La lista numerada del grupo; una franja compacta en el resto |
| Interrupciones | Alertas | **Chats** en la bandeja, como cualquier otro |
| Bandeja | Doce filas iguales | Secciones por estado; los que no escribiste, en grilla |
| Ergonomía | — | **Zona de pulgares**: en las esquinas de abajo no va nada que se toque |

### Qué cambió de la v1 a la v2

| Tema | v1 | v2 |
|---|---|---|
| Empaquetado | Tauri **o** Electron | **Electron** (decidido) |
| Lenguaje / UI | JS vanilla o framework | **TypeScript + Svelte** (decidido) |
| Reloj del viernes | Tiempo real acelerado (1:10) | **Avanza por acción** |
| Perder el partido | "Se empieza de nuevo" | No termina la campaña; sube la dificultad |
| Gestión semanal | Menú estático aparte | Dentro del mismo teléfono |
| Resolución del partido | Porcentaje + narración | Narración **atribuida** a decisiones concretas |
| Autoría de diálogo | JSON crudo, un archivo | Un archivo por contacto, validado en build |
| Hoja de ruta | Audio y empaquetado en Fase 6 | Empaquetado en Fase 2, audio en Fase 3 |

---

## 1. Ficha Técnica

- **Género:** Gestión de Recursos / Thriller Psicológico de Interfaz / Texto interactivo.
- **Plataforma:** PC (Steam) — Windows, macOS, Linux. **Steam Deck como objetivo de primera clase.**
- **Motor / Tecnología:** HTML5, CSS3, **TypeScript** sobre **Svelte**, empaquetado con **Electron**.
- **Arquitectura:** Núcleo de simulación puro (sin DOM) + capa de vista reactiva. Estado en memoria,
  contenido consumido desde archivos de datos validados por schema.
- **Estilo Visual:** Un living de noche en primera persona, renderizado, con el celular en las manos.
  Adentro, una app de mensajería impecable que contrasta con el caos de las notificaciones y se va
  pudriendo con la moral. Detalle en la sección 6.

### Por qué Electron y no Tauri

Se evaluó Tauri y se descartó. Su ventaja es el tamaño del binario (~10 MB contra ~180 MB), que en
Steam es irrelevante: los usuarios bajan juegos de varios GB. Sus desventajas sí pesan:

- Tauri usa el **webview del sistema** (WebView2 / WKWebView / WebKitGTK). El juego se ve, suena y se
  comporta distinto según la máquina. WebKitGTK en Linux es el punto flojo histórico — justo el
  entorno del Steam Deck.
- Electron empaqueta Chromium: un solo runtime, mismo render y mismos codecs de audio en las tres
  plataformas.
- **Steamworks** (logros, cloud saves, rich presence) tiene camino trillado en Node vía `steamworks.js`.
  En Tauri hay que armar la plomería desde Rust.

### Por qué no un motor de juego

La UI *es* el juego: listas de chat con scroll, burbujas, texto rico, tipografía, notificaciones.
No hay física, sprites ni escenas 3D. El rich text y el layout de Godot y Unity son notablemente
peores que HTML/CSS para esto, y no aportan nada que este proyecto necesite.

### Decisiones técnicas de base

- **TypeScript, no JavaScript.** El contenido serán cientos de nodos de diálogo enlazados entre sí.
  Con tipos y validación de schema en build, un link roto falla al compilar en vez de fallar en la
  cara de un jugador.
- **El núcleo de simulación no toca el DOM.** Ni una referencia. Habilita tests headless y bots de
  balanceo. Es regla dura, no aspiración.
- **RNG con semilla, siempre.** Sin esto no se puede reproducir el bug que reporta un jugador ni
  testear balance de forma comparable.
- **Navegación por foco desde el día 1.** Nada que dependa de `hover`, roving tabindex, todo
  alcanzable con teclado y gamepad. Es barato si se planifica y carísimo de retrofitear.
- **Texto por claves, no inline.** Aunque el lanzamiento sea sólo en español rioplatense.

---

## 2. El Concepto y Objetivo del Juego

Sos el organizador de un equipo de fútbol amateur inscripto en un torneo local. Tu misión es asegurar
la asistencia de exactamente 10 jugadores con roles funcionales para el partido de las 21:00, gestionar
el pago de la seña de la cancha y sobrevivir al estrés de las excusas, las cancelaciones de último
minuto y las crisis personales.

### Bucle de Jugabilidad (Core Loop)

1. **Gestión Semanal.** Decisiones rápidas de texto sobre tu vida laboral y personal que afectan tus
   recursos iniciales para el viernes. **Ocurre dentro del mismo teléfono**, como mensajes que van
   llegando durante la semana — no es una pantalla ni un menú aparte.
2. **El Viernes de Terror (gameplay principal).** De 19:00 a 21:00 virtuales gestionás la agenda de
   contactos para cerrar la lista de 10.
3. **La Simulación del Partido (resolución).** El sistema calcula el resultado en base a tus elecciones
   y lo narra atribuyendo cada evento a una decisión concreta.
4. **Consecuencia.** El resultado modifica tus recursos y la dificultad de la semana siguiente. La
   campaña continúa.

### Condiciones de derrota (corrección importante respecto de la v1)

La v1 decía "si se pierde, se empieza de nuevo", y a la vez decía que perder aumenta la dificultad.
Son cosas incompatibles. Queda definido así:

> **Perder un partido no termina la campaña.** Es un mal resultado: menos dinero, menos prestigio,
> contactos más difíciles de convencer la semana siguiente.

Las condiciones de derrota reales son las de recursos, y son las únicas que cortan la campaña:

- **Moral en 0** → colapsás por estrés y no vas a jugar.
- **Bancarrota** → a las 21:00 no llegás a 10 jugadores y no tenés plata para cubrir las vacantes.
- **Disolución del equipo** → varias fechas consecutivas sin poder armar el partido.

El motivo es de diseño de contenido, no de piedad: en un juego de texto, reiniciar obliga a releer
material ya visto y quema el contenido a una velocidad brutal.

### El primer viernes es el tutorial

No hay tutorial explícito. El primer partido es un **amistoso** con pocos contactos disponibles y
consecuencias suaves, que enseña el reloj, el chat y los recursos jugando.

---

## 3. Clases y Perfiles (El Trasfondo)

Al iniciar la campaña, el jugador elige su perfil, que define recursos iniciales y contactos de
emergencia:

| Perfil | Ventaja | Desventaja | Contacto Único Desbloqueado |
|---|---|---|---|
| **El Acomodado** | Empieza con mucho Dinero. | Poca Moral inicial (presión social). | Político / Presidente (al arco). |
| **El Pibe de Barrio** | Moral alta y química de equipo. | Dinero inicial muy bajo. | Kiosquero. |
| **El Oficinista** | Balance medio. | El Jefe interrumpe un 50% más. | Sindicalista (anula pasivas rivales). |

---

## 4. Recursos y Sistemas Principales

### A. Los Recursos

- **Paciencia / Moral.** Tu barra de vida. Se consume al lidiar con quejas, mensajes hostiles o peleas
  con tu pareja. Si llega a 0, colapsás por estrés.
- **Dinero.** Necesario para pagar la seña del complejo. También sirve para cubrir vacantes de último
  momento (pagarle a alguien para que venga).
- **El Reloj.** De 19:00 a 21:00. **Avanza por acción, no en tiempo real.**

### El Reloj: por qué cambia respecto de la v1

La v1 proponía tiempo real acelerado (1 minuto real = 10 virtuales). Tiene dos problemas serios:

1. **Duración.** Dos horas virtuales serían 12 minutos reales. Demasiado corto para ser el gameplay
   principal del juego.
2. **Contradice la mecánica central.** El costo de Moral es leer mensajes largos y lidiar con gente,
   pero un cronómetro en tiempo real castiga al jugador por leer. Se le pide que lea con ansiedad y
   después se lo penaliza por tardar.

**El tiempo avanza cuando el jugador hace algo**, con costo visible antes de elegir:

| Acción | Costo aproximado |
|---|---|
| Mandar un mensaje | 2 min |
| Insistir / mensaje largo | 4 min |
| Llamar por teléfono | 8 min |
| Atender a tu pareja | 15 min |
| Resolver un pedido del trabajo | 20 min |

Ganás tres cosas: el jugador puede leer tranquilo, la presión se vuelve **legible** (ve el costo antes
de comprometerse) y el balance deja de depender de la velocidad de lectura de cada persona.

**La ansiedad viene de las notificaciones, no del cronómetro.** Los mensajes entrantes sí llegan con
timers reales cortos, se apilan y suenan. Esa es la fuente del agobio.

### Dos relojes (decidido en octubre de 2026)

El reloj del viernes y el tiempo real conviven sin pisarse:

- **El reloj del viernes** sigue avanzando solo por acción. Las 21:00, la revisión de las 20:30 y las
  ventanas de las interrupciones viven en él.
- **El pulso** es tiempo real: la cola de lo que está en camino. Las respuestas llegan después de un
  "escribiendo…" que dura según el largo, las interrupciones caen unos segundos después del toque que
  las disparó y, si no las atendés, vuelven a escribir. Entra al núcleo como un comando más,
  `transcurrir(ms)`, que la ventana manda mientras está visible.

Dos reglas lo acotan:

1. **Lo que no llegó no existe para el juego.** No se le contesta a quien todavía está escribiendo,
   una interrupción no drena hasta que llega y leer cuesta cuando el mensaje llega.
2. **El tiempo real nunca toca recursos.** No mueve el reloj ni la moral: cambia lo que hay en
   pantalla. Lo que cuesta es lo que hacés con ese ruido.
3. **El ruido llega por segundo; lo que cuesta se cobra por acción.** Ninguna consecuencia se mide
   en segundos reales, así el que lee lento no pierde jugadores. Si hace falta que ignorar duela,
   la palanca es que dejar a alguien esperando lo enfríe por cada acción que hacés en otro chat,
   como ya drenan las interrupciones.

El pulso tiene su propio RNG, derivado de la semilla, así que lo rápido que juegue cada uno no cambia
lo que pasa en sus decisiones. La misma semilla con los mismos comandos, `transcurrir` incluido, da la
misma partida. Se descartó que el tiempo real empuje el reloj (vuelve el cronómetro de la v1) y quedó
en reserva que una pila de no leídos drene moral: se evalúa en el vertical slice si la gente aprende a
ignorar las notificaciones.

### B. El Sistema de Conversación (Dirigido por Datos)

- **Árboles de Diálogo.** Los NPCs no usan IA en tiempo de ejecución (ver sección 7). Se navegan
  mediante opciones de respuesta rápida almacenadas en archivos de contenido.
- **Modificadores Ocultos.** Cada respuesta altera el estado del NPC (`probabilidad_baja`, `enojo`,
  `dinero_aportado`) y tus propios recursos (`paciencia`).
- **Cancelaciones Dinámicas.** Un NPC confirmado puede activar un trigger a las 20:30 para bajarse si
  su `probabilidad_baja` superó el 80% por tus respuestas anteriores.

### C. Sistema de Eventos y Tensiones

- **Eventos de la Semana (lore).** "Te pasaste de rosca en el gimnasio haciendo piernas y te dio un
  tirón." Si aceptás descansar, perdés habilidad para el partido; si forzás, arrastrás estrés al viernes.
- **Misiones Secundarias (favores).** Resolver un problema para un número desconocido te consume Moral
  hoy, pero te desbloquea un contacto random vital para el próximo partido.
- **Interrupciones del Viernes.** Tu pareja reclamando atención o el trabajo exigiendo una tarea.
  Ignorarlos consume Moral pasiva masiva; atenderlos consume reloj.
- **La vida propia del grupo** (agregado en octubre de 2026). El grupo habla aunque vos no hagas
  nada, y todo sale de `contenido/grupo.json`, validado como los contactos:
  - **Charla.** Arranca en una franja del reloj, cuando confirma alguien en particular o cuando la
    lista llega a tanto. Llega en tiempo real, con su "escribiendo…", y no cuesta nada: es ruido.
  - **Audios.** Escucharlos cuesta un minuto de reloj por cada medio minuto de audio. Mientras
    suenan se oye un murmullo que no se entiende; al terminar queda escrito lo que dijeron. Algunos
    traen información que solo está ahí y que habilita respuestas en el chat privado ("vos de cinco,
    al arco ni loco"). Otros enfrían a quien lo mandó por cada acción tuya mientras no lo escuches.
  - **Roces.** Cuando entra alguien que se cruza con otro de la lista, se pelean en el grupo
    citándose. Mientras nadie los calme, los dos se enfrían con cada acción tuya; calmarlos cuesta
    reloj. Un roce calmado se narra en el partido como que lo calmaste, no como una pelea.

### D. HUD de Roster (agregado en v2, resuelto en v3)

El jugador tiene que ver **siempre**, sin abrir nada: `7/10 — faltan 2 defensores y 1 arquero`.
Es la información central del juego y no puede estar escondida detrás de un click.

En la v3 el HUD es **la lista del partido**, fijada arriba del grupo con la forma que tiene en
cualquier grupo de fútbol: numerada del 1 al 10, en el orden en que se fue anotando cada uno, con un
signo de pregunta para los que están en duda y los huecos que faltan. Debajo, lo que falta por puesto
y la seña. En cualquier otro chat la lista se achica a una franja de un renglón que sigue a la vista.

---

## 5. El Torneo y la Simulación

### La Fase de Gestión

- **Química y Roles.** Invitar a 5 delanteros baja el porcentaje de victoria global. Mezclar al
  habilidoso con el "rústico" puede generar peleas en el chat (consumiendo Moral) pero aumenta el
  porcentaje de victoria.
- **Pasivas Random.** Un contacto de emergencia (ej. el Sindicalista) te salva el cupo, pero su pasiva
  puede suspender el partido o garantizar la victoria por escritorio.

### El Motor de Resolución

A las 21:00 exactas se corta el chat. El sistema calcula:

```
Probabilidad Base del Equipo + Química de Roles + Variables de Pasivas = % de Victoria Final
```

### La narración atribuida (cambio importante respecto de la v1)

La fórmula está bien. El problema es su presentación: el jugador trabajó cuarenta minutos y el
desenlace lo decide un número aleatorio. Se siente arbitrario.

**La matemática no cambia. Cambia la narración: cada evento del partido se atribuye a una decisión
concreta que el jugador tomó.**

- "Carlos, que vino de mala gana porque lo apuraste a las 20:15, erra el gol en la última."
- "El arquero que te consiguió el Político ataja todo. Valió cada peso."
- "Se arma lío entre el Rústico y el Habilidoso. Los tenías juntos y ya se habían cruzado en el chat."

Es el cambio con mejor relación esfuerzo/impacto de todo el proyecto: cero modificación del modelo,
diferencia enorme en cómo se siente el desenlace.

El partido se narra mediante un panel de notificaciones estilo feed de texto. Ganar otorga Prestigio y
Dinero para la semana siguiente. Perder aumenta la dificultad para conseguir jugadores.

---

## 6. La escena y el teléfono (agregado en v3)

### La escena

Estás tirado en el sillón un viernes a la noche, con el celular en las dos manos. Atrás, desenfocado,
el living: la tele pasando un partido, el mueble, una planta, la mesa ratona con el mate. Mundo sucio
y real por fuera; la app, lo único ordenado.

- **Primera persona, legibilidad primero.** El celular está a 30 cm de los ojos y casi de frente: la
  pantalla no se deforma y el texto se lee como en un teléfono de verdad. Ocupa cerca del 75% del
  alto del cuadro.
- **Renderizada, no dibujada.** La escena sale de Blender (`arte/living.blend`) con assets de uso libre
  (Poly Haven, MPFB/MakeHuman, Sketchfab con atribución; ver `arte/CREDITOS.md`).
- **En capas.** Un fondo desenfocado y un primer plano nítido con la pantalla agujereada. La app es
  HTML de verdad y va entre las dos: los pulgares del render tapan la pantalla como la taparían en la
  mano. Un script exporta las capas y la geometría de la pantalla; la interfaz no tiene medidas a ojo.
- **Movimiento 2.5D.** Las manos respiran y se mecen; el fondo se mueve al revés y menos; la luz de la
  tele cambia de plano. Con la moral baja el living se apaga y la mano tiembla. Todo se apaga con
  `prefers-reduced-motion`.

### La degradación es un solo valor

De la moral sale un único `deterioro` de 0 a 1 que alimenta todos los tokens de la interfaz y de la
escena. Ningún componente pregunta por la moral. La regla que lo acota: **la degradación nunca toca la
legibilidad del texto que el jugador necesita leer.**

### La app

- **El grupo es la pantalla principal.** El juego abre ahí. Arriba la lista (ver 4.D); en el medio lo
  que pasa en el grupo; abajo no hay teclado sino acciones con su costo.
- **Chats privados** para convencer a cada uno. Cada respuesta muestra su costo en minutos antes de
  elegirla; lo que provoca en el otro queda oculto. Los gestos (cerrar el chat, no contestar) van
  aparte, apagados.
- **Las interrupciones son chats.** Sofi, el jefe, la cancha: llegan a la bandeja y se atienden ahí.
- **Los audios** se ven como en cualquier app: la forma de onda, lo que duran y, antes de tocar, lo
  que cuesta escucharlos. La forma de onda sale del murmullo de verdad. Ya escuchado, la onda se
  apaga y lo que importa es lo que dijo, escrito abajo.
- **Los roces** se ven como gente contestándose con citas. Mientras dura la pelea, una franja arriba
  de las acciones dice quiénes se pelean y deja calmarlos, aunque la pelea ya haya quedado arriba en
  el chat.
- **Lo que llega a otro chat** crece desde la cámara frontal del render, como una isla. Abierta
  muestra lo último que llegó y tapa la cabecera, nunca la lista; cerrada abraza la cámara y dice
  cuántos te esperan. Al mismo tiempo el celular vibra en la mano y suena. Lo que llega al chat que
  estás mirando no vibra ni suena: ya lo estás viendo. El grupo está silenciado, como todo grupo de
  fútbol: su charla aparece en la isla pero no vibra ni suena; los audios y las peleas, sí.
- **El sonido es nuestro.** Los tonos se sintetizan en el código, sin archivos ni licencias de
  terceros, y se degradan con el deterioro como todo lo demás: se desafinan y se opacan, sin dejar de
  oírse nunca.
- **La bandeja** pone arriba lo que reclama atención y separa a la gente por en qué está con vos. Los
  que todavía no escribiste van en una grilla compacta.
- **El color es información.** La app es acromática; lo único con color es el estado de cada jugador
  (verde en la lista, azul hablando, rojo no viene), y se repite igual en la lista, en los nombres del
  grupo y en el anillo de las fotos.
- **Zona de pulgares.** Los pulgares del render tapan las esquinas de abajo. Ahí no va nada que haya
  que tocar o leer, salvo centrado entre los dos dedos.

---

## 7. Arquitectura Técnica

### Capas

```
┌─────────────────────────────────────────┐
│  Vista (Svelte)                         │  Sin lógica de negocio.
│  El teléfono, los chats, el HUD         │  Función pura del estado.
├─────────────────────────────────────────┤
│  Store reactivo                         │  Puente. Traduce intención → comando.
├─────────────────────────────────────────┤
│  Núcleo de simulación (TypeScript puro) │  Cero DOM. Testeable headless.
│  Partida · Contacto · Reloj · Resolución│  RNG con semilla.
├─────────────────────────────────────────┤
│  Contenido (datos validados por schema) │  Un archivo por contacto.
└─────────────────────────────────────────┘
```

El núcleo expone comandos (`responder(contactoId, opcionId)`, `llamar(contactoId)`) y devuelve estado
nuevo. La vista nunca calcula nada: sólo dibuja lo que el núcleo dice.

### Estructura de Datos

Cada contacto es un archivo propio con su estado base y su árbol de conversaciones:

```json
{
  "id": "carlos_el_quejoso",
  "rol": "defensor",
  "estado": "pendiente",
  "dialogos": { }
}
```

**No un archivo gigante.** Un archivo por contacto, más un schema JSON validado en el build. Un link
roto o un efecto mal escrito rompe la compilación, no la partida.

### La IA en este proyecto

**Decisión: los NPCs no usan LLM en tiempo de ejecución.** No es sólo eficiencia; son cinco razones
que se acumulan:

1. **Costo recurrente contra venta única.** Un jugador de 20 horas cuesta plata real, para siempre,
   sobre un pago que se cobró una sola vez.
2. **Steam espera offline.** Un juego que se rompe cuando vence una API key es reviews negativas
   garantizadas y pedidos de reembolso.
3. **Latencia.** Dos a cuatro segundos por respuesta destruyen el ritmo frenético que es el punto del juego.
4. **Determinismo.** Toda la mecánica son modificadores ocultos. Un LLM no los mueve de forma confiable.
   Forzarlo requiere salida estructurada y opciones acotadas: es el mismo JSON con pasos de más.
5. **Localización.** El texto generado no se traduce y rompe el pipeline multi-idioma de Steam.

Y la razón de fondo: **el chiste es la escritura.** Una excusa escrita a mano que da exactamente en el
clavo es más graciosa que una excusa plausible generada. Eso es el producto.

**Dónde la IA sí se usa: en el pipeline de producción, no en runtime.**

- Generar cientos de variantes de excusas offline, curar las buenas, shipear el resultado como datos.
  Multiplicador de contenido enorme con costo cero para el jugador.
- Un agente que juegue miles de partidas contra el núcleo headless para encontrar balance roto.
- Borradores de localización.

### Persistencia

- **Guardado en cada acción.** Un viernes a medias tiene que poder retomarse.
- **Steam Cloud** desde el principio.
- El save de un viernes a medias es la semilla más la lista de comandos, `transcurrir` incluido, y se
  retoma jugándolos de nuevo (decidido en octubre de 2026). No hay que acordarse de serializar cada
  campo nuevo del núcleo, y el save de un jugador reproduce su bug tal cual. El tiempo real seguido
  se anota como un solo paso, en milisegundos enteros. Lo que la vista recuerda (la pantalla abierta,
  lo ya leído) va aparte, en el mismo archivo.
- Cada copia lleva un sello que sube con cada guardado: entre la nube y el disco gana la más nueva.

### Integración con Steam

- `steamworks.js` para logros, cloud saves y rich presence.
- **Verificar el Steam Overlay sobre Electron en la Fase 2.** Es fricción conocida en apps Chromium
  (afecta capturas con F12 y Steam Input). No es bloqueante, pero es de las cosas que hay que descubrir
  en la semana 2, no en la semana 30.
- **Steam Deck:** un juego Electron sólo-mouse arranca como "Unsupported". Ver navegación por foco en
  la sección 1.

---

## 8. Fases de Desarrollo (Hoja de Ruta)

- **Fase 1 — Motor y Datos (núcleo lógico).** Clases `Partida`, `Contacto`, `Reloj`; parseador y
  validador de contenido; lógica de avance del tiempo. Todo por consola, con tests. Sin interfaz.
- **Fase 2 — Empaquetado y Steam.** *(Subida desde la Fase 6.)* Un "hola mundo" en Electron corriendo
  desde Steam, en Windows, macOS y Deck. Steamworks conectado, un logro de prueba, cloud save de prueba,
  overlay verificado. Elimina el riesgo de plataforma antes de invertir treinta semanas.
- **Fase 3 — Maquetación UI y Audio.** *(Audio subido desde la Fase 6.)* La pantalla del teléfono en
  HTML/CSS, scroll de chats, HUD de roster, navegación por foco. **Con sonido de notificaciones desde
  el principio: las notificaciones son el estrés, y sin audio no se puede evaluar si el juego funciona.**
- **Fase 4 — Integración.** Conectar la vista con el núcleo: chatear de verdad, ver bajar Moral y Reloj.
- **Fase 5 — El Simulador.** La pantalla de las 21:00, el algoritmo de resolución y la narración atribuida.
- **Fase 6 — Contenido.** Escribir el guion: contactos, excusas, eventos de la semana, interrupciones.
  Es la fase más larga del proyecto.
- **Fase 7 — Pulido y Lanzamiento.** Balance con bots, localización si aplica, página de Steam,
  certificación de Deck, build final.

### Estado al 8 de octubre de 2026

Avance hacia el lanzamiento: **43%**, pesando cada fase por el trabajo que lleva (el contenido pesa
40%). El vertical slice está en un **70%**.

| Fase | Peso | Avance | Estado |
|---|---|---|---|
| 1 — Motor y datos | 10% | 100% | ✅ Núcleo con tests, bot de balance con estilos, analizador de partidas. |
| 2 — Empaquetado y Steam | 5% | 60% | 🟡 Completa en macOS. Falta Windows, una Deck real y lo que necesita la cuenta de Steamworks. |
| 3 — Interfaz y audio | 15% | 70% | 🟡 Escena, app, vibración, sonido, modos y apodos. Falta el ambiente del living y el gamepad. |
| 4 — Integración | 8% | 100% | ✅ Un viernes se juega de punta a punta adentro del teléfono. |
| 5 — El simulador | 7% | 85% | 🟡 Relato atribuido, cuenta de la fecha y campaña con sus finales. Faltan las pasivas. |
| 6 — Contenido | 40% | 12% | 🟡 El slice: 12 contactos del Oficinista (8 a fondo, 4 de segunda línea), grupo e interrupciones. |
| 7 — Pulido | 15% | 5% | ⬜ Solo las herramientas de balance. |

Balance del slice (torneo F5, Oficinista, 1000 viernes): se cumplen 3 de los 7 objetivos.

| Objetivo | Meta | Medido |
|---|---|---|
| Razonable llena la lista | 55–65% | 60% ✓ |
| Atento llena la lista | 75–85% | 89% ✗ |
| Apurado llena la lista | 20–35% | 20% ✓ |
| Gana | 45–55% | 51% ✓ |
| Bajas por viernes | 0,6–1 | 2,3 ✗ |
| Rechazos por viernes | 1–2 | 0,7 ✗ |
| Ninguna causa de fracaso pasa del 50% | <50% | bajas 93–100% ✗ |

Lo que dicen los números, más allá de los objetivos:

- **La baja no se ve venir.** Se decide a las 20:30 con un umbral sobre una calentura que la pantalla
  no muestra en ningún lado. El jugador llena la lista a las 19:48 y después espera: cuando alguien se
  baja se siente mala suerte, no un error propio.
- **A quién traés casi no cambia el partido.** El razonable gana el 51% y el atento el 53%. La
  probabilidad sale casi toda del promedio de habilidad, y llevando 8 de 12 ese promedio se mueve
  poco.
- **En los formatos grandes jugar bien rinde menos.** En torneo F8 el atento llena la lista 7 puntos
  más que el razonable; en F5, 27. Tendría que ser al revés.
- **El relato se repite.** Tres fraseos por gol y uno por cada tipo de momento: en cuatro partidos
  seguidos sale cuatro veces "vino de mala gana y erra un gol hecho".

### Plan para cerrar un viernes

1. ✅ **Que se sienta.** Mensajes que llegan solos con timers reales, la vibración del celular en la
   escena, el sonido de notificaciones y la vida propia del grupo.
2. ✅ **Cerrar el circuito.** Elegir perfil con su contacto único, guardar en cada acción y la pantalla
   de las 21:00 con la narración atribuida.
3. **Vertical slice** (9.8): un viernes con ocho contactos, pulido al máximo y difícil de verdad, para
   probarlo con gente antes de escribir el resto del guion. Sigue abajo.
4. **Deuda que no conviene estirar:** texto por claves, gamepad para la Deck, verificación en Windows y
   en una Deck real.

### Plan del vertical slice

Cada paso se mide con el bot antes y después. El orden de las perillas sigue siendo instrumento →
contenido → margen → plata → reloj.

1. ✅ **Instrumento, contenido y modos.** Bot con estilos, archivo de partidas, analizador; los doce
   contactos en el tono nuevo; partido y torneo en F5, F6 y F8; apodos.
2. ✅ **El relato no inventa.** Un roce de alguien que se bajó, o el invitado que no vino, ya no se
   narran jugando.
3. ✅ **Que la baja se vea venir.** Cuando un confirmado se calienta, avisa con un mensaje propio antes
   de las 20:30; leerlo a tiempo da para llamarlo o bajarle un cambio. Una señal escrita por
   contacto, en el tono de cada uno. Meta: bajas 0,6–1 por viernes; el atento las ataja, el razonable
   a veces, el apurado nunca. *Hecho: bajas del razonable de 2,3 a 1,5 y del atento de 0,9 a 0,6
   (lo que le queda son invitados que no vienen).*
4. **Que el "no" aparezca.** Más caminos de rechazo por algo que hiciste, como "hoy armás vos carlos",
   que cuesta a Beto. Meta: rechazos 1–2 por viernes.
5. **Repartir las causas.** Que la plata, el reloj y la moral expliquen entre 15% y 30% de los
   fracasos cada una, y las bajas menos de la mitad. Después, el atento a 75–85%.
6. ✅ **Que la formación pese.** Arrancan los mejores de cada puesto; fuera de puesto se rinde 20
   puntos menos y el banco no suma. *Hecho: el atento gana 61% y el razonable 51% (antes 53% y
   51%). Queda: que la habilidad se lea en la escritura, no solo en el retrato.*
7. ✅ **El relato variado.** `contenido/relato.json`: de tres a seis fraseos por momento y por gol,
   sin repetir dentro del partido.
8. **Los formatos grandes.** Que en F6 y F8 la diferencia entre jugar bien y jugar más o menos sea
   igual o mayor que en F5. *Ahora se pasó para el otro lado: en torneo F6 el atento llena la lista
   el 100% y el razonable el 29%; en los partidos sueltos el atento llega al 100%.*
9. **Para los testers.** Build de Windows, "Exportar partidas" desde el menú y una hoja de
   instrucciones. Cada viernes jugado ya queda en `partidas/` con su build.
10. **Probar y decidir.** Cinco o más personas, dos viernes cada una. `npm run analizar` sobre lo que
    manden. Es el momento honesto de decidir si el juego funciona (9.8).

### Después del slice

- **Deuda:** texto por claves completo, gamepad, Windows y una Deck real, Steamworks.
- **El concepto completo:** la gestión semanal (paso 1 del bucle, sección 2), el amistoso que hace de
  tutorial, las pasivas del Sindicalista y del Político, y los otros dos perfiles con su contenido.
- **Contenido (fase 6):** todas las fechas del torneo, los contactos del Acomodado y del Pibe de
  Barrio, los eventos de la semana. Es cerca del 88% del texto que falta.
- **Pulido (fase 7):** balance de la campaña entera, logros (9.6), página de Steam, certificación de
  Deck, build final.

---

## 9. Ideas propuestas (a evaluar, no decididas)

Todo lo de esta sección son propuestas abiertas. Ninguna está comprometida.

### 9.1 Autoría del contenido: Ink en vez de datos crudos

[Ink](https://www.inklestudios.com/ink/) es el lenguaje de guion narrativo de inkle, con runtime para
JavaScript (`inkjs`) y editor propio (Inky). Está diseñado exactamente para árboles de diálogo con
variables y contenido condicional.

- **A favor:** la Fase 6 implica escribir *muchísimo* texto. Hacerlo en un editor de guion en vez de
  entre llaves de JSON cambia la velocidad de escritura por completo.
- **En contra:** Ink asume una narrativa más lineal que el modelo de conversaciones paralelas de este
  juego.
- **Forma posible:** Ink para los árboles *dentro* de cada contacto; el motor propio para la
  orquestación (reloj, recursos, triggers, cancelaciones).
- **Alternativa más conservadora:** YAML con schema, que al menos es más cómodo de escribir que JSON.

### 9.2 Variación por plantillas para que "se sienta vivo"

Sin LLM y sin costo de runtime: plantillas con variación gramatical (estilo Tracery) más etiquetas de
tono. El mismo mensaje en seis fraseos distintos según el estado del NPC. Es offline, determinista y
cubre casi toda la sensación de "no se repite" que motivaría usar IA.

### 9.3 Meta-progresión entre campañas

Si una campaña termina (Moral en 0, bancarrota), que algo persista: contactos ya conocidos, excusas ya
escuchadas, "ya sabés que Carlos siempre miente". Convierte el fracaso en conocimiento y hace que
volver a empezar no sea releer.

### 9.4 Modo IA opcional post-lanzamiento

Una vez que el juego esté vendido y estable, un modo opt-in con modelo local pequeño o API key propia
del jugador, claramente marcado como experimental. Nunca en la v1, nunca como camino por defecto.

### 9.5 Bot de balanceo

**Hecho en la Fase 1** (`npm run bot`). Queda acá porque su alcance completo, contactos que nunca se
usan y decisiones falsas, sigue abierto.

Un agente que juegue diez mil partidas contra el núcleo headless y reporte: porcentaje de victoria por
perfil, contactos que nunca se usan, decisiones que son siempre óptimas (o sea, decisiones falsas).
Barato de escribir gracias a la regla de "el núcleo no toca el DOM", y es la única forma realista de
balancear un juego de sistemas sin cientos de playtesters.

### 9.6 Logros de Steam como diseño, no como decoración

Los logros son una herramienta de diseño gratis: "Cerrar la lista antes de las 20:00", "Ganar con once
jugadores que nunca habían jugado juntos", "Sobrevivir un viernes sin responderle a tu pareja".
Enseñan mecánicas y sugieren estilos de juego. Conviene diseñarlos junto con el contenido, no pegarlos
al final.

### 9.7 Localización a inglés

El humor es profundamente rioplatense y buena parte no sobrevive la traducción literal. Si se hace, se
hace como **localización** (reescritura cultural), no como traducción. La decisión puede postergarse,
pero la preparación técnica (texto por claves) ya está decidida en la sección 1 porque es casi gratis
hacerla ahora y cara hacerla después.

### 9.8 Vertical slice antes de escalar contenido

**Adoptada:** es el paso 3 del plan de la sección 8.

Antes de la Fase 6 completa, un viernes entero con ocho contactos, pulido al máximo, jugable de punta a
punta. Sirve para playtesting real, para el trailer y para la página de Steam. Es también el momento
honesto para decidir si el juego funciona antes de escribir el 90% restante del guion.
