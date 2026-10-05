import { PARTY_TONES } from '../lib/colors.js';
import { holderOf, projectLean, seatShift, signedCpi } from '../lib/vulnerability.js';

// The chamber as a hemicycle: the semicircle of seats every election night uses.
//
// A waffle answers "how many". A hemicycle answers "how many, and where" --
// and "where" is the whole point here, because the seats are laid out by lean
// rather than by district number. Blue collects on the left, red on the right,
// and the seats nearest a tie sit at the apex.
//
// That ordering is what makes the slider legible. In-play seats are by definition
// the ones closest to the state, so on a lean-sorted chart they are a contiguous
// wedge at the top. Moving the generic ballot does not make scattered seats light
// up one at a time; it widens or slides a single band, and the eye reads the
// count off the shape. Laid out by district number instead, the same change looks
// like random circles switching on, which is exactly what this is meant to stop.
//
// Which is also why the fill runs from the apex outward rather than left to
// right: filling each row left-to-right would put the most Democratic seat at the
// top-left and the most Republican at the bottom-right, so the in-play wedge
// would march diagonally and its width would be unreadable.
//
// COLOUR IS WHO HOLDS THE SEAT. Taken from the incumbent flag, which is a
// different fact from which way the seat leans and the two disagree often enough
// to matter -- a party can hold a seat the index rates against it. Drawing that
// as a red circle on the left-hand, Democratic-leaning side is the point, not a
// conflict. Open seats are grey: nobody holds them, which is neither party.
//
// "In play" is a ring, never a fill, so that holding and vulnerability stay two
// readable channels. A filled circle would make a vulnerable Republican-held seat
// read as a Democratic one.

// A seat where neither candidate is flagged incumbent. This is deliberately NOT
// labelled "open": the seed carries incumbent: false for 23 General Assembly
// seats whose members are in fact sitting, so the flag is unreliable there and
// rendering grey as "nobody holds this" would assert something the data does not
// support. It means the holder is not recorded. One seat really is open -- NC-11,
// where Edwards withdrew -- and the chart does not claim to know which is which.
const NO_HOLDER = '#475569';

// Angular sector the rows span. Just shy of a full half-turn: at exactly 180 the
// outermost seats sit level with the front row and the arc reads as a rectangle
// with curved ends. A wider span also pulls the outer arcs in, which is the
// single biggest lever on how tightly the chart packs.
const SPAN_DEG = 176;
const SPAN_RAD = (SPAN_DEG * Math.PI) / 180;

// Minimum arc length per seat, which sets how far out each row must sit for its
// circles not to overlap. Radius is derived from seat count rather than fixed, so
// a 40-seat arc and an 8-seat arc space correctly without tuning by eye.
//
// Just over the circle diameter: any more and the chart spreads out faster than
// the seats need, because a 120-seat chamber is dominated by its outermost arc
// and that arc's radius grows with the spacing. 120 seats at 17px of spacing
// needed a 496px-wide chart; at 15.5px it needs 404, which is the difference
// between a diagram and a scatter.
const SEAT_SPACING = 15.5;
const R_MIN = 44;
// Minimum gap between consecutive arcs. Without it a small chamber collapses:
// the 14-seat House needs 2, 4 and 8 seats on its three arcs, and the first two
// both fall below the spacing their seat count implies, so both clamp to R_MIN
// and the two rows land on the same circle.
const ROW_GAP = 17;
const CIRCLE_R = 7;

// Rows scale with chamber size: a 120-seat chamber needs more arcs than a 14-seat
// one or the inner rows collapse to a single seat.
function rowCount(n) {
  return Math.max(3, Math.min(9, Math.round(Math.sqrt(n) / 2.2)));
}

