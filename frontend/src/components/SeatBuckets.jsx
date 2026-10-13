import { useEffect, useMemo, useRef } from 'react';
import { PARTY_TONES } from '../lib/colors.js';
import { GA_MARGIN, holderOf, signedCpi } from '../lib/vulnerability.js';

// A General Assembly chamber split three ways -- safe Democratic, competitive,
// safe Republican -- with one circle per seat, grouped into three rectangles
// rather than arranged along an arc. The grouping is the lean bucket; the fill
// is a different fact.
//
// COLOUR IS WHO HOLDS THE SEAT, taken from `holder_party`, which is not the same
// as which way the seat leans and disagrees often enough to matter -- a party
// can hold a seat the Civitas index rates against it, and that seat is drawn in
// its holder's colour inside the other party's block on purpose. Open seats are
// grey: nobody holds them.
//
// "In play" is a ring, never a fill, so holding and vulnerability stay two
// readable channels. Every dot is a button: clicking or pressing Enter selects
// that district and opens its race card, the same selection the map uses.
//
// The cut is the Civitas index against an even environment: a seat more than
// GA_MARGIN points to one party is safe for it, and a seat inside that band is
// competitive. Index arithmetic, not a forecast.
//
// Held by an unaffiliated member. Neither party colour would be honest for such
// a seat, so it takes a third hue.
const UNAFFILIATED = '#a78bfa';
// No holder recorded. Kept so a seat that somehow lacks one reads as "not
// recorded" rather than being silently coloured as a party.
const NO_HOLDER = '#475569';

const HOLDER_TONE = { D: PARTY_TONES.D.live, R: PARTY_TONES.R.live, U: UNAFFILIATED };

function leanLabel(value) {
  if (value == null) return 'no lean';
  if (value === 0) return 'EVEN';
  return `${value > 0 ? 'R' : 'D'} +${Math.abs(value)}`;
}

// One seat. A button so it is selectable by pointer and keyboard alike; the fill
// is the holder, the ring is in-play, and the amber outline is the current
// selection -- the same three signals the map's seat carries. Pointer-entry and
// focus call `onPrefetch` so the race card is already in the cache by the time
// the click lands.
function SeatDot({ race, selected, onSelect, onPrefetch }) {
  const holder = holderOf(race);
  const value = signedCpi(race.partisan);
  const inPlay = value != null && Math.abs(value) <= GA_MARGIN;
  const name = race.partisan?.holder_name;
  const held = holder === 'U'
    ? `Held by ${name || 'an unaffiliated member'}`
    : holder ? `Held by ${holder}` : 'Holder not recorded';
  const label = `${race.district_id} · ${held} · Partisan lean ${leanLabel(value)}`;

  return (
    <button
      type="button"
      className={[
        'seat-dot',
        inPlay ? 'is-vulnerable' : '',
        selected ? 'is-selected' : '',
      ].filter(Boolean).join(' ')}
      style={{ background: HOLDER_TONE[holder] || NO_HOLDER }}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      data-district={race.district_id}
      onPointerEnter={() => onPrefetch?.(race.district_id)}
      onFocus={() => onPrefetch?.(race.district_id)}
      onClick={() => onSelect?.(race.district_id)}
    />
  );
}

// One bucket, drawn as a rectangle of seats. The seats fill a near-square grid
// and the trailing cells are left empty, so the group reads as a solid block
// whose size is its seat count.
function BucketGrid({ seats, selectedId, onSelect, onPrefetch }) {
  const n = Math.max(seats.length, 1);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cells = rows * cols;
  return (
    <div
      className="bucket-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, var(--dot-size))` }}
    >
      {Array.from({ length: cells }, (_, i) => (
        i < seats.length ? (
          <SeatDot
            key={seats[i].district_id}
            race={seats[i]}
            selected={seats[i].district_id === selectedId}
            onSelect={onSelect}
            onPrefetch={onPrefetch}
          />
        ) : (
          <span key={`gap-${i}`} className="seat-gap" />
        )
      ))}
    </div>
  );
}

export default function SeatBuckets({ races, selectedId, onSelect, onPrefetch }) {
  // One shared timer: sweeping the pointer across the grid re-homes the pending
  // prefetch onto the seat the pointer actually rests on, instead of firing a
  // read for every dot it crossed.
  const prefetchTimer = useRef(null);
  useEffect(() => () => clearTimeout(prefetchTimer.current), []);
  const schedulePrefetch = (districtId) => {
    if (!onPrefetch) return;
    clearTimeout(prefetchTimer.current);
    prefetchTimer.current = setTimeout(() => onPrefetch(districtId), 120);
  };

  const { groups, held, unrated, total } = useMemo(() => {
    const list = races || [];
    const safeD = [];
    const competitive = [];
    const safeR = [];
    let d = 0;
    let r = 0;
    let u = 0;
    let un = 0;
    let unratedCount = 0;
    for (const race of list) {
      const holder = holderOf(race);
      if (holder === 'D') d++;
      else if (holder === 'R') r++;
      else if (holder === 'U') u++;
      else un++;
      const cpi = signedCpi(race.partisan);
      if (cpi == null) { unratedCount++; continue; }
      if (cpi < -GA_MARGIN) safeD.push(race);
      else if (cpi > GA_MARGIN) safeR.push(race);
      else competitive.push(race);
    }
    const byId = (a, b) => a.district_id.localeCompare(b.district_id);
    return {
      groups: [
        { key: 'safeD', label: 'SAFE DEMOCRAT', seats: safeD.sort(byId) },
        { key: 'competitive', label: 'COMPETITIVE', seats: competitive.sort(byId) },
        { key: 'safeR', label: 'SAFE REPUBLICAN', seats: safeR.sort(byId) },
      ],
      held: { d, r, u, un },
      unrated: unratedCount,
      total: list.length,
    };
  }, [races]);

  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="buckets">
      {/* Three colours and no key is a chart nobody can read. The heading names
          what the fill means -- who holds the seat, not which way it leans. */}
      <div className="buckets-key">
        <span className="buckets-key-title">Currently held by</span>
        <ul className="buckets-key-items">
          <li><span className="key-dot" style={{ background: PARTY_TONES.D.live }} />D {held.d}</li>
          <li><span className="key-dot" style={{ background: PARTY_TONES.R.live }} />R {held.r}</li>
          {held.u > 0 && (
            <li><span className="key-dot" style={{ background: UNAFFILIATED }} />Unaffiliated {held.u}</li>
          )}
          {held.un > 0 && (
            <li><span className="key-dot" style={{ background: NO_HOLDER }} />Not recorded {held.un}</li>
          )}
          <li className="buckets-key-ring"><span className="key-ring" />In play</li>
        </ul>
      </div>

      <div className="buckets-groups">
        {groups.map((g) => (
          <div className="bucket" key={g.key}>
            <div className="bucket-head">
              <span className="bucket-label">{g.label}</span>
              <span className="bucket-count">{g.seats.length}</span>
              <span className="bucket-pct">{pct(g.seats.length)}%</span>
            </div>
            <BucketGrid
              seats={g.seats}
              selectedId={selectedId}
              onSelect={onSelect}
              onPrefetch={schedulePrefetch}
            />
          </div>
        ))}
      </div>

      {unrated > 0 && (
        <p className="buckets-note">
          {unrated} {unrated === 1 ? 'seat carries' : 'seats carry'} no Civitas
          index and {unrated === 1 ? 'is' : 'are'} not grouped above.
        </p>
      )}
    </div>
  );
}
