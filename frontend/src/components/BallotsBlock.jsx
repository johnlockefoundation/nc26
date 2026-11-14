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

import { useEffect, useState } from 'react';
import CollapsibleMetric from './CollapsibleMetric.jsx';

// Module-level cache so the early-vote file is fetched once per page load.
let earlyVotePromise = null;
function loadEarlyVote() {
  if (earlyVotePromise) return earlyVotePromise;
  earlyVotePromise = fetch('/early-voting/data/early-vote.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return earlyVotePromise;
}

function chamberFor(id) {
  if (!id) return null;
  if (id.startsWith('HD-')) return 'state_house';
  if (id.startsWith('SD-')) return 'state_senate';
  if (id === 'NC-SEN') return 'us_senate';
  return 'us_house';
}

function cumulativeDaily(days) {
  const out = [];
  const c = { dem: 0, rep: 0, unaff: 0, total: 0 };
  days
    .slice()
    .sort((a, b) => a.o - b.o)
    .forEach((day) => {
      c.dem += day.d;
      c.rep += day.r;
      c.unaff += day.u;
      c.total += day.d + day.r + day.u + day.x;
      out.push({ offset: day.o, dem: c.dem, rep: c.rep, unaff: c.unaff, total: c.total });
    });
  return out;
}

function BallotChart({ series }) {
  if (!series || !series.length) return null;
  const xMin = series[0].offset;
  const xMax = Math.max(series[series.length - 1].offset, 0);
  const yMax = series[series.length - 1].total || 1;
  const W = 260, H = 130, m = { l: 34, r: 6, t: 6, b: 22 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const X = (o) => m.l + ((o - xMin) / (xMax - xMin || 1)) * iw;
  const Y = (v) => m.t + ih - (v / yMax) * ih;
  const path = (key) =>
    series.map((p, i) => (i === 0 ? 'M' : 'L') + X(p.offset).toFixed(1) + ',' + Y(p[key]).toFixed(1)).join(' ');
  const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(0) + 'k' : String(n));
  const ticks = [0, Math.round(yMax / 2), yMax];
  return (
    <div className="ballot-chart">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={m.l} y1={Y(v)} x2={W - m.r} y2={Y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={m.l - 4} y={Y(v) + 3} textAnchor="end" className="ballot-chart-axis">{fmtK(v)}</text>
          </g>
        ))}
        <line x1={X(0)} y1={m.t} x2={X(0)} y2={m.t + ih} stroke="var(--muted)" strokeDasharray="3 3" />
        {['dem', 'rep', 'unaff'].map((key) => (
          <path key={key} d={path(key)} fill="none"
            stroke={key === 'dem' ? 'var(--d)' : key === 'rep' ? 'var(--r)' : 'var(--muted)'}
            strokeWidth="1.6" />
        ))}
        {[-28, -14, 0].filter((o) => o >= xMin && o <= xMax).map((o) => (
          <text key={o} x={X(o)} y={H - m.b + 12} textAnchor="middle" className="ballot-chart-axis">{o}</text>
        ))}
      </svg>
      <div className="dim" style={{ fontSize: 10, marginTop: 2 }}>Cumulative ballots by day, 2026 general (days before election)</div>
    </div>
  );
}

const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));

const PARTIES = [
  ['dem', 'DEM'],
  ['rep', 'REP'],
  ['unaff', 'UNA'],
];

export default function BallotsBlock({ summary, trackerHref, districtId }) {
  if (!summary?.available) return null;

  const [series, setSeries] = useState(null);
  useEffect(() => {
    let alive = true;
    loadEarlyVote().then((data) => {
      if (!alive || !data) return;
      const chamber = chamberFor(districtId);
      const daily = data.districtDaily?.[chamber]?.[districtId];
      if (!daily) return;
      if (alive) setSeries(cumulativeDaily(daily));
    });
    return () => { alive = false; };
  }, [districtId]);

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
      title="EARLY VOTE"
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
      <BallotChart series={series} />
    </CollapsibleMetric>
  );
}