// Seat counts per arc, growing outward because the outer arcs are longer. Weighted
// linearly by radius and then corrected so the rows sum to exactly n -- a chart
// that renders 119 of 120 seats is a bug that looks like a rounding error.
function rowSizes(n, rows) {
  const weights = Array.from({ length: rows }, (_, i) => i + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const sizes = weights.map((w) => Math.max(1, Math.floor((n * w) / totalWeight)));
  let assigned = sizes.reduce((a, b) => a + b, 0);
  // Give or take the remainder on the outermost arc, which has the most slack.
  const outer = sizes.length - 1;
  sizes[outer] = Math.max(1, sizes[outer] + (n - assigned));
  return sizes;
}

export default function ChamberCircles({
  races,
  generic,
  margin,
  selectedId,
  onSelect,
}) {
  const seats = [...(races || [])];
  if (!seats.length) return null;

  // The sort key is the signed lean: Democratic negative, Republican positive, so
  // ascending puts the most Democratic first. Seats with no index -- both federal
  // chambers -- fall back to who holds them, which still gives a blue-left,
  // red-right chart rather than an arbitrary one.
  const keyed = seats.map((race) => {
    const cpi = signedCpi(race.partisan);
    const holder = holderOf(race);
    return {
      race,
      cpi,
      key: cpi != null ? cpi : holder === 'D' ? -1 : holder === 'R' ? 1 : 0,
    };
  }).sort((a, b) => a.key - b.key);

  // Reorder from the apex outward: the most even seat in the middle, then
  // alternating out to each side. Ties break leftward, which is arbitrary but
  // stable -- what matters is that the sequence is monotonic in |lean|.
  const n = keyed.length;
  const mid = (n - 1) / 2;
  const centerOut = [...Array(n).keys()]
    .sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b)
    .map((i) => keyed[i]);

  const rows = rowCount(n);
  const sizes = rowSizes(n, rows);

  const positions = [];
  let radius = 0;
  let maxRadius = 0;
  sizes.forEach((count, row) => {
    // Outward far enough that this row's seats clear each other, and always
    // further out than the row inside it.
    const needed = (count * SEAT_SPACING) / SPAN_RAD;
    radius = Math.max(radius ? radius + ROW_GAP : R_MIN, needed);
    maxRadius = radius;
    for (let j = 0; j < count; j++) {
      // Centre of each seat's slot, so the row is symmetric about the apex.
      const t = count === 1 ? 0.5 : j / (count - 1);
      const deg = -SPAN_DEG / 2 + t * SPAN_DEG;
      const rad = (deg * Math.PI) / 180;
      positions.push({
        row,
        radius,
        angle: rad,
        // Ordering within the row: nearest the apex first, so the fill order is
        // apex-outward across the whole chart rather than restarting each row.
        offset: Math.abs(t - 0.5),
      });
    }
  });
  positions.sort((a, b) => a.row - b.row || a.offset - b.offset);

  // The viewBox is sized to the chart rather than fixed, so a 14-seat chamber is
  // not a small shape marooned in a 120-seat canvas and no arc is ever clipped.
  const halfW = Math.ceil(maxRadius * Math.sin(SPAN_RAD / 2) + CIRCLE_R + 8);
  const cx = halfW;
  const cy = Math.ceil(maxRadius + CIRCLE_R + 8);
  for (const pos of positions) {
    pos.x = cx + pos.radius * Math.sin(pos.angle);
    pos.y = cy - pos.radius * Math.cos(pos.angle);
  }
  const width = halfW * 2;
  const height = cy + 18;

  const heldD = keyed.filter((s) => holderOf(s.race) === 'D').length;
  const heldR = keyed.filter((s) => holderOf(s.race) === 'R').length;
  const unrecorded = n - heldD - heldR;

  return (
    <div className="circles-wrap">
      {/* Three colours and no key is a chart nobody can read. Swatches only, no
          prose: the counts live on the slider where they change. */}
      <ul className="hemicycle-key">
        <li><span className="key-dot" style={{ background: PARTY_TONES.D.live }} />{heldD} held by D</li>
        <li><span className="key-dot" style={{ background: PARTY_TONES.R.live }} />{heldR} held by R</li>
        {unrecorded > 0 && (
          <li><span className="key-dot" style={{ background: NO_HOLDER }} />{unrecorded} holder not recorded</li>
        )}
      </ul>
      <svg
        className="hemicycle"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Chamber by seat, ordered by partisan lean"
      >
        {centerOut.map((seat, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const { race, cpi } = seat;
          const holder = holderOf(race);
          const shift = seatShift(cpi, generic);
          const lean = projectLean(shift);
          // Two chambers, two honest answers to "is this seat in play". A General
          // Assembly seat has an index, so the ring is the slider's arithmetic at
          // the current generic ballot. A federal seat has no per-district index, so
          // there is nothing to move and the ring is the cycle's published
          // designation instead -- a real designation rather than arithmetic, and
          // the only reason it is used: without it the chamber renders fourteen
          // identical circles and says nothing at all.
          const vulnerable = cpi == null
            ? Boolean(race.competitive)
            : shift != null && Math.abs(shift) <= margin;
          const tone = holder ? PARTY_TONES[holder].live : NO_HOLDER;
          const selected = race.district_id === selectedId;
          // The holder is named in the tooltip as well as the lean, because the
          // fill is the holder and a reader deserves to know whose seat this is.
          const who = holder === 'D' ? 'held by D' : holder === 'R' ? 'held by R' : 'holder not recorded';
          const inPlay = cpi == null
            ? (race.competitive ? 'designated competitive' : 'not competitive')
            : vulnerable ? `in play at ${lean ? lean.label : 'EVEN'}` : lean ? lean.label : 'unrated';
          const label = `${race.district_id}: ${who}, ${inPlay}`;

          return (
            <circle
              key={race.district_id}
              className={[
                'seat-circle',
                vulnerable ? 'is-vulnerable' : '',
                selected ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              cx={pos.x}
              cy={pos.y}
              r={CIRCLE_R}
              fill={tone}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selected}
              data-district={race.district_id}
              onClick={() => onSelect(race.district_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(race.district_id);
                }
              }}
            >
              <title>{label}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}