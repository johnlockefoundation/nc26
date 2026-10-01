// DEMOGRAPHICS: the Census profile of a district -- who lives there, how old,
// how much they earn, and how the place voted in 2024.
//
// This is a sibling of REGISTRATIONS and BALLOTS, not their parent. Registration
// and ballot velocity are about who is turning out and in which party; a census
// profile is about the electorate's composition. Different questions, different
// snapshots, different sources, and they are only ever rendered side by side by
// accident of which datasets a seat happens to carry. Each is its own collapsible
// so a reader can open one without opening the others.
//
// Federal seats carry this profile; General Assembly seats carry registration and
// ballot velocity instead. No seat has both, so at most one of the three blocks
// renders per race -- but the panel treats them as three independent categories
// rather than one category with three bodies, because that is what they are.
//
// Placeholder figures. is_mock comes from the API, so nothing downstream can
// read these as NCSBE or Census filings; the panel carries a single disclaimer
// rather than a notice per section.

import CollapsibleMetric from './CollapsibleMetric.jsx';

function fmtIncome(v) {
  return v == null ? '—' : `$${(v / 1000).toFixed(1)}k`;
}

// The 2024 presidential lean as a marker on a two-sided track, so the district's
// own baseline leans and the Civitas rating for the current cycle can be read
// against each other rather than as two unrelated numbers.
function parseLean(m) {
  const mm = /^([DR])\+([\d.]+)$/.exec(m || '');
  return mm ? { party: mm[1], value: parseFloat(mm[2]) } : null;
}

function leanMarkerPos(margin) {
  const dir = margin.party === 'R' ? 1 : -1;
  const pct = Math.min(margin.value, 45) / 45 * 50;
  return { left: `${50 + dir * pct}%` };
}

function ProfileBody({ profile }) {
  const race = profile.race || {};
  const races = [
    { key: 'white', label: 'White', pct: race.white, cls: 'race-white' },
    { key: 'black', label: 'Black', pct: race.black, cls: 'race-black' },
    { key: 'hispanic', label: 'Hispanic', pct: race.hispanic, cls: 'race-hispanic' },
    { key: 'other', label: 'Other / Two+', pct: race.other, cls: 'race-other' },
  ].filter((r) => r.pct != null);
  const margin = parseLean(profile.pres_margin);

  return (
    <>
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
              <i className={`leanbar-marker m-${margin.party.toLowerCase()}`} style={leanMarkerPos(margin)} />
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
    </>
  );
}

export default function Demographics({ profile }) {
  // A seat with no profile would render a box that expands to nothing. Same
  // reasoning as the metric blocks above it: an empty disclosure says more
  // about the pipeline than about the district.
  if (!profile) return null;

  return (
    <CollapsibleMetric title="DEMOGRAPHICS" source={profile.source}>
      <ProfileBody profile={profile} />
    </CollapsibleMetric>
  );
}
