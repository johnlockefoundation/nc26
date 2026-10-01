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
export default function CivitasPartisan({ partisan }) {
  if (!partisan || !partisan.available) {
    return (
      <div className="metric metric-empty metric-elongated">
        <div className="metric-title">CIVITAS PARTISAN INDEX</div>
        <div className="metric-value"><span className="metric-na">NOT YET AVAILABLE</span></div>
      </div>
    );
  }
  const partyCls = partisan.party === 'D' ? 'val-d' : 'val-r';
  // The Civitas bucket -- "Safe", "Likely", "Lean" -- is dropped, because every
  // one of those chips spells the party a second time and the party is already
  // the margin sitting beside it ("LIKELY R" next to "R +8"). A toss-up is the
  // one kept: it names no party, and it is what separates a seat Civitas rates
  // as undetermined from one that merely rounds to zero -- "D +1" alone reads
  // as settled when it means the opposite.
  const isTossUp = partisan.lean === 'Toss-up';

  return (
    <div className="metric metric-elongated">
      <div className="metric-title">
        {partisan.source_url ? (
          <a className="metric-title-link" href={partisan.source_url} target="_blank" rel="noreferrer" title="Open 2026 Civitas Partisan Index">CIVITAS PARTISAN INDEX ↗</a>
        ) : (
          'CIVITAS PARTISAN INDEX'
        )}
      </div>

      <div className="metric-value">
        <span className={partyCls}>{partisan.label}</span>
        {isTossUp && <span className="partisan-rating">TOSS-UP</span>}
        {partisan.competitive && <span className="partisan-inplay">IN PLAY</span>}
      </div>

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
    </div>
  );
}