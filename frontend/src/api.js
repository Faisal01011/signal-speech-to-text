// Points at the FastAPI backend. Override via .env for production
// (e.g. VITE_API_URL=https://your-app.onrender.com).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Uploads a recorded audio blob to the backend and returns the
 * transcription result: { text, language, language_probability,
 * duration_seconds, processing_time_seconds, words: [...] }
 */
export async function transcribeAudio(blob, { wordTimestamps = true } = {}) {
  const formData = new FormData();
  // Filename extension matters: backend uses it to sanity-check the upload.
  formData.append("file", blob, "recording.webm");

  const params = new URLSearchParams({ word_timestamps: String(wordTimestamps) });

  const response = await fetch(`${API_URL}/transcribe?${params}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Transcription request failed (${response.status})`);
  }

  return response.json();
}

/**
 * Fetches past transcriptions, most recent first.
 * Returns { total, items: [...] }
 */
export async function fetchTranscriptions({ limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await fetch(`${API_URL}/transcriptions?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to fetch history (${response.status})`);
  }

  return response.json();
}
