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
      <h3>CIVITAS PARTISAN INDEX</h3>

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

      {partisan.reason && <div className="profile-line dim">{partisan.reason}</div>}
      {partisan.source && <div className="profile-source dim">Source: {partisan.source}</div>}
    </section>
  );
}