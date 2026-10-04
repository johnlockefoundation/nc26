// No weekly-move arrow here on purpose. This box already states who is ahead,
// in the figure and in the figure's colour, and on a seat where the leader and
  // the mover disagree -- a Democratic seat drifting Republican -- a slanted arrow
  // beside that figure points the other way in the same two colours and reads as a
  // contradiction. The move has one home, on the map, where the whole point is
  // which way a seat is sliding.
  //
  // `link` overrides summary.source_url, which is the default. It exists because a
// metric's source is not always a field on its summary: the POLLS average is a
// computed mean of several outlets and carries no source_url of its own, but a
// reader still has somewhere to check it.
export default function MetricBlock({ title, emptyText, summary, link }) {
  const available = Boolean(summary?.available && summary?.advantage);
  const party = summary?.advantage?.party;
  const cls = available ? (party === 'D' ? 'val-d' : party === 'R' ? 'val-r' : '') : '';
  const href = available ? (link ?? summary?.source_url) : null;
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
