# Usa una imagen oficial de Python ligera
FROM python:3.10-slim

# Instala ffmpeg, que es requerido para el efecto espejo, y luego limpia la caché para ahorrar espacio
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Establece la carpeta principal de trabajo en el contenedor
WORKDIR /app

# Copia los archivos del bot al contenedor
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia el resto del código
COPY bot.py .

# Ejecuta el bot
CMD ["python", "-u", "bot.py"]
