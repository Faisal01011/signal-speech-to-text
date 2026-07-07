# Using slim base to keep the image reasonably small while still having
# apt available for ffmpeg, which faster-whisper needs for audio decoding.
FROM python:3.12-slim

# ffmpeg: required by faster-whisper/ctranslate2 to decode webm/mp3/etc.
# build-essential: some Python deps (e.g. ctranslate2) may need it to build wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install requirements first so Docker can cache this layer
# separately from the app code (faster rebuilds when only code changes).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render/Fly.io inject PORT at runtime; default to 8000 for local docker run.
ENV PORT=8000
EXPOSE 8000

# Pre-download the Whisper model at build time so the first request after
# deploy doesn't have to wait ~10s+ downloading it. Set WHISPER_MODEL_SIZE
# as a build arg if you want a different default model baked in.
ARG WHISPER_MODEL_SIZE=base.en
ENV WHISPER_MODEL_SIZE=${WHISPER_MODEL_SIZE}
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL_SIZE}', device='cpu', compute_type='int8')"

# Use a shell so ${PORT} expands correctly on hosts that inject it at runtime.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
