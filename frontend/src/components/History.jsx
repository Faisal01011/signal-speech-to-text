/**
 * Shows past transcriptions as a clickable list — most recent first.
 * Selecting one hands its full record back to the parent to display
 * in the same TranscriptView used for fresh recordings.
 */
export default function History({ items, selectedId, onSelect, loading }) {
  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const snippet = (text, max = 60) => {
    if (!text) return "(empty)";
    return text.length > max ? text.slice(0, max).trim() + "…" : text;
  };

  if (loading) {
    return <p className="history__empty">Loading history…</p>;
  }

  if (!items || items.length === 0) {
    return <p className="history__empty">No transcripts yet — record something above.</p>;
  }

  return (
    <ul className="history">
      {items.map((item) => (
        <li key={item.id}>
          <button
            className={`history__item ${item.id === selectedId ? "history__item--active" : ""}`}
            onClick={() => onSelect(item)}
          >
            <span className="history__item-text">{snippet(item.text)}</span>
            <span className="history__item-meta">
              {formatDate(item.created_at)} · {item.duration_seconds}s
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
