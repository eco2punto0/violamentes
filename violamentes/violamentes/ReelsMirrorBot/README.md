# ReelsMirrorBot 🔄

Un bot de Telegram que descarga videos cortos de redes sociales (Instagram Reels, TikTok, Facebook Reels, YouTube Shorts), les aplica un efecto espejo (horizontal flip) y los devuelve optimizados para volver a publicar sin marca de agua (siempre que la plataforma lo permita).

## Requisitos y Funcionamiento

- Desarrollado en **Python 3**.
- Utiliza **yt-dlp** para las descargas de plataformas y **ffmpeg** para el procesamiento del video.
- Almacena videos en el directorio temporal solo durante el procesamiento, dejándolo limpio inmediatamente después de operar.

## Instrucciones para Railway (Deploy Automático)

### 1. Obtener el Token del Bot
1. Abre Telegram y busca a [@BotFather](https://t.me/BotFather).
2. Envía el comando `/newbot` y sigue los pasos para crear tu bot.
3. Copia el **TOKEN** que te dará al finalizar (Ejemplo: `123456789:ABCDE-fgHIJKL-mnoPQR`).

### 2. Guardar este código en tu repositorio de GitHub
Desde tu máquina local sube esta carpeta de código a un nuevo repositorio remoto en GitHub.

### 3. Crear el servicio en Railway.app
1. Regístrate o Inicia sesión en [Railway](https://railway.app/).
2. Haz clic en **Create a New Project** y selecciona **Deploy from GitHub repo**.
3. Selecciona tu repositorio recién creado.
4. **IMPORTANTE**: Ve a la pestaña **Variables** en el panel de control de ese proyecto en Railway.
5. Haz clic en **New Variable**, introduce `BOT_TOKEN` en el nombre y pega el token de tu BotFather en el valor.
6. Permite que Railway finalice la construcción. Railway leerá `nixpacks.toml` para instalar `ffmpeg` y luego ejecutará tu `bot.py` según `Procfile`.

¡Listo! Cuando el proyecto figure de color verde (Deployed), puedes ir a Telegram y enviarle un link a tu nuevo bot para probarlo.
