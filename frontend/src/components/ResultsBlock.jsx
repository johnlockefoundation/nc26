import { useEffect, useState } from 'react';
import CollapsibleMetric from './CollapsibleMetric.jsx';
import { assetUrl } from '../api.js';

export default function ResultsBlock({ districtId, candidates }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(assetUrl('results.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && d.races) setResult(d.races[districtId]); })
      .catch(() => {});
    return () => { alive = false; };
  }, [districtId]);
  if (!result) return null;

  const total = result.total_votes || 0;
  const winnerParty = result.winner;

  // Match candidates to parties; fall back to D/R if party missing.
  const rows = (candidates || []).map((c, i) => {
    const party = String(c.party || '').toUpperCase().startsWith('D') ? 'D'
      : String(c.party || '').toUpperCase().startsWith('R') ? 'R' : (c.party || '');
    const votes = party === 'D' ? result.dem_votes : party === 'R' ? result.rep_votes : 0;
    const pct = total > 0 ? (votes / total * 100).toFixed(1) + '%' : '—';
    const isWinner = party === winnerParty;
    return (
      <div key={c.candidate_id || i} className="ballot-row">
        <span className="ballot-row-party">{party}</span>
        <span className="ballot-row-share" style={{ textAlign: 'left', justifyContent: 'flex-start' }}>
          {c.name}
          {isWinner && <sub className="val-d" style={{ fontSize: 9, marginLeft: 3 }}>✓</sub>}
        </span>
        <span className="ballot-row-count">{votes.toLocaleString()} ({pct})</span>
      </div>
    );
  });

  // If no candidates, fall back to D/R rows.
  if (!rows.length) {
    rows.push(
      <div key="d" className="ballot-row">
        <span className="ballot-row-party">D</span>
        <span className="ballot-row-share" />
        <span className="ballot-row-count">{result.dem_votes.toLocaleString()}</span>
      </div>,
      <div key="r" className="ballot-row">
        <span className="ballot-row-party">R</span>
        <span className="ballot-row-share" />
        <span className="ballot-row-count">{result.rep_votes.toLocaleString()}</span>
      </div>,
    );
  }

  const marginLabel = `${result.margin_pp >= 0 ? 'D' : 'R'} +${Math.abs(result.margin_pp).toFixed(1)} pp`;

  return (
    <CollapsibleMetric title="RESULTS" value={null}>
      <div className="ballot-rows">
        {rows}
        <div className="ballot-row ballot-row-total">
          <span className="ballot-row-party">TOTAL</span>
          <span className="ballot-row-share" />
          <span className="ballot-row-count">{total.toLocaleString()}</span>
        </div>
      </div>
      <div className="ballot-foot dim">
        Final margin: {marginLabel} · {result.total_votes.toLocaleString()} votes
      </div>
    </CollapsibleMetric>
  );
}