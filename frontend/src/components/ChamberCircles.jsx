import { useMemo } from 'react';
import { PARTY_TONES } from '../lib/colors.js';
import { holderOf, seatShift } from '../lib/vulnerability.js';
import { METRIC_LABEL, layoutChamber, metricLabel } from '../lib/seatLayout.js';

// The chamber as a hemicycle: the semicircle of seats every election night uses.
//
// A waffle answers "how many". A hemicycle answers "how many, and where" -- and
// "where" is the whole point, because the seats are laid out by partisan lean
// rather than by district number. Blue collects on the left, red on the right,
// and the seats nearest a tie sit at the apex.
//
// The arrangement is computed in lib/seatLayout.js, which knows nothing about
// colour or the DOM, so the placement rule is testable without a browser. This
// component is only the presentation: which holder colour, which ring, what the
// tooltip says.
//
// The metric is the Civitas Partisan Index -- a lean, not a forecast. There is
// no district-level forecast margin in the payload, and the only per-district
// quantity that exists for every General Assembly seat is the index. It is
// labelled "partisan lean" everywhere it is shown; deriving a margin from the
// market, the money or the incumbent would dress an index up as something it is
// not.
//
// COLOUR IS WHO HOLDS THE SEAT. Taken from the incumbent flag, which is a
// different fact from which way the seat leans, and the two disagree often
// enough to matter -- a party can hold a seat the index rates against it.
// Drawing that as a red circle on the left-hand, Democratic-leaning side is the
// point, not a conflict. Open seats are grey: nobody holds them.
//
// "In play" is a ring, never a fill, so that holding and vulnerability stay two
// readable channels. A filled circle would make a vulnerable Republican-held
// seat read as a Democratic one.

// Held by an unaffiliated member. Two 2025-26 House seats are, and neither
// party colour would be honest for them: they are not Democratic seats and they
// are not Republican ones, and a third hue is the only truthful option left once
// the two party fills are taken.
const UNAFFILIATED = '#a78bfa';
// No holder recorded at all. Unreachable from the General Assembly data now that
// every seat carries holder_party, kept so a seat that somehow lacks one reads as
// "not recorded" rather than being silently coloured as a party.
const NO_HOLDER = '#475569';

const HOLDER_TONE = { D: PARTY_TONES.D.live, R: PARTY_TONES.R.live, U: UNAFFILIATED };

export default function ChamberCircles({
  races,
  generic,
  margin,
  selectedId,
  onSelect,
}) {
  const layout = useMemo(() => layoutChamber(races), [races]);
  if (!layout.seats.length) return null;

  const list = races || [];
  const heldD = list.filter((r) => holderOf(r) === 'D').length;
  const heldR = list.filter((r) => holderOf(r) === 'R').length;
  const heldU = list.filter((r) => holderOf(r) === 'U').length;
  const unrecorded = list.length - heldD - heldR - heldU;

  return (
    <div className="circles-wrap">
      {/* Three colours and no key is a chart nobody can read. The heading names
          what the fill means -- who holds the seat, not which way it leans --
          because the two are deliberately different facts. */}
      <div className="hemicycle-key">
        <span className="hemicycle-key-title">Currently held by</span>
        <ul className="hemicycle-key-items">
          <li><span className="key-dot" style={{ background: PARTY_TONES.D.live }} />D {heldD}</li>
          <li><span className="key-dot" style={{ background: PARTY_TONES.R.live }} />R {heldR}</li>
          {heldU > 0 && (
            <li><span className="key-dot" style={{ background: UNAFFILIATED }} />Un&#8203;affiliated {heldU}</li>
          )}
          {unrecorded > 0 && (
            <li><span className="key-dot" style={{ background: NO_HOLDER }} />Not recorded {unrecorded}</li>
          )}
        </ul>
      </div>
      <svg
        className="hemicycle"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label={`Chamber by seat, arranged by ${METRIC_LABEL} and coloured by who holds the seat`}
      >
        {layout.seats.map((seat) => {
          const { race, value } = seat;
          const holder = holderOf(race);
          const shift = seatShift(value, generic);
          const vulnerable = shift != null && Math.abs(shift) <= margin;
          const tone = HOLDER_TONE[holder] || NO_HOLDER;
          const selected = race.district_id === selectedId;
          const name = race.partisan?.holder_name;
          const held = holder === 'U'
            ? `Held by ${name || 'an unaffiliated member'}`
            : holder ? `Held by ${holder}` : 'Holder not recorded';
          // The holder is named in the tooltip as well as the lean, because the
          // fill is the holder and a reader deserves to know whose seat it is.
          const label = `${race.district_id} · ${held} · Partisan lean ${metricLabel(value)}`;

          return (
            <circle
              key={race.district_id}
              className={[
                'seat-circle',
                vulnerable ? 'is-vulnerable' : '',
                selected ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              cx={seat.x}
              cy={seat.y}
              r={7}
              fill={tone}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selected}
              data-district={race.district_id}
              onClick={() => onSelect?.(race.district_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(race.district_id);
                }
              }}
            >
              <title>{label}</title>
            </circle>
          );
        })}
      </svg>
      <p className="hemicycle-caption">
        Seats are arranged by {METRIC_LABEL}, not geographic location.
      </p>
    </div>
  );
}
