import { useEffect, useState } from 'react';
import { assetUrl } from '../api.js';

function markerPos(party, value) {
  const dir = party === 'R' ? 1 : -1;
  const pct = Math.min(value, 45) / 45 * 50;
  return { left: `${50 + dir * pct}%` };
}

// The Civitas index, in the same box as MONEY, POLLS and the market quotes --
// and elongated rather than collapsed, because on a General Assembly seat it is
// the only race signal there is. 170 of the 185 seats have no polling, no market
// and no fundraising, so this is the headline for the chamber rather than
// supporting detail, and folding it away would bury the one number the map is
// coloured from.
export default function CivitasPartisan({ partisan, districtId }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!districtId) return;
    let alive = true;
    fetch(assetUrl('results.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && d.races) setResult(d.races[districtId]); })
      .catch(() => {});
    return () => { alive = false; };
  }, [districtId]);

  if (!partisan || !partisan.available) {
    return (
      <div className="metric metric-empty metric-elongated">
        <div className="metric-title">CIVITAS PARTISAN INDEX</div>
        <div className="metric-value"><span className="metric-na">NOT YET AVAILABLE</span></div>
      </div>
    );
  }
  const partyCls = partisan.party === 'D' ? 'val-d' : partisan.party === 'R' ? 'val-r' : '';
  // Expected margin in pp (signed, D positive) from the Civitas index.
  const expectedPp = partisan.party === 'D' ? partisan.value : -partisan.value;
  const actualPp = result ? result.margin_pp : null;
  let summary = null;
  if (actualPp != null) {
    const diff = actualPp - expectedPp; // positive = more D than expected
    const expectedParty = partisan.party === 'D' ? 'Democrats' : 'Republicans';
    const expectedOver = partisan.party === 'D' ? diff > 0 : diff < 0;
    const verb = expectedOver ? 'overperformed' : 'underperformed';
    summary = `${expectedParty} ${verb} expectations by ${Math.abs(diff).toFixed(1)} percent.`;
  }

  return (
    <div className="metric metric-elongated">
      <div className="metric-title">
        {partisan.source_url ? (
          <a className="metric-title-link" href={partisan.source_url} target="_blank" rel="noreferrer" title="Open 2026 Civitas Partisan Index">CIVITAS PARTISAN INDEX ↗</a>
        ) : (
          'CIVITAS PARTISAN INDEX'
        )}
      </div>

      <div className={`metric-value ${partyCls}`}>
        <span>{partisan.label}</span>
        {partisan.competitive && <span className="partisan-inplay">IN PLAY</span>}
      </div>

      {summary ? (
        <div className="ballot-foot dim" style={{ marginTop: 6 }}>{summary}</div>
      ) : (
        <div className="leanbar">
          <div className="leanbar-track">
            <i
              className={`leanbar-marker m-${partisan.party.toLowerCase()}`}
              style={markerPos(partisan.party, partisan.value)}
            />
            <span className="leanbar-mid" />
          </div>
          <div className="leanbar-labels">
            <span>DEM</span>
            <span>REP</span>
          </div>
        </div>
      )}
    </div>
  );
}