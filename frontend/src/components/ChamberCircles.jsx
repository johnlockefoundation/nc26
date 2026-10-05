import { PARTY_TONES } from '../lib/colors.js';
import { holderOf, projectLean, seatShift, signedCpi } from '../lib/vulnerability.js';

// One circle per seat, laid out as a waffle: a fixed grid of equal marks, one
// per district.
//
// The map answers "where". This answers "how many", which the map cannot: a
// reader looking at North Carolina sees four or five hot districts and cannot
// tell whether that is 5 vulnerable seats out of 120 or 5 out of 12. Every circle
// is the same size and every circle is a seat, so the shape of the chamber is
// the shape of the grid and nothing is encoded by area.
//
// Colour is who HOLDS the seat, taken from the incumbent flag, which is a
// different fact from which way the seat leans and the two disagree often
// enough to matter. A seat can be held by a party the index rates against it,
// and drawing that as a red circle next to a blue map is the point rather than a
// conflict. Open seats are grey: no one holds them, which is neither party.
//
// The vulnerable ring is drawn rather than filled so that "who holds it" and
// "is it in play" stay two readable channels instead of one colour fighting
// itself. A filled circle would make a vulnerable R-held seat look like a D seat.

const NO_HOLDER = '#475569';

export default function ChamberCircles({
  races,
  generic,
  margin,
  selectedId,
  onSelect,
}) {
  // District order, so the grid reads in sequence rather than in whatever order
  // the payload happened to arrive.
  const seats = [...(races || [])].sort(
    (a, b) => (a.district_number ?? 0) - (b.district_number ?? 0),
  );
  if (!seats.length) return null;

  // Roughly twice as wide as tall, which is the aspect a chamber actually reads
  // at. Derived rather than hardcoded so it holds if a chamber's size changes.
  const cols = Math.max(1, Math.ceil(Math.sqrt(seats.length * 2)));

  return (
    <div className="circles-wrap">
      <div
        className="circles-grid"
        style={{ '--circle-cols': cols }}
        role="group"
        aria-label="Chamber by seat"
      >
        {seats.map((race) => {
          const holder = holderOf(race);
          const cpi = signedCpi(race.partisan);
          const shift = seatShift(cpi, generic);
          const lean = projectLean(shift);
          // Two chambers, two honest answers to "is this seat in play".
          //
          // A General Assembly seat has a Civitas index, so the ring is the
          // slider's arithmetic at the current generic ballot: a reader who has
          // moved the slider sees the waffle answer to it.
          //
          // A U.S. House seat has no per-district index, so there is nothing for
          // the slider to move against and the ring falls back to the cycle's
          // published competitive designation. That is a real designation rather
          // than arithmetic, which is the only reason it is used -- without it
          // the chamber renders fourteen identical circles and says nothing.
          const vulnerable = cpi == null
            ? Boolean(race.competitive)
            : shift != null && Math.abs(shift) <= margin;
          const tone = holder ? PARTY_TONES[holder].live : NO_HOLDER;
          const selected = race.district_id === selectedId;

          // A seat with no index has no projected lean to print, so it is
          // labelled by what is actually known about it instead.
          const title = cpi == null
            ? `${race.district_id}: ${race.competitive ? 'designated competitive' : 'not competitive'}`
            : `${race.district_id}: ${vulnerable
              ? `in play at ${lean ? lean.label : 'EVEN'}`
              : lean ? lean.label : 'unrated'}`;

          return (
            <button
              type="button"
              key={race.district_id}
              className={[
                'seat-circle',
                vulnerable ? 'is-vulnerable' : '',
                selected ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              style={{ '--seat-tone': tone }}
              onClick={() => onSelect(race.district_id)}
              title={title}
              aria-label={title}
              aria-pressed={selected}
              data-district={race.district_id}
            >
              <span className="seat-circle-fill" />
            </button>
          );
        })}
      </div>
    </div>
  );
}