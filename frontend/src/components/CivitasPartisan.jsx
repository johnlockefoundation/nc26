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
  // The party colour rides the .metric-value element itself, not the inner
  // span: the rule is the compound .metric-value.val-d / .val-r, so the class
  // has to sit beside metric-value to match -- the same place MetricBlock and
  // MoneyBlock put theirs. On a child span it matched nothing and the label
  // stayed the default ink on every seat.
  const partyCls = partisan.party === 'D' ? 'val-d' : partisan.party === 'R' ? 'val-r' : '';
  // The Civitas bucket -- "Safe", "Likely", "Lean", "Toss-up" -- is dropped.
  // The first three merely spell the party a second time, and the party is
  // already the margin sitting beside it ("LIKELY R" next to "R +8"). "Toss-up"
  // is not carried either: every seat Civitas rates a toss-up is also in play,
  // so it only ever appeared beside IN PLAY and said the same thing. IN PLAY is
  // the signal that survives.

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