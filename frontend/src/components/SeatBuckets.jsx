import { useMemo } from 'react';
import { GA_MARGIN, signedCpi } from '../lib/vulnerability.js';

// A General Assembly chamber in three parts: safe Democratic, competitive, safe
// Republican. One seat, one dot, so the chamber is countable at a glance -- the
// dots are grouped into three filled rectangles rather than arranged along an
// arc, because the grouping is the fact and the shape was never.
//
// The cut is the Civitas partisan index against an even statewide environment:
// a seat more than GA_MARGIN points to one party is safe for it, and a seat
// inside that band is competitive. This is index arithmetic, not a forecast --
// "competitive" means "within four points of even on the index", the same
// meaning the phrase carries elsewhere on the site.
//
// A seat with no Civitas index is left out of all three groups rather than
// guessed into one; the chamber total and the three counts not adding up is the
// honest reading of that seat, not a bug.
const SAFE_D_FILL = '#2563eb';
const COMPETITIVE_FILL = '#b45309';
const SAFE_R_FILL = '#dc2626';

// One bucket, drawn as a rectangle of dots: the seats are placed in a
// near-square grid and the trailing cells are left empty, so every group reads
// as a solid block rather than a ragged run. The grid's column count is fixed in
// the inline style so the rows cannot reflow; empty cells hold their place.
function SeatRect({ count, fill }) {
  const n = Math.max(count, 1);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cells = rows * cols;
  return (
    <span
      className="bucket-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, var(--dot-size))` }}
      aria-hidden="true"
    >
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className="bucket-dot"
          style={i < count ? { background: fill } : undefined}
        />
      ))}
    </span>
  );
}

export default function SeatBuckets({ races }) {
  const buckets = useMemo(() => {
    const list = races || [];
    let safeD = 0;
    let competitive = 0;
    let safeR = 0;
    let unrated = 0;
    for (const race of list) {
      const cpi = signedCpi(race?.partisan);
      if (cpi == null) { unrated++; continue; }
      if (cpi < -GA_MARGIN) safeD++;
      else if (cpi > GA_MARGIN) safeR++;
      else competitive++;
    }
    return { safeD, competitive, safeR, unrated, total: list.length };
  }, [races]);

  const groups = [
    { key: 'safeD', label: 'SAFE DEMOCRAT', count: buckets.safeD, fill: SAFE_D_FILL },
    { key: 'competitive', label: 'COMPETITIVE', count: buckets.competitive, fill: COMPETITIVE_FILL },
    { key: 'safeR', label: 'SAFE REPUBLICAN', count: buckets.safeR, fill: SAFE_R_FILL },
  ];

  const pct = (n) => (buckets.total ? Math.round((n / buckets.total) * 100) : 0);

  return (
    <div className="buckets">
      <div className="buckets-groups">
        {groups.map((g) => (
          <div className="bucket" key={g.key}>
            <div className="bucket-head">
              <span className="bucket-dot-sample" style={{ background: g.fill }} />
              <span className="bucket-label">{g.label}</span>
              <span className="bucket-count">{g.count}</span>
              <span className="bucket-pct">{pct(g.count)}%</span>
            </div>
            <SeatRect count={g.count} fill={g.fill} />
          </div>
        ))}
      </div>
      {buckets.unrated > 0 && (
        <p className="buckets-note">
          {buckets.unrated} {buckets.unrated === 1 ? 'seat carries' : 'seats carry'} no
          Civitas index and {buckets.unrated === 1 ? 'is' : 'are'} not counted above.
        </p>
      )}
    </div>
  );
}
