// Polling, in one of two shapes.
//
// With a Carolina Journal poll to show, an elongated box holding both figures:
// the average and the CJ topline usually disagree, and the disagreement is the
// point, because a reader who saw only the CJ number would read one house's
// measurement as the state of the race. They belong in one box so they are read
// as a pair, and so the second is unmistakably the second -- two separate metric
// blocks would let the eye take either as the answer. Never folded, for the same
// reason DistrictNews is not.
//
// Without one, the single POLLS metric row the panel has always shown. There is
// only one figure, so there is nothing to pair it with and no reason to spend a
// titled box on it: MetricBlock already renders exactly that, and reusing it
// means this case is the original row rather than a copy of it that can drift.
// The seat looks the way it did before the pair existed.
//
// Either way the average carries no link, because it belongs to no single
// outlet. The CJ poll is linked, because it is attributable and a reader can
// check it against the topline.
//
// Renders nothing when the seat has no polling at all. A permanently open box
// reading NO POLLING on the 180-odd seats that have never been polled would be a
// statement about the pipeline, not about the race, and would push the blocks
// that do carry a number down the panel.
//
// Figures only. The payload carries the poll count, the field window, the
// toplines and the sample size, and none of it is rendered: a second line of
// small print under every figure turned the stack into a table and buried the
// one number a reader came for. The provenance is still on the wire, so putting
// any of it back is a matter of adding a row rather than re-deriving it.
import MetricBlock from './MetricBlock.jsx';

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
  if (!hasAverage && !cj) return null;

  // No CJ poll, so the average is the whole of what we know and the panel gets
  // the single POLLS row it has always shown. Reached only when hasAverage is
  // true, so MetricBlock always has an advantage to render and never falls
  // through to its own NO POLLING text -- the absent case returned above.
  if (!cj) return <MetricBlock title="POLLS" summary={summary} />;

  return (
    <div className="metric metric-poll">
      <div className="metric-title">POLLING</div>
      <div className="poll-rows">
        {hasAverage ? <PollFigure label="AVERAGE" figure={summary} /> : null}
        <PollFigure label="CAROLINA JOURNAL" figure={cj} link={cj.source_url} />
      </div>
    </div>
  );
}
