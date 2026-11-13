// Per-seat Kalshi scorecard: the market's pre-election price vs. the actual
// winner. Federal races only. Renders nothing when the dataset is unavailable
// (plugin build) or the district has no Kalshi market.
import { useEffect, useState } from 'react';
import { loadKalshiResults, kalshiResultFor } from '../lib/kalshiResults.js';

export default function KalshiScorecard({ districtId }) {
  const [row, setRow] = useState(null);
  useEffect(() => {
    let alive = true;
    loadKalshiResults().then((data) => {
      if (!alive) return;
      setRow(kalshiResultFor(data, districtId));
    });
    return () => { alive = false; };
  }, [districtId]);
  if (!row) return null;
  const marketParty = row.pre_dem > 0.5 ? 'D' : row.pre_dem < 0.5 ? 'R' : 'EVEN';
  const correct = marketParty === row.actual || marketParty === 'EVEN';
  const price = marketParty === 'D' ? row.pre_dem : row.pre_rep;
  return (
    <div className="dim" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
      Kalshi forecast: {marketParty} {(price * 100).toFixed(1)}% &rarr; {row.actual} won{' '}
      <span className={correct ? 'val-d' : 'val-r'}>{correct ? '✓' : '✗'}</span>
    </div>
  );
}