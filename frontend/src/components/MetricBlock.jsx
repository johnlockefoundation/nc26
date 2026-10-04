import { moveArrow } from '../lib/moveArrow.js';

// `link` overrides summary.source_url, which is the default. It exists because a
// metric's source is not always a field on its summary: the POLLS average is a
// computed mean of several outlets and carries no source_url of its own, but a
// reader still has somewhere to check it.
export default function MetricBlock({ title, emptyText, summary, delta, link }) {
  const available = Boolean(summary?.available && summary?.advantage);
  const party = summary?.advantage?.party;
  const cls = available ? (party === 'D' ? 'val-d' : party === 'R' ? 'val-r' : '') : '';
  const href = available ? (link ?? summary?.source_url) : null;
  const move = moveArrow(delta);
  const arrow = available && move
    ? (
      <span className={`metric-arrow ${move.cls}`} title={move.text}>
        <span className="arrow-glyph">{move.glyph}</span>
        <span className="arrow-tag">{move.tag}</span>
      </span>
    )
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
