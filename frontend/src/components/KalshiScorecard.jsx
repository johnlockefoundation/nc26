// Per-seat Kalshi scorecard: the market's pre-election price vs. the actual
// winner. Federal races only. Renders nothing when the dataset is unavailable
// (plugin build) or the district has no Kalshi market.
import { useEffect, useState } from 'react';
import { loadKalshiResults, kalshiResultFor } from '../lib/kalshiResults.js';

export default function KalshiScorecard({ districtId }) {
  const [row, setRow] = useState(null);
  const [view, setView] = useState('election'); // 'election' | 'final'
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
  // Kalshi margin on election day (points) and the final resolved market margin.
  const electionMargin = (row.pre_dem - row.pre_rep) * 100;
  const electionLabel = `${electionMargin >= 0 ? 'D' : 'R'} +${Math.abs(electionMargin).toFixed(1)}`;
  const finalLabel = row.actual === 'D' ? 'D +100.0' : 'R +100.0';
  const shown = view === 'final' ? finalLabel : electionLabel;
  return (
    <div className="dim" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
      <div>Kalshi forecast: {marketParty} {(price * 100).toFixed(1)}% &rarr; {row.actual} won{' '}
        <span className={correct ? 'val-d' : 'val-r'}>{correct ? '✓' : '✗'}</span>
      </div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <select value={view} onChange={(e) => setView(e.target.value)}
          style={{ fontSize: 10, padding: '2px 6px', minHeight: 0 }}>
          <option value="election">Kalshi margin on election day</option>
          <option value="final">Final market margin</option>
        </select>
        <span className="turnout-lead">{shown}</span>
      </div>
    </div>
  );
}