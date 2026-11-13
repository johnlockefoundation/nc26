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
    <div className="ballot-foot dim" style={{ marginTop: 6 }}>
      <div>Kalshi forecast: {marketParty} {(price * 100).toFixed(1)}% &rarr; {row.actual} won{' '}
        <span className={correct ? 'val-d' : 'val-r'}>{correct ? '✓' : '✗'}</span>
      </div>
      <div className="ballot-row" style={{ marginTop: 4, borderTop: 'none', paddingTop: 2 }}>
        <span className="ballot-row-party">
          <select value={view} onChange={(e) => setView(e.target.value)}
            style={{ fontSize: 9.5, padding: '1px 4px', minHeight: 0, letterSpacing: '0.12em' }}>
            <option value="election">KALSHI MARGIN, ELECTION DAY</option>
            <option value="final">FINAL MARKET MARGIN</option>
          </select>
        </span>
        <span className="ballot-row-share" />
        <span className="ballot-row-count">{shown}</span>
      </div>
    </div>
  );
}