export default function MetricBlock({ title, emptyText, summary }) {
  const available = Boolean(summary?.available && summary?.advantage);
  const party = summary?.advantage?.party;
  const cls = available ? (party === 'D' ? 'val-d' : party === 'R' ? 'val-r' : '') : '';
  const href = available ? summary?.source_url : null;
  return (
    <div className={`metric ${available ? '' : 'metric-empty'}`}>
      <div className="metric-title">
        {href ? (
          <a className="metric-title-link" href={href} target="_blank" rel="noreferrer" title={`Open source: ${title}`}>{title} ↗</a>
        ) : title}
      </div>
      <div className={`metric-value ${cls}`}>
        {available ? summary.advantage.label : <span className="metric-na">{emptyText}</span>}
      </div>
    </div>
  );
}
