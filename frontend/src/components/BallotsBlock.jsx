// BALLOTS: how many ballot requests the district has recorded, and for whom,
// from the same state data the Carolina Elections tracker publishes.
//
// This replaces the link-out that used to stand here. The link was honest --
// the data lived on the other site, so sending a reader there was the most the
// panel could do -- but the figures now load into race_vitals, so the panel
// carries them and the tracker becomes what it should have been: the source
// behind the number, kept as the attribution line inside the box rather than
// the whole widget.
//
// Folded it is a caret and no figure, which is the CollapsibleMetric rule for
// boxes with no single party-advantage number: the total here is a volume, not
// an advantage, and it would not be comparable across chambers anyway -- a
// 60,000-request Senate district and a 10,000-request House district are not
// the same scale. The level comes from ballot_summary(), which reports it from
// a single snapshot. The change-since-earlier figure belongs to
// vitals_summary() and appears nowhere here: it needs two snapshots, and a
// velocity computed from one would be the invention that function exists to
// refuse.
//
// Rows show Democratic / Republican / Unaffiliated because those are the three
// columns race_vitals has. Minor-party requests exist in the source and are
// deliberately absent rather than zero -- the loader reports their count in its
// own output, and by_party keeps a missing party as null so the rows below can
// show an em dash instead of a confident 0.

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
  const asOf = summary.snapshot_date
    ? `As of ${summary.snapshot_date}`
    : null;

  return (
    <CollapsibleMetric
      title="BALLOTS"
      source={trackerHref ? 'Open this district in the Carolina Elections tracker ↗' : undefined}
      sourceHref={trackerHref || undefined}
    >
      <div className="ballot-rows">
        {PARTIES.map(([key, label]) => (
          <div key={key} className="ballot-row">
            <span className="ballot-row-party">{label}</span>
            <span className="ballot-row-count">{fmt(byParty[key])}</span>
          </div>
        ))}
        <div className="ballot-row ballot-row-total">
          <span className="ballot-row-party">TOTAL</span>
          <span className="ballot-row-count">{fmt(ballot.current_total)}</span>
        </div>
      </div>
      {asOf && <div className="ballot-foot dim">{asOf} · ballot requests</div>}
    </CollapsibleMetric>
  );
}
