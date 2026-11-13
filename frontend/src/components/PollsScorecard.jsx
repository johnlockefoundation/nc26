import { useEffect, useState } from 'react';
import CollapsibleMetric from './CollapsibleMetric.jsx';

import { assetUrl } from '../api.js';

let pollsPromise = null;
function loadPollsResults() {
  if (pollsPromise) return pollsPromise;
  pollsPromise = fetch(assetUrl('polls-results.json'))
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return pollsPromise;
}

export default function PollsScorecard({ districtId, summary }) {
  const [row, setRow] = useState(null);
  useEffect(() => {
    let alive = true;
    loadPollsResults().then((data) => {
      if (!alive) return;
      setRow(data && data.races ? data.races[districtId] : null);
    });
    return () => { alive = false; };
  }, [districtId]);

  if (!summary?.available) {
    return (
      <div className="metric metric-empty">
        <div className="metric-title">POLLS</div>
        <div className="metric-value"><span className="metric-na">NO POLLING</span></div>
      </div>
    );
  }
  if (!row) return null;

  const marketParty = row.poll_dem > row.poll_rep ? 'D' : row.poll_dem < row.poll_rep ? 'R' : 'EVEN';
  const correct = marketParty === row.actual || marketParty === 'EVEN';
  const price = marketParty === 'D' ? row.poll_dem : row.poll_rep;
  const pollMargin = `${row.poll_margin >= 0 ? 'D' : 'R'} +${Math.abs(row.poll_margin).toFixed(1)}`;
  const finalMov = row.final_mov != null
    ? `${row.final_mov >= 0 ? 'D' : 'R'} +${Math.abs(row.final_mov).toLocaleString()}`
    : '—';

  const advantageLabel = summary?.advantage?.label;
  const value = advantageLabel ? (
    <span className={`metric-value collapsible-metric-value ${summary.advantage.party === 'D' ? 'val-d' : summary.advantage.party === 'R' ? 'val-r' : ''}`}>
      {advantageLabel}
    </span>
  ) : null;

  return (
    <CollapsibleMetric title="POLLS" value={value}>
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
          <span className="ballot-row-party">FINAL MARGIN OF VICTORY</span>
          <span className="ballot-row-share" />
          <span className="ballot-row-count">{finalMov} votes</span>
        </div>
      </div>
    </CollapsibleMetric>
  );
}