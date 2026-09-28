// Two voter-movement widgets under one snapshot header: how fast
// registration is growing, and how fast ballots are coming back.
//
// PLACEHOLDER DATA. is_mock still comes from the API so nothing downstream can
// read these as NCSBE filings, but the panel carries a single disclaimer
// beneath the Civitas index rather than a notice per widget.
function sign(v, suffix = '') {
  if (v == null) return '—';
  return v > 0 ? `+${v.toLocaleString('en-US')}${suffix}` : v < 0 ? `${v.toLocaleString('en-US')}${suffix}` : `0${suffix}`;
}

function RegistrationVelocity({ reg }) {
  const { change, per_month_by_party } = reg;
  const rows = [
    { key: 'dem', label: 'Democrat', change: change.dem, per_month: per_month_by_party.dem, cls: 'reg-d' },
    { key: 'rep', label: 'Republican', change: change.rep, per_month: per_month_by_party.rep, cls: 'reg-r' },
    { key: 'unaff', label: 'Unaffiliated', change: change.unaff, per_month: per_month_by_party.unaff, cls: 'reg-u' },
  ];
  // Scale the bars to the largest absolute change so the leading party reads
  // at full width and the others are proportional.
  const peak = Math.max(...rows.map((r) => Math.abs(r.change || 0)), 1);

  return (
    <>
      <div className="profile-label">REGISTRATION VELOCITY</div>
      <div className="vel-heads">
        <div className="vel-head">
          <span>NET NEW VOTERS</span>
          <b className={reg.net > 0 ? 'up' : reg.net < 0 ? 'down' : ''}>{sign(reg.net)}</b>
        </div>
        <div className="vel-head">
          <span>PER MONTH</span>
          <b>{sign(reg.per_month)}</b>
        </div>
      </div>
      <div className="vel-bars">
        {rows.map((r) => (
          <div key={r.key} className="vel-bar-row">
            <span className="vel-bar-name">{r.label}</span>
            <div className="vel-bar-track">
              <i className={r.cls} style={{ width: `${(Math.abs(r.change || 0) / peak) * 100}%` }} />
            </div>
            <span className={`vel-bar-chg ${r.change > 0 ? 'up' : r.change < 0 ? 'down' : ''}`}>
              {sign(r.change)}<em>/mo</em>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function BallotVelocity({ ballot }) {
  return (
    <>
      <div className="profile-label">BALLOT VELOCITY</div>
      <div className="vel-heads">
        <div className="vel-head">
          <span>BALLOTS RETURNED</span>
          <b>{ballot.returned != null ? ballot.returned.toLocaleString('en-US') : '—'}</b>
        </div>
        <div className="vel-head">
          <span>RETURN RATE</span>
          <b>{ballot.return_rate != null ? `${ballot.return_rate}%` : '—'}</b>
        </div>
      </div>
      <div className="profile-bars">
        <div className="vel-bar-row">
          <span className="vel-bar-name">Requested</span>
          <div className="vel-bar-track">
            <i className="reg-b" style={{ width: '100%' }} />
          </div>
          <span className="vel-bar-chg">{ballot.requested != null ? ballot.requested.toLocaleString('en-US') : '—'}</span>
        </div>
        <div className="vel-bar-row">
          <span className="vel-bar-name">Returned</span>
          <div className="vel-bar-track">
            <i className="reg-b" style={{ width: `${ballot.return_rate ?? 0}%` }} />
          </div>
          <span className="vel-bar-chg">{ballot.returned != null ? ballot.returned.toLocaleString('en-US') : '—'}</span>
        </div>
      </div>
    </>
  );
}

export default function VoterVelocity({ vitals }) {
  if (!vitals || !vitals.available) return null;

  return (
    <section className="panel-section">
      <h3>{`${vitals.from} v ${vitals.to}`}</h3>

      <RegistrationVelocity reg={vitals.registration} />
      <BallotVelocity ballot={vitals.ballot} />
    </section>
  );
}
