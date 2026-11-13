// Kalshi widget, reimagined as a scorecard: the market's pre-election price
// vs. the actual winner, with the election-day market margin beside the final
// market margin. Federal races only. Collapsible like the BALLOTS box.
//
// Note: "final margin of victory in votes" is not something we hold -- Kalshi
// only resolves to a winner, not a vote margin. The final figure below is the
// resolved market margin (which goes to ~100 points). Real vote margins would
// need an NC SBE results source.
import { useEffect, useState } from 'react';
import CollapsibleMetric from './CollapsibleMetric.jsx';
import { loadKalshiResults, kalshiResultFor } from '../lib/kalshiResults.js';

export default function KalshiScorecard({ districtId, summary }) {
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
  const electionMargin = (row.pre_dem - row.pre_rep) * 100;
  const electionLabel = `${electionMargin >= 0 ? 'D' : 'R'} +${Math.abs(electionMargin).toFixed(1)}`;
  const finalLabel = row.actual === 'D' ? 'D +100.0' : 'R +100.0';

  const advantageLabel = summary?.advantage?.label;
  const value = advantageLabel ? (
    <span className={`metric-value collapsible-metric-value ${summary.advantage.party === 'D' ? 'val-d' : summary.advantage.party === 'R' ? 'val-r' : ''}`}>
      {advantageLabel}
    </span>
  ) : null;

  return (
    <CollapsibleMetric
      title="KALSHI"
      value={value}
      source={summary?.source_url}
      sourceHref={summary?.source_url}
    >
      <div className="ballot-foot dim">
        Kalshi forecast: {marketParty} {(price * 100).toFixed(1)}% &rarr; {row.actual} won{' '}
        <span className={correct ? 'val-d' : 'val-r'}>{correct ? '✓' : '✗'}</span>
      </div>
      <div className="ballot-rows">
        <div className="ballot-row">
          <span className="ballot-row-party">KALSHI MARGIN, ELECTION DAY</span>
          <span className="ballot-row-share" />
          <span className="ballot-row-count">{electionLabel}</span>
        </div>
        <div className="ballot-row ballot-row-total">
          <span className="ballot-row-party">FINAL MARKET MARGIN</span>
          <span className="ballot-row-share" />
          <span className="ballot-row-count">{finalLabel}</span>
        </div>
      </div>
    </CollapsibleMetric>
  );
}