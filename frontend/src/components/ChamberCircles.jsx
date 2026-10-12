import { useMemo } from 'react';
import { PARTY_TONES } from '../lib/colors.js';
import { holderOf, seatShift } from '../lib/vulnerability.js';
import { METRIC_LABEL, layoutChamber, metricLabel } from '../lib/seatLayout.js';

// The chambers as seated tiers, not maps. The seat positions come from the
// fixed per-chamber template in lib/chamberTemplates.js -- concentric curved
// rows facing an open floor, a rounded outer arch and a common baseline, 120
// stalwart House positions and 50 Senate ones generated once and committed.
// The runtime only assigns districts to those existing slots; it never solves
// or moves them.
//
// "Where" is the whole point: the closest races of each party sit nearest the
// vertical centreline, ties on the centre itself, and the safest seats at the
// row ends, so the chart answers "how competitive" even before a detail is
// opened. Democratic-leaning seats prefer the left side of the midline,
// Republican-leaning the right, and a surplus from unequal counts spills into
// the outer slots rather than changing the silhouette.
//
// The arrangement is computed in lib/seatLayout.js, which knows nothing about
// colour or the DOM, so the placement rule is testable without a browser. This
// component is only the presentation: which holder colour, what the tooltip
// says.
//
// The actual browser rendering is checked separately: the seats page is served
// and photographed, because the geometry only ever failed visually. The svg
// keeps preserveAspectRatio="xMidYMid meet" and a display width capped per
// chamber, so a narrow window or the height clamp scales the whole silhouette
// proportionally instead of flattening it.
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

// Target pixel size of a seat circle on screen (SVG units are not pixels).
// Kept modest so the House's 120 seats stay legible and the Senate's shorter
// rows do not stretch to fill the same column with bigger circles.
const SEAT_DIAMETER_PX = 26;

export default function ChamberCircles({
  races,
  chamber,
  generic,
  margin,
  selectedId,
  onSelect,
  neutral = false,
}) {
  const layout = useMemo(
    () => layoutChamber(races, chamber),
    [races, chamber],
  );
  if (!layout.seats.length) return null;

  const list = races || [];
  const heldD = list.filter((r) => holderOf(r) === 'D').length;
  const heldR = list.filter((r) => holderOf(r) === 'R').length;
  const heldU = list.filter((r) => holderOf(r) === 'U').length;
  const unrecorded = list.length - heldD - heldR - heldU;

  return (
    <div className="circles-wrap">
      {neutral ? (
        /* A seating template is checked before any race data connects to it:
           every position in one neutral colour, so a person inspecting the
           silhouette is looking at geometry, not reading red and blue around
           it. Enabled by the demo-only ?template=1 query. */
        <div className="hemicycle-key">
          <span className="hemicycle-key-title">Seating template</span>
          <ul className="hemicycle-key-items">
            <li><span className="key-dot" style={{ background: NO_HOLDER }} />Position only · {list.length} seats</li>
          </ul>
        </div>
      ) : (
        /* Three colours and no key is a chart nobody can read. The heading names
            what the fill means -- who holds the seat, not which way it leans --
            because the two are deliberately different facts. */
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
      )}
      {/* Seat circles are drawn at 14 viewBox units across. Capping the display
          width per chamber keeps every circle the same pixel size in the Senate
          as in the House, so a chamber with more seats grows wider rather than
          blowing its circles up to fill the column the map's width set. The
          height then follows the viewBox exactly. */}
      <svg
        className="hemicycle"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: `${(layout.width * SEAT_DIAMETER_PX) / 14}px` }}
        role="group"
        aria-label={`Chamber by seat, arranged by ${METRIC_LABEL}`}
      >
        {layout.seats.map((seat) => {
          const { race, value, x, y } = seat;
          const selected = race.district_id === selectedId;
          const name = race.partisan?.holder_name;

          if (neutral) {
            const label = `${race.district_id} · position only`;
            return (
              <circle
                key={race.district_id}
                className={['seat-circle', selected ? 'is-selected' : ''].filter(Boolean).join(' ')}
                cx={x}
                cy={y}
                r={7}
                fill={NO_HOLDER}
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
          }

          const holder = holderOf(race);
          const shift = seatShift(value, generic);
          const vulnerable = shift != null && Math.abs(shift) <= margin;
          const tone = HOLDER_TONE[holder] || NO_HOLDER;
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
              cx={x}
              cy={y}
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
