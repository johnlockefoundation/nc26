export default function MetricBlock({ title, emptyText, summary, metaLines = [], children, onOpen, open, openLabel }) {
  const available = Boolean(summary?.available && summary?.advantage);
  return (
    <div className={`metric ${available ? '' : 'metric-empty'}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">
        {available ? summary.advantage.label : <span className="metric-na">{emptyText}</span>}
      </div>
      {available && metaLines.length > 0 && (
        <div className="metric-meta">
          {metaLines.map((line, i) => <div key={i} className="metric-meta-line">{line}</div>)}
        </div>
      )}
      {!available && (
        <div className="metric-meta">
          <div className="metric-meta-line dim">No substitute displayed.</div>
        </div>
      )}
      {onOpen && available && (
        <button className="metric-toggle" onClick={onOpen}>
          {open ? 'Hide detail' : openLabel}
        </button>
      )}
      {open && children}
    </div>
  );
}