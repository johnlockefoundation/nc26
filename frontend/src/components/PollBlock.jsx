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
// The average is linked to the seat's RealClearPolitics page. That is an
// aggregator rather than a pollster, so it is not where any one topline was
// published -- it is where an average of many is maintained, which is the thing
// the figure on screen actually is. The CJ poll keeps its own link to its own
// release, because that one is attributable to a single outlet.
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

// Where the average can be checked.
//
// RealClearPolitics was the previous target and is gone. RCP has no free API and
// no usable licence for redistribution; PollResults.org does, and it is the
// replacement -- CC BY 4.0, sourced from the New York Times polling summary.
//
// The link points at the NYT summary itself rather than at PollResults.org. The
// average on screen is computed from toplines JLF verified, so the thing a reader
// wants is a neutral published aggregate they can compare it against, and the NYT
// page is that. PollResults.org is the machine-readable route to the same data.
//
// One summary URL for every seat, not a per-race deep link. The NYT 403s every
// request from this machine, so a race-specific URL pattern could not be verified
// the way the RCP one could not be either -- and an unverified deep link that 404s
// in front of a reader is worse than an honest link to the index. If someone
// confirms the per-race pattern, this is the one function to change.
//
// Federal only, which is all this widget renders -- RacePanel gates polls to
// congressional seats.
export const AGGREGATE_POLL_URL =
  'https://www.nytimes.com/interactive/polls/latest-polls.html';

export function aggregatePollUrl() {
  return AGGREGATE_POLL_URL;
}

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

export default function PollBlock({ polls, race }) {
  const summary = polls || {};
  const cj = summary.cj_poll || null;
  const hasAverage = Boolean(summary.available && summary.advantage);
  if (!hasAverage && !cj) return null;
  const aggregateUrl = aggregatePollUrl();

  // No CJ poll, so the average is the whole of what we know and the panel gets
  // the single POLLS row it has always shown. The hasAverage guard above means
  // summary.advantage is non-null here, so MetricBlock renders the figure
  // rather than its emptyText; the absent case returned above.
  if (!cj) return <MetricBlock title="POLLS" summary={summary} link={aggregateUrl} />;

  return (
    <div className="metric metric-poll">
      <div className="metric-title">POLLING</div>
      <div className="poll-rows">
        {hasAverage ? <PollFigure label="AVERAGE" figure={summary} link={aggregateUrl} /> : null}
        <PollFigure label="CAROLINA JOURNAL" figure={cj} link={cj.source_url} />
      </div>
    </div>
  );
}
