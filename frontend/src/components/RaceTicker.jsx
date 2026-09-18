function renderGroup(items, copy) {
  return (
    <div key={copy} className="ticker-group" aria-hidden={copy === 1}>
      {items.map((h) => (
        <a
          key={`${copy}-${h.article_id}`}
          className="ticker-chip"
          href={h.url || '#'}
          target="_blank"
          rel="noreferrer"
          title={`${h.outlet} · ${h.published_at || ''}`}
        >
          <span className="ticker-headline">{h.headline}</span>
          <span className="ticker-dot">·</span>
          <span className="ticker-outlet">{h.outlet}</span>
        </a>
      ))}
    </div>
  );
}

export default function RaceTicker({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="ticker" role="marquee" aria-label="Recent North Carolina election headlines">
      <span className="ticker-label">NC NEWS</span>
      <div className="ticker-track">
        <div className="ticker-run">
          {renderGroup(items, 0)}
          {renderGroup(items, 1)}
        </div>
      </div>
    </div>
  );
}