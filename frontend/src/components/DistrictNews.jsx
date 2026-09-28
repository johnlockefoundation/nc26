function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Stories tagged to this exact seat. Strictly per-district: a district never
// borrows statewide coverage, and an untagged story never appears at all.
export default function DistrictNews({ articles }) {
  const items = (articles || []).filter((a) => a.url);

  return (
    <section className="panel-section">
      <h3>IN THIS RACE</h3>
      {items.length === 0 ? (
        <div className="dim">No race-specific coverage for this district yet.</div>
      ) : (
        <ul className="race-news">
          {items.map((a) => (
            <li key={a.article_id} className="race-news-item">
              <a href={a.url} target="_blank" rel="noreferrer" className="race-news-link">
                {a.headline}
              </a>
              <div className="race-news-meta">
                <span className="race-news-outlet">{a.outlet}</span>
                {a.published_at ? <span> · {fmtDate(a.published_at)}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
