# Signal — Self-Hosted Speech-to-Text

A speech-to-text web app built around a real, self-hosted transcription model — not a thin wrapper around a cloud API. Record audio in the browser, get back a transcript with word-level timestamps and confidence scores, and browse your transcription history.

**Live demo:** https://signal-speech-to-text.vercel.app
**Backend API:** https://signal-backend.onrender.com (hosted on Render's free tier — first request after idle may take a moment to spin up, and inference is slower than local due to limited CPU allocation on the free plan)

---

## Why this exists

This project was built as a more accurate, more deployable alternative to typical speech-to-text demos, most of which are thin wrappers around `SpeechRecognition` calling free cloud APIs (Google Web Speech, etc.), using `PyAudio` for microphone capture and SQLite for storage.

That pattern has two real problems:

1. **Accuracy is capped by whatever free API you're calling.** You're not actually running a transcription model — you're forwarding audio to someone else's service and hoping it's good.
2. **It doesn't deploy well.** `PyAudio` needs OS-level audio device access, which doesn't exist on a server. SQLite files don't survive redeploys on most hosting platforms.

Signal solves both:

- **Real model, not an API wrapper.** Transcription runs on [faster-whisper](https://github.com/SYSTRAN/faster-whisper), a CTranslate2-optimized reimplementation of OpenAI's Whisper. It runs entirely on CPU with int8 quantization, needs no API key, and produces meaningfully better transcripts than free web-speech APIs — especially on accents, background noise, and technical vocabulary.
- **Deploys cleanly.** The browser's `MediaRecorder` API handles audio capture client-side (no `PyAudio`, no server-side mic access needed), and Postgres (via Supabase) handles persistence instead of a local SQLite file.

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────┐
│  React frontend  │  HTTP   │   FastAPI backend     │   SQL   │  Supabase   │
│  (Vercel)        │ ──────> │   (Render, Docker)     │ ──────> │  Postgres   │
│                  │         │                        │         │             │
│  MediaRecorder   │         │  faster-whisper        │         │  transcript │
│  + live waveform │ <────── │  (CTranslate2, CPU,    │ <────── │  history    │
│  + confidence UI │  JSON   │   int8 quantized)       │         │             │
└─────────────────┘         └──────────────────────┘         └─────────────┘
```

**Backend:** FastAPI + faster-whisper, containerized with Docker, deployed on Render.
**Frontend:** React (Vite), deployed on Vercel. Records audio via the Web Audio API + `MediaRecorder`, renders a live waveform during recording, and displays transcripts with per-word confidence coloring.
**Database:** Postgres via Supabase (SQLAlchemy ORM), with automatic fallback to local SQLite for development.

## Features

- **Real-time waveform visualization** while recording, using an `AnalyserNode` off the live mic stream.
- **Word-level confidence scoring**, rendered as a color gradient under each word (not just a single accuracy number for the whole transcript) — makes it possible to see exactly which words the model was unsure about, and when.
- **Word-level timestamps**, hoverable per word.
- **Automatic language detection**, with confidence score.
- **Persistent history**, backed by Postgres, browsable in a sidebar.
- **VAD (voice activity detection) filtering**, so silence in a recording doesn't get transcribed or slow things down.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Transcription | faster-whisper (CTranslate2) | ~4x faster than vanilla Whisper on CPU, same accuracy, no API key/cost |
| Backend | FastAPI | Async, typed, fast to iterate on |
| Frontend | React + Vite | Fast dev loop, no build config overhead |
| Audio capture | Browser MediaRecorder API | No native mic dependency — works anywhere the app is hosted |
| Database | Postgres (Supabase) + SQLAlchemy | Actually persists across redeploys, unlike a local SQLite file |
| Deployment | Docker → Render (backend), Vercel (frontend) | Reproducible builds, free-tier friendly |

## Running locally

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, or leave unset to use local SQLite
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend expects the backend on `http://localhost:8000` by default (override with `VITE_API_URL`).

## API

| Endpoint | Method | Description |
|---|---|---|
| `/transcribe` | POST | Upload an audio file, get back text + word-level timestamps/confidence |
| `/transcriptions` | GET | Paginated list of past transcriptions, most recent first |
| `/transcriptions/{id}` | GET | Fetch a single transcription by ID |
| `/health` | GET | Health check |

## Deployment notes

- Backend is containerized (see `backend/Dockerfile`) and deploys to Render via `render.yaml` as a Blueprint.
- Render's **free tier** gives 512MB RAM and a fraction of a CPU core — enough to run `base.en`, but not `small.en` (which triggered OOM in testing), and inference is noticeably slower than on a full CPU. For faster response times, either upgrade to a paid Render plan or move inference to a platform with more CPU headroom per request (e.g. Google Cloud Run).
- CORS is restricted via the `ALLOWED_ORIGINS` env var to the deployed frontend's exact origin.

## Possible extensions

- Speaker diarization (who said what, via `pyannote.audio`)
- Streaming transcription (partial results while still recording, rather than waiting for the full clip)
- Export to SRT/VTT subtitle formats
