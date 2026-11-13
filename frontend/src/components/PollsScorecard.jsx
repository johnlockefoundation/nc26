import { useEffect, useState } from 'react';
import CollapsibleMetric from './CollapsibleMetric.jsx';
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

  return (
    <CollapsibleMetric title="POLLS" value={null}>
      <div className="ballot-foot dim">
        Poll average: {marketParty} {price.toFixed(1)}% &rarr; {row.actual} won{' '}
        <span className={correct ? 'val-d' : 'val-r'}>{correct ? '✓' : '✗'}</span>
        <span style={{ marginLeft: 6 }}>({row.n_polls} poll{row.n_polls === 1 ? '' : 's'})</span>
      </div>
      <div className="ballot-rows">
        <div className="ballot-row">
          <span className="ballot-row-party">POLL MARGIN, ELECTION DAY</span>
          <span className="ballot-row-share" />
          <span className="ballot-row-count">{pollMargin}</span>
        </div>
        <div className="ballot-row ballot-row-total">
          <span className="ballot-row-party">KALSHI MARGIN, ELECTION DAY</span>
          <span className="ballot-row-share" />
          <span className="ballot-row-count">{kalshiMargin}</span>
        </div>
      </div>
    </CollapsibleMetric>
  );
}