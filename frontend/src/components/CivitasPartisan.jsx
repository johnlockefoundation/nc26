function markerPos(party, value) {
  const dir = party === 'R' ? 1 : -1;
  const pct = Math.min(value, 45) / 45 * 50;
  return { left: `${50 + dir * pct}%` };
}

export default function CivitasPartisan({ partisan }) {
  if (!partisan || !partisan.available) {
    return (
      <section className="panel-section">
        <h3>CIVITAS PARTISAN INDEX</h3>
        <div className="dim">Not yet available for this district.</div>
      </section>
    );
  }
  const partyCls = partisan.party === 'D' ? 'val-d' : 'val-r';
  const rating =
    partisan.lean === 'Toss-up' ? 'TOSS-UP' : `${partisan.lean || ''} ${partisan.party}`.trim();

  return (
    <section className="panel-section">
      <h3>
        {partisan.source_url ? (
          <a className="section-link" href={partisan.source_url} target="_blank" rel="noreferrer" title="Open 2026 Civitas Partisan Index">CIVITAS PARTISAN INDEX ↗</a>
        ) : (
          'CIVITAS PARTISAN INDEX'
        )}
      </h3>

      <div className="metric-value">
        <span className={partyCls}>{partisan.label}</span>
        <span className="partisan-rating">{rating}</span>
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
    </section>
  );
}