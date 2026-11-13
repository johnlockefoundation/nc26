// Per-seat poll scorecard: the polling average vs. the actual winner, plus a
// dropdown comparing the poll margin with the Kalshi market margin. Federal
// races with polling only. Renders nothing when data is unavailable.
import { useEffect, useState } from 'react';
import { loadKalshiResults, kalshiResultFor } from '../lib/kalshiResults.js';

let pollsPromise = null;
function loadPollsResults() {
  if (pollsPromise) return pollsPromise;
  pollsPromise = fetch('/polls-results.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return pollsPromise;
}

export default function PollsScorecard({ districtId }) {
  const [row, setRow] = useState(null);
  const [kalshi, setKalshi] = useState(null);
  const [view, setView] = useState('poll'); // 'poll' | 'kalshi'
  useEffect(() => {
    let alive = true;
    Promise.all([loadPollsResults(), loadKalshiResults()]).then(([p, k]) => {
      if (!alive) return;
      setRow(p && p.races ? p.races[districtId] : null);
      setKalshi(k ? kalshiResultFor(k, districtId) : null);
    });
    return () => { alive = false; };
  }, [districtId]);
  if (!row) return null;
  const marketParty = row.poll_dem > row.poll_rep ? 'D' : row.poll_dem < row.poll_rep ? 'R' : 'EVEN';
  const correct = marketParty === row.actual || marketParty === 'EVEN';
  const price = marketParty === 'D' ? row.poll_dem : row.poll_rep;
  const pollMargin = `${row.poll_margin >= 0 ? 'D' : 'R'} +${Math.abs(row.poll_margin).toFixed(1)}`;
  const kalshiMargin = kalshi
    ? `${kalshi.pre_dem > kalshi.pre_rep ? 'D' : 'R'} +${(Math.abs(kalshi.pre_dem - kalshi.pre_rep) * 100).toFixed(1)}`
    : '—';
  const shown = view === 'kalshi' ? kalshiMargin : pollMargin;
  return (
    <div className="ballot-foot dim" style={{ marginTop: 6 }}>
      <div>Poll average: {marketParty} {price.toFixed(1)}% &rarr; {row.actual} won{' '}
        <span className={correct ? 'val-d' : 'val-r'}>{correct ? '✓' : '✗'}</span>
        <span style={{ marginLeft: 6 }}>({row.n_polls} poll{row.n_polls === 1 ? '' : 's'})</span>
      </div>
      <div className="ballot-row" style={{ marginTop: 4, borderTop: 'none', paddingTop: 2 }}>
        <span className="ballot-row-party">
          <select value={view} onChange={(e) => setView(e.target.value)}
            style={{ fontSize: 9.5, padding: '1px 4px', minHeight: 0, letterSpacing: '0.12em' }}>
            <option value="poll">POLL MARGIN, ELECTION DAY</option>
            <option value="kalshi">KALSHI MARGIN, ELECTION DAY</option>
          </select>
        </span>
        <span className="ballot-row-share" />
        <span className="ballot-row-count">{shown}</span>
      </div>
    </div>
  );
}