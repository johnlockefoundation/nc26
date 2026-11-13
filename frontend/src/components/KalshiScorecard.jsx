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

import { assetUrl } from '../api.js';

let resultsPromise = null;
function loadResults() {
  if (resultsPromise) return resultsPromise;
  resultsPromise = fetch(assetUrl('results.json'))
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return resultsPromise;
}

export default function KalshiScorecard({ districtId, summary }) {
  const [row, setRow] = useState(null);
  const [result, setResult] = useState(null);
  useEffect(() => {
    let alive = true;
    loadKalshiResults().then((data) => {
      if (!alive) return;
      setRow(kalshiResultFor(data, districtId));
    });
    loadResults().then((data) => {
      if (!alive) return;
      setResult(data && data.races ? data.races[districtId] : null);
    });
    return () => { alive = false; };
  }, [districtId]);

  if (!summary?.available) {
    return (
      <div className="metric metric-empty">
        <div className="metric-title">KALSHI</div>
        <div className="metric-value"><span className="metric-na">NO MARKET</span></div>
      </div>
    );
  }

  const advantageLabel = summary?.advantage?.label;
  const value = advantageLabel ? (
    <span className={`metric-value collapsible-metric-value ${summary.advantage.party === 'D' ? 'val-d' : summary.advantage.party === 'R' ? 'val-r' : ''}`}>
      {advantageLabel}
    </span>
  ) : null;

  if (!row) {
    return (
      <CollapsibleMetric title="KALSHI" value={value} source={summary?.source_url} sourceHref={summary?.source_url}>
        <div className="ballot-foot dim">Result data unavailable for this build.</div>
      </CollapsibleMetric>
    );
  }

  const electionMargin = (row.pre_dem - row.pre_rep) * 100;
  const electionLabel = `${electionMargin >= 0 ? 'D' : 'R'} +${Math.abs(electionMargin).toFixed(1)}`;
  const finalMov = result
    ? `${result.margin_pp >= 0 ? 'D' : 'R'} +${Math.abs(result.margin_pp).toFixed(1)} pp`
    : (row.actual === 'D' ? 'D +—' : 'R +—');

  return (
    <CollapsibleMetric
      title="KALSHI"
      value={value}
      source={summary?.source_url}
      sourceHref={summary?.source_url}
    >
      <div className="ballot-rows">
        <div className="ballot-row">
          <span className="ballot-row-party">KALSHI MARGIN, ELECTION DAY</span>
          <span className="ballot-row-share" />
          <span className="ballot-row-count">{electionLabel}</span>
        </div>
        <div className="ballot-row ballot-row-total">
          <span className="ballot-row-party">FINAL MARGIN OF VICTORY</span>
          <span className="ballot-row-share" />
          <span className="ballot-row-count">{finalMov}</span>
        </div>
      </div>
    </CollapsibleMetric>
  );
}