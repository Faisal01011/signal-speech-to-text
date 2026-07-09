"""
FastAPI backend for the Speech-to-Text Converter.

Step 3 scope: persists every transcription to Postgres (via Supabase, or
a local SQLite file for dev) and exposes a /transcriptions endpoint to
fetch history.
"""

import os
import tempfile
from dataclasses import asdict

from fastapi import FastAPI, File, HTTPException, UploadFile, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc

from transcriber import transcriber
from db import init_db, get_db, Transcription
from auth import get_current_user_id

app = FastAPI(
    title="Speech-to-Text Converter API",
    description="Accurate, self-hosted speech-to-text powered by faster-whisper.",
    version="0.1.0",
)


@app.on_event("startup")
def on_startup():
    init_db()


# CORS: allow the React frontend to call this API. In production, set
# ALLOWED_ORIGINS to your deployed frontend URL(s), comma-separated
# (e.g. "https://signal-app.vercel.app"). Defaults to "*" for local dev.
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = (
    ["*"] if allowed_origins_env == "*" else [o.strip() for o in allowed_origins_env.split(",")]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Whisper handles these via ffmpeg under the hood; this list is just an
# upfront sanity check so bad uploads fail fast with a clear error.
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".webm", ".ogg", ".flac"}
MAX_FILE_SIZE_MB = 25


@app.get("/")
def root():
    return {"status": "ok", "service": "speech-to-text-converter"}


@app.get("/health")
def health():
    return {"status": "healthy", "model_loaded": transcriber.model is not None}


@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    word_timestamps: bool = Query(True, description="Include per-word timestamps and confidence"),
    language: str | None = Query(None, description="Force language code, e.g. 'en'. Omit to auto-detect."),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({size_mb:.1f}MB). Max is {MAX_FILE_SIZE_MB}MB.",
        )

    # Write to a temp file since faster-whisper/ffmpeg reads from disk.
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = transcriber.transcribe(
            tmp_path,
            word_timestamps=word_timestamps,
            language=language,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        os.unlink(tmp_path)

    result_dict = asdict(result)

    # Persist to DB. If this fails, we still return the transcription to the
    # user rather than losing their result over a storage hiccup.
    try:
        record = Transcription(
            user_id=user_id,
            text=result_dict["text"],
            language=result_dict["language"],
            language_probability=result_dict["language_probability"],
            duration_seconds=result_dict["duration_seconds"],
            processing_time_seconds=result_dict["processing_time_seconds"],
            words=result_dict["words"],
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        result_dict["id"] = record.id
        result_dict["created_at"] = record.created_at.isoformat()
    except Exception as e:
        print(f"[warning] failed to save transcription to DB: {e}")

    return result_dict


@app.get("/transcriptions")
def list_transcriptions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Returns the logged-in user's past transcriptions, most recent first."""
    records = (
        db.query(Transcription)
        .filter(Transcription.user_id == user_id)
        .order_by(desc(Transcription.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = db.query(Transcription).filter(Transcription.user_id == user_id).count()
    return {"total": total, "items": [r.to_dict() for r in records]}


@app.get("/transcriptions/{transcription_id}")
def get_transcription(
    transcription_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    record = (
        db.query(Transcription)
        .filter(Transcription.id == transcription_id, Transcription.user_id == user_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Transcription not found")
    return record.to_dict()
