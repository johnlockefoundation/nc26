// BALLOTS: how many ballot requests the district has recorded, for whom, and the
// lead that falls out of the split -- from the same state data the Carolina
// Elections tracker publishes.
//
// This replaces the link-out that used to stand here. The link was honest --
// the data lived on the other site, so sending a reader there was the most the
// panel could do -- but the figures now load into race_vitals, so the panel
// carries them and the tracker becomes what it should have been: the source
// behind the number, kept as the attribution line inside the box rather than
// the whole widget.
//
// Folded, the box carries the leading party's margin in points: the Democratic
// share of the requests recorded so far minus the Republican share. A share of
// the whole box rather than of the two parties alone, because unaffiliated
// requests are a third of it and a two-party percentage would describe a contest
// the source does not. Points rather than a count of ballots, because the panel
// stacks a 60,000-request Senate district above a 10,000-request House one and a
// raw difference would read as the bigger lead on the bigger seat. The figure is
// the difference of the two shares printed in the rows below, so the folded
// number can be checked against the box it folds.
//
// The level comes from ballot_summary(), which reports it from a single
// snapshot. The change-since-earlier figure belongs to vitals_summary() and
// appears nowhere here: it needs two snapshots, and a velocity computed from one
// would be the invention that function exists to refuse. Neither does a
// comparison against 2024. The source carries no request date -- the election
// date is the election and Created is the ETL load -- so the 2024 table is a
// complete cycle while this one is mid-flight, and the difference between the
// two would be a calendar artefact dressed as a swing.
//
// Rows show Democratic / Republican / Unaffiliated because those are the three
// columns race_vitals has. Minor-party requests exist in the source and are
// deliberately absent rather than zero -- the loader reports their count in its
// own output, and by_party keeps a missing party as null so the rows below can
// show an em dash instead of a confident 0. That is why the total is the sum of
// these three and why the footnote has to name what the shares cover. The
// footnote itself is one fixed sentence, like PendingMetric's notice: requests
// are not votes, the parties do not return them at equal rates, and a lead in
// requests is not a projection of a result.

import CollapsibleMetric from './CollapsibleMetric.jsx';

const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));

const PARTIES = [
  ['dem', 'DEM'],
  ['rep', 'REP'],
  ['unaff', 'UNA'],
];

export default function BallotsBlock({ summary, trackerHref }) {
  if (!summary?.available) return null;

  const ballot = summary.ballot || {};
  const byParty = ballot.by_party || {};
  const advantage = ballot.advantage;
  const total = ballot.current_total;
  const asOf = summary.snapshot_date
    ? `As of ${summary.snapshot_date}`
    : null;

  // Share of the same total the folded margin divides by, so the two rows the
  // headline comes from are the ones a reader can add up.
  const share = (n) =>
    total > 0 && n != null ? `${((100 * n) / total).toFixed(1)}%` : '—';

  // Same colour coding the other metric boxes use: the folded figure carries
  // the party that is ahead. A party missing from the snapshot leaves advantage
  // null, and the box then folds to a caret rather than to a number the read
  // cannot stand behind.
  const valueCls =
    advantage?.party === 'D' ? 'val-d' : advantage?.party === 'R' ? 'val-r' : '';
  const value = advantage ? (
    <span className={`metric-value collapsible-metric-value ${valueCls}`}>
      {advantage.label}
    </span>
  ) : null;

  return (
    <CollapsibleMetric
      title="BALLOTS"
      value={value}
      source={trackerHref ? 'Open this district in the Carolina Elections tracker ↗' : undefined}
      sourceHref={trackerHref || undefined}
    >
      <div className="ballot-rows">
        {PARTIES.map(([key, label]) => (
          <div key={key} className="ballot-row">
            <span className="ballot-row-party">{label}</span>
            <span className="ballot-row-share">{share(byParty[key])}</span>
            <span className="ballot-row-count">{fmt(byParty[key])}</span>
          </div>
        ))}
        <div className="ballot-row ballot-row-total">
          <span className="ballot-row-party">TOTAL</span>
          <span className="ballot-row-share">{total > 0 ? '100%' : '—'}</span>
          <span className="ballot-row-count">{fmt(total)}</span>
        </div>
      </div>
      {asOf && <div className="ballot-foot dim">{asOf} · ballot requests so far</div>}
      <div className="ballot-note dim">
        Requests are not votes: a requested ballot may never be returned, and the
        parties do not return them at equal rates, so this lead is not a forecast.
        The shares cover Democratic, Republican and unaffiliated requests;
        minor-party requests are not counted.
      </div>
    </CollapsibleMetric>
  );
}
