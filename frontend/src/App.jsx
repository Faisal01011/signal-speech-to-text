import { useState, useEffect, useCallback } from "react";
import Recorder from "./components/Recorder.jsx";
import TranscriptView from "./components/TranscriptView.jsx";
import History from "./components/History.jsx";
import Auth from "./components/Auth.jsx";
import { transcribeAudio, fetchTranscriptions } from "./api.js";
import { supabase } from "./supabaseClient.js";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out

  const [status, setStatus] = useState("idle"); // idle | transcribing | done | error
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Track auth state — Supabase fires this on login, logout, and token refresh.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchTranscriptions({ limit: 20 });
      setHistoryItems(data.items);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) loadHistory();
  }, [session, loadHistory]);

  const handleRecordingComplete = async (blob) => {
    setStatus("transcribing");
    setErrorMessage("");
    try {
      const data = await transcribeAudio(blob);
      setResult(data);
      setStatus("done");
      loadHistory();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "Something went wrong transcribing that clip.");
      setStatus("error");
    }
  };

  const handleSelectHistoryItem = (item) => {
    setResult(item);
    setStatus("done");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setResult(null);
    setStatus("idle");
    setHistoryItems([]);
  };

  // Still checking for an existing session on load — avoid flashing the login screen.
  if (session === undefined) {
    return <div className="app__status">Loading…</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-row">
          <div>
            <span className="app__eyebrow">FASTER-WHISPER · SELF-HOSTED</span>
            <h1 className="app__title">Signal</h1>
            <p className="app__subtitle">Record. Transcribe. See exactly how confident it is.</p>
          </div>
          <div className="app__account">
            <span className="app__account-email">{session.user.email}</span>
            <button className="app__signout" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="app__layout">
        <main className="app__main">
          <Recorder onRecordingComplete={handleRecordingComplete} disabled={status === "transcribing"} />

          {status === "transcribing" && (
            <p className="app__status">Transcribing your audio…</p>
          )}

          {status === "error" && (
            <p className="app__status app__status--error">{errorMessage}</p>
          )}

          {status === "done" && result && <TranscriptView result={result} />}
        </main>

        <aside className="app__sidebar">
          <h2 className="app__sidebar-title">History</h2>
          <History
            items={historyItems}
            selectedId={result?.id}
            onSelect={handleSelectHistoryItem}
            loading={historyLoading}
          />
        </aside>
      </div>
    </div>
  );
}
