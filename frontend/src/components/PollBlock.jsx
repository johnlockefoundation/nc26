// Polling, as one elongated box with a figure for the average and, when we hold
// one, a second figure for the latest Carolina Journal poll.
//
// Elongated and never folded, unlike the single-figure metric boxes above it.
// An average is a claim about a race over a stretch of time, and a reader who
// has to click to see how many polls it is made of and when they were fielded
// cannot tell a fresh average from a two-year-old one. The same reasoning
// DistrictNews uses: this is the block where the panel would otherwise look
// complete while hiding the part that has to be dated to be believed.
//
// The average comes first and carries no link, because it is a cross-pollster
// mean and belongs to no single outlet. The CJ poll sits under it with a link to
// the release it came from, because that one is attributable and a reader can
// check it against the topline. Neither figure stands in for the other: the
// average says where the race sits, the CJ poll says what one newsroom measured.
//
// Renders nothing when the seat has no polling. A permanently open box reading
// NO POLLING on the 180-odd seats that have never been polled would be a
// statement about the pipeline, not about the race, and would push the blocks
// that do carry a number down the panel.

function fmtMonthDay(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isMonthDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

// "Sep 13-15" when a poll ran inside one month, "Jul 23 - Sep 15" when it
// crossed a month boundary. Both an average and a single poll have two ends, and
// collapsing them to one date would misdescribe both.
function fmtFieldWindow(from, to) {
  if (!from && !to) return '';
  if (!from || !to || from === to) return fmtMonthDay(from || to);
  if (!isMonthDay(from) || !isMonthDay(to)) return `${fmtMonthDay(from)} - ${fmtMonthDay(to)}`;
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    // Same month, so the month and year are already on the first date and only
    // the second day's number is new information.
    return `${fmtMonthDay(from)}-${b.getDate()}`;
  }
  return `${fmtMonthDay(from)} - ${fmtMonthDay(to)}`;
}

function fmtShares(dem, rep) {
  if (dem == null || rep == null) return '';
  return `D ${Number(dem).toFixed(1)} · R ${Number(rep).toFixed(1)}`;
}

const POPULATION_LABELS = { LV: 'likely voters', RV: 'registered voters', A: 'adults' };

// One figure: its label on the left, the advantage on the right, and the
// provenance underneath. The label is the only part that ever links, and only
// when the figure is attributable to a single release.
function PollFigure({ label, figure, link, meta }) {
  const party = figure.advantage?.party;
  const cls = party === 'D' ? 'val-d' : party === 'R' ? 'val-r' : '';
  return (
    <div className="poll-row">
      <div className="poll-row-head">
        <span className="poll-row-label">
          {link ? (
            <a className="poll-row-link" href={link} target="_blank" rel="noreferrer" title={`Open source: ${label}`}>
              {label} ↗
            </a>
          ) : label}
        </span>
        <span className={`metric-value ${cls}`}>{figure.advantage?.label}</span>
      </div>
      <div className="poll-row-meta">
        {fmtShares(figure.dem_share, figure.rep_share)}
        {meta ? <span className="poll-row-sep"> · </span> : null}
        {meta}
      </div>
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

  // The house that fielded the questions, for the CJ row's meta line. The
  // pollster string names both the publisher and the fieldwork in one field
  // ("Carolina Journal / Harper Polling"), and the label already says Carolina
  // Journal -- the second half is the part worth repeating, because it is the
  // fieldwork the number actually came from.
  const fieldedBy = (() => {
    if (!cj?.pollster) return null;
    const parts = String(cj.pollster).split('/');
    return (parts.length > 1 ? parts.slice(1).join('/') : parts[0]).trim() || null;
  })();

  return (
    <div className="metric metric-poll">
      <div className="metric-title">POLLING</div>
      <div className="poll-rows">
        {hasAverage ? (
          <PollFigure
            label="AVERAGE"
            figure={summary}
            meta={[summary.n_polls === 1 ? '1 poll' : `${summary.n_polls} polls`, fmtFieldWindow(summary.span_start, summary.span_end)]
              .filter(Boolean).join(' · ')}
          />
        ) : null}
        {cj ? (
          <PollFigure
            label="CAROLINA JOURNAL"
            figure={cj}
            link={cj.source_url}
            meta={[
              fieldedBy,
              fmtFieldWindow(cj.start_date, cj.end_date),
              cj.sample_size ? `n=${cj.sample_size}` : null,
              cj.population ? POPULATION_LABELS[cj.population] || cj.population : null,
            ].filter(Boolean).join(' · ')}
          />
        ) : null}
      </div>
    </div>
  );
}
