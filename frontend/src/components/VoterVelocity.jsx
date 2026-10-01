// REGISTRATION and BALLOT: the two voter-movement blocks.
//
// These were one DEMOGRAPHICS body until this split, which was wrong twice over.
// They are not demographics -- both measure how the electorate is moving between
// snapshots, not what it is made of -- and they are not one dataset either.
// Registration is who has signed up; ballots are who has already asked to vote by
// mail. Different questions, different columns, different things to be alarmed
// about, and a reader who wants one usually does not want the other.
//
// "Velocity" is the point of both. A raw count says how many voters there are,
// which is a fact about the district; the change since the same point in the
// previous cycle says which way the seat is moving, which is a fact about the
// race. So each block leads with its net change and shows the party split of
// that change underneath, since the aggregate number alone does not say who is
// driving it.
//
// Both are General Assembly datasets. No federal seat carries them, and no seat
// carries a Census profile, so a race renders either these two blocks or a
// DEMOGRAPHICS block, never a mix.
//
// Placeholder figures. is_mock comes from the API, so nothing downstream can read
// these as NCSBE records; the panel carries a single disclaimer rather than a
// notice per block.

import CollapsibleMetric from './CollapsibleMetric.jsx';

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

// The two dates these figures compare. Shown in each block rather than once at
// the bottom of a combined one: each figure is only meaningful against the window
// it was measured over, and a reader opening a single block should not have to
// expand another one to find out what "change since" means.
function Window({ vitals }) {
  return (
    <div className="vel-window dim">
      {`${shortDate(vitals.to_date)} ${vitals.to} v ${shortDate(vitals.from_date)} ${vitals.from}`}
    </div>
  );
}

function Headline({ label, value, className }) {
  return (
    <div className="vel-head">
      <span>{label}</span>
      <b className={className}>{value}</b>
    </div>
  );
}

export function Registration({ vitals }) {
  const { registration } = vitals || {};
  // A seat carrying no registration figures would render a box that expands to
  // nothing. Same reasoning as the metric blocks above: an empty disclosure says
  // more about the pipeline than about the district.
  if (!registration) return null;

  return (
    <CollapsibleMetric title="REGISTRATION" source={vitals.source}>
      <div className="vel-heads">
        <Headline
          label="NET NEW VOTERS"
          value={sign(registration.net)}
          className={registration.net > 0 ? 'up' : registration.net < 0 ? 'down' : ''}
        />
        <Headline
          label="REGISTERED NOW"
          value={registration.current != null ? registration.current.toLocaleString('en-US') : '—'}
        />
      </div>
      <Window vitals={vitals} />
      <PartyChanges change={registration.change} />
    </CollapsibleMetric>
  );
}

export function Ballot({ vitals }) {
  const { ballot } = vitals || {};
  if (!ballot) return null;

  return (
    <CollapsibleMetric title="BALLOT" source={vitals.source}>
      <div className="vel-heads">
        <Headline
          label="BALLOTS REQUESTED"
          value={sign(ballot.net)}
          className={ballot.net > 0 ? 'up' : ballot.net < 0 ? 'down' : ''}
        />
        <Headline
          label="REQUESTS NOW"
          value={ballot.current_total != null ? ballot.current_total.toLocaleString('en-US') : '—'}
        />
      </div>
      <Window vitals={vitals} />
      <PartyChanges change={ballot.change} />
    </CollapsibleMetric>
  );
}
