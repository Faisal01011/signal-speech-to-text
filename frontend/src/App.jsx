import { useState, useEffect, useCallback } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Recorder from "./components/Recorder.jsx";
import TranscriptView from "./components/TranscriptView.jsx";
import History from "./components/History.jsx";
import { transcribeAudio, fetchTranscriptions } from "./api.js";

export default function App() {
  const [status, setStatus] = useState("idle"); // idle | transcribing | done | error
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

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
    loadHistory();
  }, [loadHistory]);

  const handleRecordingComplete = async (blob) => {
    setStatus("transcribing");
    setErrorMessage("");
    try {
      const data = await transcribeAudio(blob);
      setResult(data);
      setStatus("done");
      loadHistory(); // refresh the list so the new one shows up
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

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__eyebrow">FASTER-WHISPER · SELF-HOSTED</span>
        <h1 className="app__title">Signal</h1>
        <p className="app__subtitle">Record. Transcribe. See exactly how confident it is.</p>
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
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
