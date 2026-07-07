/**
 * Renders the transcript with each word underlined on a teal->amber
 * gradient scaled to its confidence score, so low-confidence words
 * are visibly flagged rather than buried in a raw JSON blob.
 */
export default function TranscriptView({ result }) {
  if (!result) return null;

  const { text, language, language_probability, duration_seconds, processing_time_seconds, words } = result;

  // Interpolates between teal (#4FB0A5, low confidence) and amber (#E8A33D, high confidence)... 
  // actually: teal = confident/good, red-ish amber = uncertain. We use teal for high, amber for low.
  const confidenceColor = (confidence) => {
    // confidence in [0,1]. High -> teal, low -> amber/red.
    const clamped = Math.max(0, Math.min(1, confidence));
    const r = Math.round(217 + (79 - 217) * clamped);
    const g = Math.round(83 + (176 - 83) * clamped);
    const b = Math.round(79 + (165 - 79) * clamped);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="transcript">
      <div className="transcript__meta">
        <span className="transcript__meta-item">
          <span className="transcript__meta-label">LANG</span> {language?.toUpperCase()} ({Math.round(language_probability * 100)}%)
        </span>
        <span className="transcript__meta-item">
          <span className="transcript__meta-label">AUDIO</span> {duration_seconds}s
        </span>
        <span className="transcript__meta-item">
          <span className="transcript__meta-label">PROCESSED IN</span> {processing_time_seconds}s
        </span>
      </div>

      <p className="transcript__text">
        {words && words.length > 0
          ? words.map((w, i) => (
              <span
                key={i}
                className="transcript__word"
                style={{ borderBottomColor: confidenceColor(w.confidence) }}
                title={`${Math.round(w.confidence * 100)}% confidence · ${w.start}s–${w.end}s`}
              >
                {w.word}{" "}
              </span>
            ))
          : text}
      </p>

      <div className="transcript__legend">
        <span className="transcript__legend-swatch" style={{ backgroundColor: confidenceColor(1) }} />
        High confidence
        <span className="transcript__legend-swatch" style={{ backgroundColor: confidenceColor(0) }} />
        Low confidence
      </div>
    </div>
  );
}
