// Two voter-movement widgets under one snapshot header: how fast
// registration is growing, and how fast ballot requests are coming in.
//
// Both are the same question asked of two different things -- what changed
// since the equivalent date last cycle, split by party. No per-period rates:
// a monthly rate across a two-year gap is an artefact of the window, not a
// measure of anything a voter feels.
//
// PLACEHOLDER DATA. is_mock still comes from the API so nothing downstream can
// read these as NCSBE filings, but the panel carries a single disclaimer
// beneath the Civitas index rather than a notice per widget.
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

const PARTIES = [
  { key: 'dem', label: 'Democrat', cls: 'reg-d' },
  { key: 'rep', label: 'Republican', cls: 'reg-r' },
  { key: 'unaff', label: 'Unaffiliated', cls: 'reg-u' },
];

// change rows, scaled so the largest mover fills the bar
function PartyChanges({ change }) {
  const rows = PARTIES.map((p) => ({ ...p, value: change[p.key] }));
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

export default function VoterVelocity({ vitals }) {
  if (!vitals || !vitals.available) return null;

  const { registration, ballot, from_date, to_date } = vitals;
  const window = `${shortDate(to_date)} ${vitals.to} v ${shortDate(from_date)} ${vitals.from}`;

  return (
    <section className="panel-section">
      <h3>{`${vitals.from} v ${vitals.to}`}</h3>

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
      <div className="vel-window dim">{window}</div>
      <PartyChanges change={ballot.change} />
    </section>
  );
}
