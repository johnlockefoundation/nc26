// Polling, as one elongated box with a figure for the average and, when we hold
// one, a second figure for the latest Carolina Journal poll.
//
// Two figures, not one, and never folded. The average is a cross-pollster mean
// and the CJ poll is one newsroom's topline: they usually disagree, and the
// disagreement is the point, because a reader who saw only the CJ number would
// read one house's measurement as the state of the race. They belong in one box
// so they are read as a pair, and so the second is unmistakably the second --
// two separate metric blocks would let the eye take either as the answer.
//
// The average comes first and carries no link, because it belongs to no single
// outlet. The CJ poll is linked, because it is attributable and a reader can
// check it against the topline. Neither stands in for the other.
//
// Renders nothing when the seat has no polling. A permanently open box reading
// NO POLLING on the 180-odd seats that have never been polled would be a
// statement about the pipeline, not about the race, and would push the blocks
// that do carry a number down the panel.
//
// Figures only. The payload carries the poll count, the field window, the
// toplines and the sample size, and none of it is rendered: a second line of
// small print under every figure turned the stack into a table and buried the
// one number a reader came for. The provenance is still on the wire, so putting
// any of it back is a matter of adding a row rather than re-deriving it.
function PollFigure({ label, figure, link }) {
  const party = figure.advantage?.party;
  const cls = party === 'D' ? 'val-d' : party === 'R' ? 'val-r' : '';
  return (
    <div className="poll-row">
      <span className="poll-row-label">
        {link ? (
          <a className="poll-row-link" href={link} target="_blank" rel="noreferrer" title={`Open source: ${label}`}>
            {label} ↗
          </a>
        ) : label}
      </span>
      <span className={`metric-value ${cls}`}>{figure.advantage?.label}</span>
    </div>
  );
}

export default function PollBlock({ polls }) {
  const summary = polls || {};
  const cj = summary.cj_poll || null;
  const hasAverage = Boolean(summary.available && summary.advantage);
  // Either figure is enough to justify the box. A CJ poll with no average on
  // record is still the only polling we hold for the seat, so it is shown alone
  // rather than discarded.
  if (!hasAverage && !cj) return null;

  return (
    <div className="metric metric-poll">
      <div className="metric-title">POLLING</div>
      <div className="poll-rows">
        {hasAverage ? <PollFigure label="AVERAGE" figure={summary} /> : null}
        {cj ? <PollFigure label="CAROLINA JOURNAL" figure={cj} link={cj.source_url} /> : null}
      </div>
    </div>
  );
}
