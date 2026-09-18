export default function MetricBlock({ title, emptyText, summary, delta }) {
  const available = Boolean(summary?.available && summary?.advantage);
  const party = summary?.advantage?.party;
  const cls = available ? (party === 'D' ? 'val-d' : party === 'R' ? 'val-r' : '') : '';
  const href = available ? summary?.source_url : null;
  const arrow = available && delta && delta.party !== 'EVEN'
    ? (delta.party === 'D'
        ? <span className="metric-arrow move-d" title={`${delta.points.toFixed(1)} pts toward D since last update`}>←</span>
        : <span className="metric-arrow move-r" title={`${delta.points.toFixed(1)} pts toward R since last update`}>→</span>)
    : null;
  return (
    <div className={`metric ${available ? '' : 'metric-empty'}`}>
      <div className="metric-title">
        {href ? (
          <a className="metric-title-link" href={href} target="_blank" rel="noreferrer" title={`Open source: ${title}`}>{title} ↗</a>
        ) : title}
      </div>
      <div className={`metric-value ${cls}`}>
        {available ? summary.advantage.label : <span className="metric-na">{emptyText}</span>}
        {arrow}
      </div>
    </div>
  );
}
