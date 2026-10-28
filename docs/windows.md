# El build de Windows

Se arma desde la Mac, sin Windows ni wine: el target `dir` de
[electron-builder.yml](../electron-builder.yml) no necesita instalador.

```bash
npm run empaquetar:win
```

Deja el juego en `release/win-unpacked/`: `Falta Uno.exe`, el runtime de
Electron y `resources/` con tres cosas que tienen que estar sí o sí:

- `app.asar`: el juego.
- `app.asar.unpacked/node_modules/steamworks.js/dist/win64/`: los binarios de
  Steam (`steam_api64.dll` y `steamworksjs.win32-x64-msvc.node`). Van afuera
  del asar porque el SDK los carga desde disco.
- `contenido/`: los JSON del juego, que el proceso principal valida al
  arrancar.

`npm run empaquetar` sigue armando solo la plataforma de la máquina, como antes.

## Para mandárselo a los testers

Un zip con la carpeta adentro, que se llame "Falta Uno" y no "win-unpacked":

```bash
rm -rf release/zip && ditto --norsrc --noextattr --noqtn release/win-unpacked "release/zip/Falta Uno" && ditto -c -k --norsrc --noextattr --keepParent "release/zip/Falta Uno" "release/Falta Uno - Windows.zip" && rm -rf release/zip
```

Los `--norsrc --noextattr` dejan afuera los `._*` que la Mac agrega a cada
archivo: en Windows aparecerían sueltos en la carpeta. Pesa unos 160 MB: por mail no entra, va por Drive o WeTransfer. Junto con el
link, la hoja [testers.md](testers.md).

## Verificarlo en una PC con Windows

Pendiente: todavía no se probó en Windows real. Los pasos, en orden:

1. **Arranca.** Copiá el zip a la PC, clic derecho → *Extraer todo…*, y doble
   clic en `Falta Uno.exe`. SmartScreen va a decir *"Windows protegió tu PC"*:
   *Más información* → *Ejecutar de todas formas*. Tiene que abrir la ventana
   con el living y el teléfono. Si abre en negro o se cierra, corré el exe
   desde PowerShell con `& '.\Falta Uno.exe' | Out-Host` para ver los logs
   (`[contenido] …`, `[ventana] cargada`).
2. **Sin Steam.** Con Steam cerrado, tiene que arrancar igual.
3. **Con Steam.** Con Steam abierto, tiene que figurar "jugando a Spacewar"
   (el App ID 480 de prueba). Si figura, los binarios de `app.asar.unpacked`
   cargaron bien.
4. **Un viernes.** Torneo, fútbol 5, El Pibe. Que se escuchen las
   notificaciones y que la tipografía sea la del juego, no una del sistema.
5. **Guarda.** Cerrá el juego a mitad del viernes y volvé a abrirlo: sigue
   donde estaba. En `%APPDATA%\falta-uno\partidas` tiene que haber un
   `…-fecha-1.json`.
6. **Exporta.** Esc → *Exportar partidas* → el diálogo arranca en el
   Escritorio con `falta-uno-partidas-<fecha>.json` y el botón dice
   *Exportar*. El menú dice "1 viernes exportado" y "Quedó en el Escritorio";
   *Mostrar el archivo* abre el Explorador con el archivo marcado.
7. **Se analiza.** Pasá el archivo a la Mac y corré
   `npm run analizar -- falta-uno-partidas-<fecha>.json`: tiene que aparecer el
   viernes con `win32-x64` en la línea del build.

Cuando pase todo, tachalo del paso 9 del GDD (sección 8, "Plan del vertical
slice").
