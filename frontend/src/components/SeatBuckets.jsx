import { useMemo } from 'react';
import { GA_MARGIN, signedCpi } from '../lib/vulnerability.js';

// A General Assembly chamber in three parts: safe Democratic, competitive, safe
// Republican. One rectangle each, sized by how many seats fall in it, so the
// shape of the chamber is legible before any number is read.
//
// The cut is the Civitas partisan index against an even statewide environment:
// a seat more than GA_MARGIN points to one party is safe for it, and a seat
// inside that band is competitive. This is index arithmetic, not a forecast --
// "competitive" means "within four points of even on the index", the same
// meaning the phrase carries elsewhere on the site.
//
// A seat with no Civitas index is left out of all three buckets rather than
// guessed into one; the chamber total and the three counts not adding up is the
// honest reading of that seat, not a bug.
const SAFE_D_FILL = '#2563eb';
const COMPETITIVE_FILL = '#b45309';
const SAFE_R_FILL = '#dc2626';

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

  const segs = [
    { key: 'safeD', label: 'SAFE DEMOCRAT', count: buckets.safeD, fill: SAFE_D_FILL },
    { key: 'competitive', label: 'COMPETITIVE', count: buckets.competitive, fill: COMPETITIVE_FILL },
    { key: 'safeR', label: 'SAFE REPUBLICAN', count: buckets.safeR, fill: SAFE_R_FILL },
  ];

  const pct = (n) => (buckets.total ? Math.round((n / buckets.total) * 100) : 0);

  return (
    <div className="buckets">
      <div className="buckets-bar" aria-hidden="true">
        {segs.map((s) => (
          <div
            key={s.key}
            className="buckets-seg"
            style={{ background: s.fill, flexGrow: s.count }}
          />
        ))}
      </div>
      <ul className="buckets-legend">
        {segs.map((s) => (
          <li key={s.key}>
            <span className="buckets-dot" style={{ background: s.fill }} />
            <span className="buckets-label">{s.label}</span>
            <strong className="buckets-count">{s.count}</strong>
            <span className="buckets-pct">{pct(s.count)}%</span>
          </li>
        ))}
      </ul>
      {buckets.unrated > 0 && (
        <p className="buckets-note">
          {buckets.unrated} {buckets.unrated === 1 ? 'seat carries' : 'seats carry'} no
          Civitas index and {buckets.unrated === 1 ? 'is' : 'are'} not counted above.
        </p>
      )}
    </div>
  );
}
