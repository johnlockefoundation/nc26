export default function MetricBlock({ title, emptyText, summary }) {
  const available = Boolean(summary?.available && summary?.advantage);
  return (
    <div className={`metric ${available ? '' : 'metric-empty'}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">
        {available ? summary.advantage.label : <span className="metric-na">{emptyText}</span>}
      </div>
    </div>
  );
}
