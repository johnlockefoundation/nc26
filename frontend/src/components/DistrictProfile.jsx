function fmtIncome(v) {
  return v == null ? '—' : `$${(v / 1000).toFixed(1)}k`;
}

function parseLean(m) {
  const mm = /^([DR])\+([\d.]+)$/.exec(m || '');
  return mm ? { party: mm[1], value: parseFloat(mm[2]) } : null;
}

function markerPos(margin) {
  const dir = margin.party === 'R' ? 1 : -1;
  const pct = Math.min(margin.value, 45) / 45 * 50;
  return { left: `${50 + dir * pct}%` };
}

export default function DistrictProfile({ profile }) {
  if (!profile) {
    return (
      <section className="panel-section">
<h3>{profile.scope ? `${profile.scope} ` : ''}PROFILE</h3>
        <div className="dim">District profile not yet available.</div>
      </section>
    );
  }

  const race = profile.race || {};
  const races = [
    { key: 'white', label: 'White', pct: race.white, cls: 'race-white' },
    { key: 'black', label: 'Black', pct: race.black, cls: 'race-black' },
    { key: 'hispanic', label: 'Hispanic', pct: race.hispanic, cls: 'race-hispanic' },
    { key: 'other', label: 'Other / Two+', pct: race.other, cls: 'race-other' },
  ].filter((r) => r.pct != null);
  const margin = parseLean(profile.pres_margin);

  return (
    <section className="panel-section">
      <h3>PROFILE</h3>

      <div className="profile-stats">
        <div className="profile-stat"><span>MEDIAN AGE</span><b>{profile.median_age ?? '—'}</b></div>
        <div className="profile-stat"><span>MEDIAN INCOME</span><b>{fmtIncome(profile.median_income)}</b></div>
        <div className="profile-stat"><span>BACHELOR'S+</span><b>{profile.bachelors_plus != null ? `${profile.bachelors_plus}%` : '—'}</b></div>
      </div>

      {races.length > 0 && (
        <>
          <div className="profile-label">RACE / ETHNICITY</div>
          <div className="profile-bars">
            {races.map((r) => (
              <div key={r.key} className="profile-bar-row">
                <span className="profile-bar-name">{r.label}</span>
                <div className="profile-bar-track"><i className={r.cls} style={{ width: `${r.pct}%` }} /></div>
                <span className="profile-bar-pct">{Math.round(r.pct)}%</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="profile-label">2024 PRESIDENTIAL MARGIN</div>
      {margin ? (
        <>
          <div className="leanbar">
            <div className="leanbar-track">
              <i className={`leanbar-marker m-${margin.party.toLowerCase()}`} style={markerPos(margin)} />
              <span className="leanbar-mid" />
            </div>
            <div className="leanbar-labels">
              <span>DEM</span>
              <span>REP</span>
            </div>
          </div>
          <div className="profile-line">
            <span>2024 {margin.party} +{margin.value}</span>
            {profile.cpi ? <span> · CPI {profile.cpi}</span> : null}
          </div>
        </>
      ) : (
        <div className="dim">—</div>
      )}

      {profile.source && <div className="profile-source dim">{profile.source}</div>}
    </section>
  );
}