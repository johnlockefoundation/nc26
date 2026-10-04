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
// The average links to the seat's own page on the New York Times polling index,
// which is where an average of many is maintained -- the thing the figure on
// screen actually is. The CJ poll keeps its own link to its own release, because
// that one is attributable to a single outlet.
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

// Where the average can be checked: the seat's own page on the New York Times'
// polling index, which carries the toplines the average is computed from.
//
// Two URL families, not one. A House race carries its district number and no
// "-election-": north-carolina-us-house-9-polls-2026.html. A Senate race has one
// seat per state, so there is no number and the slug spells out the office:
// texas-us-senate-election-polls-2026.html. Both shapes were taken from pages
// that exist rather than inferred, because the two are not interchangeable and
// guessing wrong sends a reader to a 404.
//
// The article itself returns 403 to anything that is not a browser, so existence
// cannot be checked at build time. What stands in for it is poll_summary: the New
// Times indexes a race once it is polled, so a seat with no polls almost
// certainly has no page. Passing `hasAny` therefore keeps the link off the seats
// that would 404, which is the only existence signal available here.
export function aggregatePollUrl(race, hasAny) {
  if (!hasAny || !race) return null;
  const n = Number(race.district_number);
  const base = 'https://www.nytimes.com/interactive/polls/north-carolina';

  if (race.race_type === 'us_house') {
    return Number.isInteger(n) && n > 0
      ? `${base}-us-house-${n}-polls-2026.html`
      : null;
  }
  if (race.race_type === 'us_senate') {
    // No district segment for a statewide seat. Kept off anything else: the
    // General Assembly maps never reach this block, and a link to a
    // state-legislature race that does not exist is worse than none.
    return `${base}-us-senate-election-polls-2026.html`;
  }
  return null;
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
  const aggregateUrl = aggregatePollUrl(race, hasAverage || Boolean(cj));

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
