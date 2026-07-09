"""
Wrapper around faster-whisper for speech-to-text transcription.

Loads the model once at import time (module-level singleton) so it's
reused across requests instead of being reloaded on every call.
"""

import os
import time
from dataclasses import dataclass, field
from typing import List, Optional

from faster_whisper import WhisperModel

# ---- Configuration ----------------------------------------------------
# Model size options: tiny, tiny.en, base, base.en, small, small.en,
# medium, medium.en, large-v2, large-v3
# ".en" variants are English-only and slightly faster/more accurate for
# English audio specifically.
MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small.en")

# "cpu" for free-tier hosting, "cuda" if you have GPU access (e.g. Modal)
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")

# int8 quantization keeps CPU inference fast and memory-light with
# minimal accuracy loss. Use "float16" if running on GPU.
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")


@dataclass
class WordTiming:
    word: str
    start: float
    end: float
    confidence: float


@dataclass
class TranscriptionResult:
    text: str
    language: str
    language_probability: float
    duration_seconds: float
    processing_time_seconds: float
    words: List[WordTiming] = field(default_factory=list)


class Transcriber:
    """Loads a faster-whisper model once and exposes a transcribe() method."""

    def __init__(self, model_size: str = MODEL_SIZE, device: str = DEVICE,
                 compute_type: str = COMPUTE_TYPE):
        print(f"[transcriber] loading faster-whisper model '{model_size}' "
              f"on {device} ({compute_type}) ...")
        load_start = time.time()
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        print(f"[transcriber] model loaded in {time.time() - load_start:.2f}s")

    def transcribe(self, audio_path: str, word_timestamps: bool = True,
                   language: Optional[str] = None) -> TranscriptionResult:
        """
        Transcribe an audio file on disk.

        audio_path: path to a wav/mp3/webm/etc file (ffmpeg handles decoding
                    under the hood, so browser-recorded webm/ogg works fine).
        word_timestamps: if True, returns per-word start/end/confidence.
        language: force a language code (e.g. "en"); None = auto-detect.
        """
        start_time = time.time()

        segments, info = self.model.transcribe(
            audio_path,
            word_timestamps=word_timestamps,
            language=language,
            vad_filter=True,  # skips silence, improves accuracy on long/noisy clips
            beam_size=3,  # lower than the default (5) for faster inference; still solid accuracy
        )

        full_text_parts = []
        words: List[WordTiming] = []

        for segment in segments:
            full_text_parts.append(segment.text.strip())
            if word_timestamps and segment.words:
                for w in segment.words:
                    words.append(WordTiming(
                        word=w.word.strip(),
                        start=round(w.start, 3),
                        end=round(w.end, 3),
                        confidence=round(w.probability, 4),
                    ))

        processing_time = time.time() - start_time

        return TranscriptionResult(
            text=" ".join(full_text_parts).strip(),
            language=info.language,
            language_probability=round(info.language_probability, 4),
            duration_seconds=round(info.duration, 3),
            processing_time_seconds=round(processing_time, 3),
            words=words,
        )


# Module-level singleton — imported and reused by main.py
transcriber = Transcriber()
