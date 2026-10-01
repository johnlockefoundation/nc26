// One DEMOGRAPHICS block for every chamber, in the same collapsed state as
// MONEY, POLLS and the market quotes: a .metric box, title hard left, nothing
// but a disclosure caret on the right. Expanding elongates the box in place.
//
// Demographics is the one panel category with no single party-advantage figure,
// so there is no value to show while folded -- an empty right-hand side reads
// as "nothing here" rather than "ask me", and a stand-in number would be a
// different kind of claim in every chamber. Everything lives behind the caret.
//
// The two datasets are deliberately disjoint. Federal seats carry a Census
// profile (age, income, education, race, 2024 margin); General Assembly seats
// carry registration and ballot velocity. No seat has both. The body renders
// whichever the seat actually has, so the block is one category across all four
// chambers even though what fills it differs.
//
// Placeholder figures. is_mock comes from the API on both datasets, so nothing
// downstream can read these as NCSBE or Census filings; the panel carries a
// single disclaimer rather than a notice per section.

function sign(v) {
  if (v == null) return '—';
  return v > 0 ? `+${v.toLocaleString('en-US')}` : v.toLocaleString('en-US');
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function fmtIncome(v) {
  return v == null ? '—' : `$${(v / 1000).toFixed(1)}k`;
}

function parseLean(m) {
  const mm = /^([DR])\+([\d.]+)$/.exec(m || '');
  return mm ? { party: mm[1], value: parseFloat(mm[2]) } : null;
}

function leanMarkerPos(margin) {
  const dir = margin.party === 'R' ? 1 : -1;
  const pct = Math.min(margin.value, 45) / 45 * 50;
  return { left: `${50 + dir * pct}%` };
}

const PARTIES = [
  { key: 'dem', label: 'Democrat', cls: 'reg-d' },
  { key: 'rep', label: 'Republican', cls: 'reg-r' },
  { key: 'unaff', label: 'Unaffiliated', cls: 'reg-u' },
];

// change rows, scaled so the largest mover fills the bar
function PartyChanges({ change }) {
  const rows = PARTIES.map((p) => ({ ...p, value: change?.[p.key] }));
  const peak = Math.max(...rows.map((r) => Math.abs(r.value || 0)), 1);
  return (
    <div className="vel-bars">
      {rows.map((r) => (
        <div key={r.key} className="vel-bar-row">
          <span className="vel-bar-name">{r.label}</span>
          <div className="vel-bar-track">
            <i className={r.cls} style={{ width: `${(Math.abs(r.value || 0) / peak) * 100}%` }} />
          </div>
          <span className={`vel-bar-chg ${r.value > 0 ? 'up' : r.value < 0 ? 'down' : ''}`}>{sign(r.value)}</span>
        </div>
      ))}
    </div>
  );
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

function VitalsBody({ vitals }) {
  const { registration, ballot, from_date, to_date } = vitals;
  return (
    <>
      <div className="profile-label">REGISTRATION VELOCITY</div>
      <div className="vel-heads">
        <div className="vel-head">
          <span>NET NEW VOTERS</span>
          <b className={registration.net > 0 ? 'up' : registration.net < 0 ? 'down' : ''}>
            {sign(registration.net)}
          </b>
        </div>
        <div className="vel-head">
          <span>REGISTERED NOW</span>
          <b>{registration.current != null ? registration.current.toLocaleString('en-US') : '—'}</b>
        </div>
      </div>
      <PartyChanges change={registration.change} />

      <div className="profile-label">BALLOT VELOCITY</div>
      <div className="vel-heads">
        <div className="vel-head">
          <span>BALLOTS REQUESTED</span>
          <b className={ballot.net > 0 ? 'up' : ballot.net < 0 ? 'down' : ''}>{sign(ballot.net)}</b>
        </div>
        <div className="vel-head">
          <span>REQUESTS NOW</span>
          <b>{ballot.current_total != null ? ballot.current_total.toLocaleString('en-US') : '—'}</b>
        </div>
      </div>
      <div className="vel-window dim">
        {`${shortDate(to_date)} ${vitals.to} v ${shortDate(from_date)} ${vitals.from}`}
      </div>
      <PartyChanges change={ballot.change} />
    </>
  );
}

export default function Demographics({ profile, vitals }) {
  const hasProfile = Boolean(profile);
  const hasVitals = Boolean(vitals?.available);

  // A seat carrying neither would render a block that expands to nothing. Same
  // reasoning as the metric blocks above it: an empty disclosure says more
  // about the pipeline than about the district.
  if (!hasProfile && !hasVitals) return null;

  const source = profile?.source || vitals?.source;

  return (
    <details className="metric collapsible-metric">
      <summary className="collapsible-metric-head">
        <span className="metric-title">DEMOGRAPHICS</span>
        <span className="collapsible-caret" aria-hidden="true" />
      </summary>
      <div className="collapsible-metric-body">
        {hasProfile && <ProfileBody profile={profile} />}
        {hasVitals && <VitalsBody vitals={vitals} />}
        {source && <div className="profile-source dim">{source}</div>}
      </div>
    </details>
  );
}
