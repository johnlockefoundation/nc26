export default function MetricBlock({ title, emptyText, summary }) {
  const available = Boolean(summary?.available && summary?.advantage);
  const party = summary?.advantage?.party;
  const cls = available ? (party === 'D' ? 'val-d' : party === 'R' ? 'val-r' : '') : '';
  return (
    <div className={`metric ${available ? '' : 'metric-empty'}`}>
      <div className="metric-title">{title}</div>
      <div className={`metric-value ${cls}`}>
        {available ? summary.advantage.label : <span className="metric-na">{emptyText}</span>}
      </div>
    </div>
  );
}
