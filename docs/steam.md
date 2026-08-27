# Conectar el juego a Steam

Todo lo de este documento requiere **tu cuenta de Steamworks** y no se puede
automatizar desde el repo: hay que pagar Steam Direct, aceptar acuerdos y bajar
el SDK con una sesión iniciada.

Mientras tanto el juego funciona igual. La capa de Steam
([electron/steam.ts](../electron/steam.ts)) degrada con gracia: sin Steam
corriendo, sin App ID y sin SDK, el juego arranca y es jugable. Eso no es una
concesión temporal, es el comportamiento definitivo: un Steam caído no puede
convertir el juego en un ladrillo.

## Estado actual

| | |
|---|---|
| App ID | `480` (Spacewar, el público de pruebas) |
| SDK | lo trae `steamworks.js`, con binarios para win64, linux64 y macOS |
| Overlay | habilitado por código, verificado en macOS |
| Logros | cableados, sin definir en Steamworks |
| Cloud saves | cableados, sin configurar cuota en Steamworks |
| Steam Deck | detección cableada, sin probar en hardware |

## Lo que tenés que hacer vos

### 1. Steam Direct

Alta en [partner.steamgames.com](https://partner.steamgames.com), pago de
US$100 por producto, datos fiscales y bancarios. Sale un **App ID** numérico.

El pago se recupera después de US$1.000 de ventas brutas.

### 2. Poner el App ID

No va hardcodeado ni commiteado. El juego lo lee de la variable de entorno:

```bash
STEAM_APP_ID=1234560 npm run dev
```

Para el build empaquetado, se setea en la configuración de lanzamiento del
depot en Steamworks. Si la variable no está, se usa `480` y todo sigue andando.

### 3. Definir los logros

En Steamworks → *Achievements*. El identificador de cada logro es el string que
recibe `activarLogro()`. El de prueba que ya está cableado se llama
`PRIMER_VIERNES`.

Conviene diseñarlos junto con el contenido en la Fase 6, no pegarlos al final:
son una herramienta de diseño gratis. Ver GDD §8.6.

### 4. Habilitar Steam Cloud

En Steamworks → *Cloud*. Hay que declarar cuota de bytes y cantidad de archivos.
El juego guarda un solo archivo JSON chico, así que la cuota mínima alcanza.

El guardado ([electron/guardado.ts](../electron/guardado.ts)) escribe siempre en
disco local **y** en la nube cuando está disponible. Al cargar, la nube gana:
es la que trae la partida de la otra máquina.

### 5. Subir un build

Steam no usa instaladores propios: se sube el directorio desempaquetado y Steam
maneja instalación y actualizaciones. Por eso `electron-builder.yml` usa
`target: dir` en las tres plataformas.

```bash
npm run empaquetar
```

Deja el build en `release/`. Ese directorio es el que apunta el depot en el VDF
de `steamcmd`.

### 6. Verificar en cada plataforma

En una máquina nueva, o en la Deck por SSH, sin abrir ventana:

```bash
FALTA_UNO_DIAGNOSTICO=1 ./FaltaUno
```

Devuelve JSON con el estado de Steam, el runtime y las rutas, y sale con código
`0` si Steam conectó o `2` si no. Con ventana, la misma información está en la
pantalla de diagnóstico.

## Lo que queda sin verificar hasta que haya App ID

Estas tres cosas están cableadas pero **no probadas**, y no se pueden probar sin
App ID propio ni hardware:

1. **Overlay in-game sobre el build empaquetado.** La preparación corre bien
   (`overlayPreparado: true`), pero que el overlay abra con Shift+Tab arriba del
   juego solo se comprueba lanzando desde Steam.
2. **Logros reales.** `activate()` devuelve `false` sin Steam. Con App ID de
   prueba (480) tampoco sirve: los logros son por App ID.
3. **Steam Deck.** La detección usa `isSteamRunningOnSteamDeck()`, que necesita
   Steam corriendo en la Deck. La navegación por foco ya está hecha en la
   pantalla de diagnóstico y se puede probar con cualquier gamepad conectado.

## Una restricción que conviene saber ahora

`steamworks.js` trae binarios para **win64, linux64 y macOS (x64 + arm64)**. No
hay build para Windows arm64 ni Linux arm64. Para Steam da igual —la Deck es
x64— pero cierra la puerta a una versión nativa para Windows on ARM.
