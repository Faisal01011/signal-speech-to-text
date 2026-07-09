import { supabase } from "./supabaseClient.js";

// Points at the FastAPI backend. Override via .env for production
// (e.g. VITE_API_URL=https://your-app.onrender.com).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Fetches the current session's access token, to send as a Bearer token
 * on requests to protected backend endpoints.
 */
async function getAuthHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not logged in");
  return { Authorization: `Bearer ${token}` };
}

/**
 * Uploads a recorded audio blob to the backend and returns the
 * transcription result: { text, language, language_probability,
 * duration_seconds, processing_time_seconds, words: [...] }
 */
export async function transcribeAudio(blob, { wordTimestamps = true } = {}) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  const params = new URLSearchParams({ word_timestamps: String(wordTimestamps) });
  const authHeader = await getAuthHeader();

  const response = await fetch(`${API_URL}/transcribe?${params}`, {
    method: "POST",
    headers: authHeader,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Transcription request failed (${response.status})`);
  }

  return response.json();
}

/**
 * Fetches past transcriptions for the logged-in user, most recent first.
 * Returns { total, items: [...] }
 */
export async function fetchTranscriptions({ limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const authHeader = await getAuthHeader();

  const response = await fetch(`${API_URL}/transcriptions?${params}`, {
    headers: authHeader,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to fetch history (${response.status})`);
  }

  return response.json();
}
