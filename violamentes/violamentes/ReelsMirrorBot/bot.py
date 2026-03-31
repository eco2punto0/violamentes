import os
import re
import tempfile
import subprocess
import telebot
import yt_dlp
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Obtener TOKEN
BOT_TOKEN = os.environ.get('BOT_TOKEN')
if not BOT_TOKEN:
    raise ValueError("No se encontró BOT_TOKEN en las variables de entorno.")

bot = telebot.TeleBot(BOT_TOKEN)

# Patrones genéricos para capturar URLs en el mensaje
URL_PATTERN = re.compile(r'(https?://(?:www\.)?(?:instagram\.com|tiktok\.com|facebook\.com(?:/reels)?|youtube\.com/shorts|youtu\.be)[^\s]+)')

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    welcome_text = (
        "👋 ¡Hola! Soy ViolaMentes.\n\n"
        "Envíame un enlace de un Reel (Instagram, TikTok, Facebook Reels, YouTube Shorts) "
        "y te devolveré el video con efecto espejo (horizontal flip) y sin marca de agua.\n\n"
        "¡Pruébalo ahora enviándome un enlace!"
    )
    bot.reply_to(message, welcome_text)

@bot.message_handler(func=lambda message: True)
def process_url(message):
    text = message.text
    match = URL_PATTERN.search(text)
    
    if not match:
        bot.reply_to(message, "❌ No encontré un enlace válido. Por favor, envía un enlace de Instagram, TikTok, Facebook o YouTube Shorts.")
        return
    
    url = match.group(1)
    msg = bot.reply_to(message, "⏳ Procesando tu video... Esto puede tomar unos segundos.")
    
    try:
        # Usar tempfile para no saturar el disco y limpiar automáticamente
        with tempfile.TemporaryDirectory() as temp_dir:
            input_video_path = os.path.join(temp_dir, "input.mp4")
            output_video_path = os.path.join(temp_dir, "output.mp4")
            
            # 1. Descargar con yt-dlp
            bot.edit_message_text("⬇️ Descargando video...", chat_id=message.chat.id, message_id=msg.message_id)
            
            ydl_opts = {
                'outtmpl': input_video_path,
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                'quiet': True,
                'no_warnings': True,
                'merge_output_format': 'mp4'
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            
            # Verificar si se descargó con el nombre exacto, de lo contrario tomar el archivo mp4 existente
            if not os.path.exists(input_video_path):
                files = os.listdir(temp_dir)
                if files:
                    input_video_path = os.path.join(temp_dir, files[0])
                else:
                    raise Exception("No se generó el archivo de video de salida.")

            # 2. Aplicar efecto espejo y optimizar flags con ffmpeg
            bot.edit_message_text("🔄 Aplicando efecto espejo...", chat_id=message.chat.id, message_id=msg.message_id)
            
            ffmpeg_cmd = [
                'ffmpeg',
                '-i', input_video_path,
                '-vf', 'hflip',
                '-c:a', 'copy',
                '-movflags', '+faststart',
                '-y',
                output_video_path
            ]
            
            subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # 3. Enviar video a Telegram
            bot.edit_message_text("📤 Subiendo video a Telegram...", chat_id=message.chat.id, message_id=msg.message_id)
            
            with open(output_video_path, 'rb') as video_file:
                bot.send_video(
                    message.chat.id,
                    video_file,
                    reply_to_message_id=message.message_id,
                    caption="✨ ¡Aquí tienes tu video espejo!"
                )
            
            bot.delete_message(chat_id=message.chat.id, message_id=msg.message_id)

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"Error descargando {url}: {e}")
        bot.edit_message_text("❌ Error al descargar el video. Es posible que el video sea privado, esté eliminado, o la plataforma haya bloqueado la descarga.", chat_id=message.chat.id, message_id=msg.message_id)
    except subprocess.CalledProcessError as e:
        logger.error(f"Error ffmpeg: {e}")
        bot.edit_message_text("❌ Error interno al aplicar el efecto espejo al video.", chat_id=message.chat.id, message_id=msg.message_id)
    except Exception as e:
        logger.error(f"Error inesperado: {e}")
        bot.edit_message_text("❌ Ups, ocurrió un error inesperado al procesar tu solicitud.", chat_id=message.chat.id, message_id=msg.message_id)

if __name__ == '__main__':
    logger.info("Iniciando ReelsMirrorBot...")
    bot.infinity_polling()
