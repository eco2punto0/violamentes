# Sonidos incluidos

Esta carpeta está vacía a propósito: WAKE AI no distribuye música con
copyright de terceros. Antes de publicar la app, agregá archivos `.mp3`
propios o con licencia libre en la siguiente estructura (los nombres deben
coincidir con `expectedAssetPath` en `src/core/audio/soundLibrary.ts`):

```
assets/sounds/relax/piano.mp3
assets/sounds/relax/lofi.mp3
assets/sounds/energia/beat.mp3
assets/sounds/electronica/synth.mp3
assets/sounds/rock/riff.mp3
assets/sounds/naturaleza/pajaros.mp3
assets/sounds/caos/alarma.mp3
assets/sounds/comedia/kazoo.mp3
assets/sounds/emergencia/sirena.mp3
```

Buenas fuentes gratuitas: freesound.org (licencias CC0/CC-BY), Pixabay
Audio, o tu propia biblioteca. Mientras un archivo no exista, la UI marca
ese sonido como "necesita archivo" en vez de fingir que suena.

El usuario final siempre puede agregar sus propios sonidos desde la app
(Biblioteca de sonidos → Agregar sonido propio), que sí funciona hoy sin
necesidad de tocar esta carpeta — usa `expo-document-picker` para elegir
cualquier audio del dispositivo.
