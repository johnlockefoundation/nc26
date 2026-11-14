import { useEffect, useState } from 'react';
import { assetUrl, getMov } from '../api.js';

function markerPos(party, value) {
  const dir = party === 'R' ? 1 : -1;
  const pct = Math.min(Math.abs(value), 45) / 45 * 50;
  return { left: `${50 + dir * pct}%` };
}

// A lean bar with two markers (predicted + actual), used for both the Civitas
// index (state races) and the Kalshi predicted MOV (federal races).
export default function CivitasPartisan({ partisan, districtId, race }) {
  const [result, setResult] = useState(null);
  const [mov, setMov] = useState(null);

  useEffect(() => {
    if (!districtId) return;
    let alive = true;
    fetch(assetUrl('results.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && d.races) setResult(d.races[districtId]); })
      .catch(() => {});
    getMov(districtId).then((m) => { if (alive) setMov(m); }).catch(() => {});
    return () => { alive = false; };
  }, [districtId]);

  // Resolve the predicted lean: Civitas for state races, Kalshi MOV for federal,
  // then the market advantage, then nothing.
  let predicted = null;
  let title = 'PARTISAN LEAN';
  let sourceUrl = null;
  if (partisan && partisan.available) {
    predicted = { party: partisan.party, value: partisan.value, label: partisan.label };
    title = 'CIVITAS PARTISAN INDEX';
    sourceUrl = partisan.source_url;
  } else if (mov && mov.available && mov.party && mov.margin != null) {
    predicted = { party: mov.party, value: Math.abs(mov.margin), label: `${mov.party} +${Math.abs(mov.margin).toFixed(1)}` };
    title = 'KALSHI PREDICTED MOV';
  } else if (race && race.markets && race.markets.available && race.markets.advantage) {
    const a = race.markets.advantage;
    if (a.party && a.party !== 'EVEN') {
      predicted = { party: a.party, value: Math.abs(a.value || 0), label: a.label };
      title = 'KALSHI PREDICTED MOV';
    }
  }

  if (!predicted) {
    return (
      <div className="metric metric-empty metric-elongated">
        <div className="metric-title">PARTISAN LEAN</div>
        <div className="metric-value"><span className="metric-na">NOT YET AVAILABLE</span></div>
      </div>
    );
  }

  const partyCls = predicted.party === 'D' ? 'val-d' : predicted.party === 'R' ? 'val-r' : '';
  const expectedPp = predicted.party === 'D' ? predicted.value : -predicted.value;
  const actualPp = result ? result.margin_pp : null;
  const uncontested = !!result && (result.dem_votes === 0 || result.rep_votes === 0);
  const uncontestedParty = uncontested ? (result.dem_votes === 0 ? 'Republicans' : 'Democrats') : null;

  let summary = null;
  if (actualPp != null && !uncontested) {
    const diff = actualPp - expectedPp;
    const expectedParty = predicted.party === 'D' ? 'Democrats' : 'Republicans';
    const expectedOver = predicted.party === 'D' ? diff > 0 : diff < 0;
    const verb = expectedOver ? 'overperformed' : 'underperformed';
    summary = `${expectedParty} ${verb} expectations by ${Math.abs(diff).toFixed(1)} percent.`;
  }

  return (
    <div className="metric metric-elongated">
      <div className="metric-title">
        {sourceUrl ? (
          <a className="metric-title-link" href={sourceUrl} target="_blank" rel="noreferrer" title="Open 2026 Civitas Partisan Index">{title} ↗</a>
        ) : (
          title
        )}
      </div>

      <div className={`metric-value ${partyCls}`}>
        <span>{predicted.label}</span>
      </div>

      {uncontested ? (
        <div className="ballot-foot dim" style={{ marginTop: 6 }}>
          {uncontestedParty} were unopposed in this election.
        </div>
      ) : (
        <>
          <div className="leanbar">
            <div className="leanbar-track">
              <i
                className="leanbar-marker"
                style={markerPos(predicted.party, predicted.value)}
                title={`Predicted: ${predicted.label}`}
              />
              {actualPp != null && (
                <i
                  className="leanbar-marker"
                  style={markerPos(result.winner, Math.abs(actualPp))}
                  title={`Actual: ${result.winner} +${Math.abs(actualPp).toFixed(1)}`}
                />
              )}
              <span className="leanbar-mid" />
            </div>
            <div className="leanbar-labels">
              <span>DEM</span>
              <span>REP</span>
            </div>
            {actualPp != null && (() => {
              const p1 = parseFloat(markerPos(predicted.party, predicted.value).left);
              const p2 = parseFloat(markerPos(result.winner, Math.abs(actualPp)).left);
              const mid = (p1 + p2) / 2;
              const gap = Math.max(Math.abs(p2 - p1), 24);
              const leftP = Math.max(2, mid - gap / 2);
              const leftA = Math.min(98, mid + gap / 2);
              return (
                <div className="leanbar-marker-labels">
                  <span style={{ left: `${leftP}%` }}>Predicted</span>
                  <span style={{ left: `${leftA}%` }}>Actual</span>
                </div>
              );
            })()}
          </div>
          {summary && <div className="ballot-foot dim" style={{ marginTop: 6 }}>{summary}</div>}
        </>
      )}
    </div>
  );
}