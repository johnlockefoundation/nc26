import { useEffect, useState } from 'react';
import CollapsibleMetric from './CollapsibleMetric.jsx';
import { loadKalshiResults, kalshiResultFor } from '../lib/kalshiResults.js';
import { assetUrl, getMov } from '../api.js';

function markerPos(party, value) {
  const dir = party === 'R' ? 1 : -1;
  const pct = Math.min(Math.abs(value), 45) / 45 * 50;
  return { left: `${50 + dir * pct}%` };
}

export default function PredictionsBlock({ districtId, race, markets, polls }) {
  const partisan = race?.partisan;
  const [kalshi, setKalshi] = useState(null);
  const [pollsRow, setPollsRow] = useState(null);
  const [result, setResult] = useState(null);
  const [mov, setMov] = useState(null);

  useEffect(() => {
    let alive = true;
    loadKalshiResults().then((d) => { if (alive) setKalshi(kalshiResultFor(d, districtId)); });
    fetch(assetUrl('polls-results.json')).then((r) => r.ok ? r.json() : null).then((d) => {
      if (alive && d && d.races) setPollsRow(d.races[districtId]);
    }).catch(() => {});
    fetch(assetUrl('results.json')).then((r) => r.ok ? r.json() : null).then((d) => {
      if (alive && d && d.races) setResult(d.races[districtId]);
    }).catch(() => {});
    getMov(districtId).then((m) => { if (alive) setMov(m); }).catch(() => {});
    return () => { alive = false; };
  }, [districtId]);

  // Resolve the predicted lean: Civitas for state races, Kalshi MOV for federal,
  // then the market advantage.
  let predicted = null;
  let title = 'PREDICTIONS';
  let sourceUrl = null;
  let isCivitas = false;
  if (partisan && partisan.available) {
    predicted = { party: partisan.party, value: partisan.value, label: partisan.label };
    sourceUrl = partisan.source_url;
    isCivitas = true;
  } else if (mov && mov.available && mov.party && mov.margin != null) {
    predicted = { party: mov.party, value: Math.abs(mov.margin), label: `${mov.party} +${Math.abs(mov.margin).toFixed(1)}` };
  } else if (markets && markets.available && markets.advantage) {
    const a = markets.advantage;
    if (a.party && a.party !== 'EVEN') {
      predicted = { party: a.party, value: Math.abs(a.value || 0), label: a.label };
    }
  }

  const kalshiMargin = mov && mov.available && mov.margin != null
    ? `${mov.party} +${Math.abs(mov.margin).toFixed(1)}`
    : (kalshi
        ? `${kalshi.pre_dem > kalshi.pre_rep ? 'D' : 'R'} +${(Math.abs(kalshi.pre_dem - kalshi.pre_rep) * 100).toFixed(1)}`
        : null);
  const pollMargin = pollsRow
    ? `${pollsRow.poll_margin >= 0 ? 'D' : 'R'} +${Math.abs(pollsRow.poll_margin).toFixed(1)}`
    : null;
  const finalMov = result
    ? `${result.margin_pp >= 0 ? 'D' : 'R'} +${Math.abs(result.margin_pp).toFixed(1)} pp`
    : null;

  const uncontested = !!result && (result.dem_votes === 0 || result.rep_votes === 0);
  const uncontestedParty = uncontested ? (result.dem_votes === 0 ? 'Republicans' : 'Democrats') : null;

  // Qualitative summary (CPI-style over/under-performance), when a predicted
  // lean and an actual result both exist.
  let summary = null;
  if (predicted && result && !uncontested) {
    const expectedPp = predicted.party === 'D' ? predicted.value : -predicted.value;
    const actualPp = result.margin_pp;
    const diff = actualPp - expectedPp;
    const expectedParty = predicted.party === 'D' ? 'Democrats' : 'Republicans';
    const expectedOver = predicted.party === 'D' ? diff > 0 : diff < 0;
    const verb = expectedOver ? 'overperformed' : 'underperformed';
    summary = `${expectedParty} ${verb} expectations by ${Math.abs(diff).toFixed(1)} percent.`;
  }

  const hasAny = predicted || kalshi || pollsRow || markets?.available || polls?.available || result;
  if (!hasAny) return null;

  const advantageLabel = markets?.advantage?.label || polls?.advantage?.label;
  const advantageParty = markets?.advantage?.party || polls?.advantage?.party;
  const value = advantageLabel ? (
    <span className={`metric-value collapsible-metric-value ${advantageParty === 'D' ? 'val-d' : advantageParty === 'R' ? 'val-r' : ''}`}>
      {advantageLabel}
    </span>
  ) : null;

  return (
    <CollapsibleMetric title="PREDICTIONS" value={value}>
      {/* Lean bar at the top, when a predicted lean exists. */}
      {predicted && (
        <div className="leanbar" style={{ marginBottom: 8 }}>
          <div className="leanbar-track">
            <i
              className="leanbar-marker"
              style={markerPos(predicted.party, predicted.value)}
              title={`Predicted: ${predicted.label}`}
            />
            {result && !uncontested && (
              <i
                className="leanbar-marker"
                style={markerPos(result.winner, Math.abs(result.margin_pp))}
                title={`Actual: ${result.winner} +${Math.abs(result.margin_pp).toFixed(1)}`}
              />
            )}
            <span className="leanbar-mid" />
          </div>
          <div className="leanbar-labels">
            <span>DEM</span>
            <span>REP</span>
          </div>
          {result && !uncontested && (
            <div className="leanbar-marker-labels">
              {(() => {
                const p1 = parseFloat(markerPos(predicted.party, predicted.value).left);
                const p2 = parseFloat(markerPos(result.winner, Math.abs(result.margin_pp)).left);
                const mid = (p1 + p2) / 2;
                const gap = Math.max(Math.abs(p2 - p1), 24);
                const leftP = Math.max(2, mid - gap / 2);
                const leftA = Math.min(98, mid + gap / 2);
                return (
                  <>
                    <span style={{ left: `${leftP}%` }}>Predicted</span>
                    <span style={{ left: `${leftA}%` }}>Actual</span>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {uncontested ? (
        <div className="ballot-foot dim" style={{ marginTop: 6 }}>
          {uncontestedParty} were unopposed in this election.
        </div>
      ) : (
        <>
          <div className="ballot-rows">
            {isCivitas && (
              <div className="ballot-row">
                <span className="ballot-row-party">
                  {sourceUrl ? (
                    <a className="metric-title-link" href={sourceUrl} target="_blank" rel="noreferrer">CIVITAS PARTISAN INDEX ↗</a>
                  ) : (
                    'CIVITAS PARTISAN INDEX'
                  )}
                </span>
                <span className="ballot-row-share" />
                <span className={`ballot-row-count ${predicted.party === 'D' ? 'val-d' : 'val-r'}`}>{predicted.label}</span>
              </div>
            )}
            {!isCivitas && kalshiMargin && (
              <div className="ballot-row">
                <span className="ballot-row-party">KALSHI PREDICTED MOV</span>
                <span className="ballot-row-share" />
                <span className={`ballot-row-count ${kalshiMargin.startsWith('D') ? 'val-d' : 'val-r'}`}>{kalshiMargin}</span>
              </div>
            )}
            {!isCivitas && pollsRow && (
              <div className="ballot-row">
                <span className="ballot-row-party">POLL MARGIN, ELECTION DAY</span>
                <span className="ballot-row-share" />
                <span className={`ballot-row-count ${pollMargin.startsWith('D') ? 'val-d' : 'val-r'}`}>{pollMargin}</span>
              </div>
            )}
            {finalMov && (
              <div className="ballot-row ballot-row-total">
                <span className="ballot-row-party">FINAL MARGIN OF VICTORY</span>
                <span className="ballot-row-share" />
                <span className={`ballot-row-count ${finalMov.startsWith('D') ? 'val-d' : 'val-r'}`}>{finalMov}</span>
              </div>
            )}
          </div>
          {summary && <div className="ballot-foot dim" style={{ marginTop: 6 }}>{summary}</div>}
        </>
      )}
    </CollapsibleMetric>
  );
}