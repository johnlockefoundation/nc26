// Widget: district demographics and how they moved between snapshots.
// PLACEHOLDER DATA. The whole point of the widget is the delta column, so the
// banner sits above the change table where it cannot be skimmed past.
function pts(v) {
  return v == null ? '—' : v > 0 ? `+${v}` : `${v}`;
}

function withSign(v) {
  if (v == null) return '—';
  return v > 0 ? `+${v}` : `${v}`;
}

function RaceBars({ label, rows, suffix = '%' }) {
  return (
    <>
      <div className="profile-label">{label}</div>
      <div className="demos-bars">
        {rows.map((r) => (
          <div key={r.key} className="demos-bar-row">
            <span className="demos-bar-name">{r.label}</span>
            <div className="demos-bar-track">
              <i className={r.cls} style={{ width: `${Math.max(0, Math.min(100, r.value ?? 0))}%` }} />
            </div>
            <span className="demos-bar-pct">{r.value == null ? '—' : `${Math.round(r.value)}${suffix}`}</span>
            {r.change != null && <span className={`demos-delta ${r.change > 0 ? 'up' : r.change < 0 ? 'down' : ''}`}>{withSign(r.change)}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

export default function DistrictDemographics({ demographics }) {
  if (!demographics || !demographics.available) {
    return (
      <section className="panel-section">
        <h3>DISTRICT CHANGE</h3>
        <div className="dim">Demographic data not yet available for this district.</div>
      </section>
    );
  }

  const d = demographics.latest;
  const c = demographics.change;
  const snap = d.snapshot;

  return (
    <section className="panel-section">
      <h3>DISTRICT CHANGE</h3>

      {demographics.is_mock && (
        <div className="mock-banner" role="note">
          PLACEHOLDER FIGURES — not NCSBE or Census data
        </div>
      )}

      <div className="demos-heads">
        <div className="demos-head">
          <span>POPULATION</span>
          <b>{(d.total_pop ?? 0).toLocaleString('en-US')}</b>
          {c?.total_pop != null && (
            <span className={`demos-head-delta ${c.total_pop > 0 ? 'up' : c.total_pop < 0 ? 'down' : ''}`}>
              {withSign(c.total_pop)} ({withSign(c.total_pop_pct)}%)
            </span>
          )}
        </div>
        <div className="demos-head">
          <span>REGISTERED</span>
          <b>{(d.registered ?? 0).toLocaleString('en-US')}</b>
          {c?.registered != null && (
            <span className={`demos-head-delta ${c.registered > 0 ? 'up' : c.registered < 0 ? 'down' : ''}`}>
              {withSign(c.registered)}
            </span>
          )}
        </div>
      </div>

      <RaceBars
        label="RACE / ETHNICITY"
        rows={[
          { key: 'white', label: 'White', value: d.race.white, change: c?.race.white, cls: 'race-white' },
          { key: 'black', label: 'Black', value: d.race.black, change: c?.race.black, cls: 'race-black' },
          { key: 'hispanic', label: 'Hispanic', value: d.race.hispanic, change: c?.race.hispanic, cls: 'race-hispanic' },
          { key: 'other', label: 'Other', value: d.race.other, change: c?.race.other, cls: 'race-other' },
        ]}
      />

      <RaceBars
        label="REGISTRATION"
        rows={[
          { key: 'dem', label: 'Democrat', value: d.affiliation.dem, change: c?.affiliation.dem, cls: 'race-dem' },
          { key: 'rep', label: 'Republican', value: d.affiliation.rep, change: c?.affiliation.rep, cls: 'race-rep' },
          { key: 'unaff', label: 'Unaffiliated', value: d.affiliation.unaffiliated, change: c?.affiliation.unaffiliated, cls: 'race-unaff' },
        ]}
      />

      <div className="demos-foot dim">
        {c ? `Snapshot ${c.from} → ${c.to}. ` : `Snapshot ${snap}. `}
        {demographics.source || ''}
      </div>
    </section>
  );
}
