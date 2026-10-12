// Pure geometry for the General Assembly hemicycle.
//
// Room to think about where the seats go fell off a cliff the moment we tried
// to put a chamber of 120 circles on the same screen as the map, so the layout
// is written as three plain functions -- normalise a seat's metric, size the
// concentric arcs, assign districts to slots -- none of which knows anything
// about React, colour or the DOM. The component that renders this is then only
// responsible for presentation, and the arrangement can be tested without a
// browser (see seatLayout.test.mjs).
//
// The ordering metric is the Civitas Partisan Index, expressed as a signed
// number with Democratic negative and Republican positive. It is the only
// per-district quantity that exists for every General Assembly seat; there is
// no district-level forecast margin in the payload, and the honest label for
// the index is "partisan lean", not "predicted margin". A seat at exactly zero
// is a tie, and a seat with no index at all is unrated -- three different facts
// that must not be folded together by falling back to market, money, incumbent
// or competitiveness.
import { signedCpi } from './vulnerability.js';

// What the arrangement is by. Shown to the reader in the caption so the chart
// cannot be mistaken for a geographic one.
export const METRIC_LABEL = 'partisan lean';

// Angular half-width each side spans, just shy of a right angle. At exactly 90
// the outermost seats sit level with the baseline and the arc reads as a
// rectangle with rounded ends.
const HALF_RAD = (89 * Math.PI) / 180;
// A gap kept clear at the apex for the tie column, before the adaptive per-row
// clearance below widens it for tightly-packed rows.
const MIN_GAP_RAD = (4 * Math.PI) / 180;

// Minimum arc length per seat, so two neighbours on an arc do not overlap. This
// is the same number the original single-arc chart used; a 120-seat chamber is
// dominated by its outermost arc and that arc's radius grows with the spacing.
const SEAT_SPACING = 15.5;
const R_MIN = 44;
const ROW_GAP = 17;
const CIRCLE_R = 7;
// Padding around the drawn circles: enough for the hover enlargement and the
// selection stroke to stay inside the viewBox at every edge.
const PAD = CIRCLE_R + 6;
// Extra headroom on top for the "more competitive" label above the apex.
const PAD_TOP = CIRCLE_R + 24;
// The minimum distance the centreline must keep from the nearest rated seat, so
// a tie at the apex never touches the innermost Democrat or Republican. Two
// radii plus a hair.
const CLEAR = 2 * CIRCLE_R + 2;

// The signed index for a seat, or null when it carries none.
export function normalizeMetric(race) {
  return signedCpi(race?.partisan);
}

// "R+2.3", "D+1", "even", "unrated". Signed with Republican positive, matching
// the convention the lean labels and the slider already use.
export function metricLabel(value) {
  if (value == null) return 'unrated';
  if (value === 0) return 'even';
  const mag = Math.abs(value);
  const text = Number.isInteger(mag) ? String(mag) : String(Math.round(mag * 10) / 10);
  return `${value > 0 ? 'R' : 'D'}+${text}`;
}

function compareId(a, b) {
  const x = String(a?.race?.district_id ?? '');
  const y = String(b?.race?.district_id ?? '');
  return x < y ? -1 : x > y ? 1 : 0;
}

// Seat counts per arc, growing outward because the outer arcs are longer.
// Weighted linearly by radius and corrected so the rows sum to exactly n -- a
// chart that renders 119 of 120 seats is a bug that looks like a rounding error.
function allocate(n, rows) {
  const sizes = new Array(rows).fill(0);
  if (n <= 0) return sizes;
  if (n <= rows) {
    // A chamber with fewer seats than rows still stacks one per row rather than
    // dumping them all on the outermost arc.
    for (let i = 0; i < n; i++) sizes[i] = 1;
    return sizes;
  }
  const total = (rows * (rows + 1)) / 2;
  let assigned = 0;
  for (let i = 0; i < rows; i++) {
    sizes[i] = Math.max(1, Math.floor((n * (i + 1)) / total));
    assigned += sizes[i];
  }
  // Give or take the remainder on the outermost row, which has the most slack.
  sizes[rows - 1] = Math.max(1, sizes[rows - 1] + (n - assigned));
  return sizes;
}

function pushSide(slots, count, row, radius, gap, span, sign) {
  for (let j = 0; j < count; j++) {
    // Centre of each slot's cell, so the row is symmetric about the apex.
    const cell = (j + 0.5) / count;
    const angle = sign * (gap + cell * span);
    slots.push({ row, angle, radius, dist: Math.abs(angle) });
  }
}

// Two slots are ranked by angular distance from the vertical centreline first,
// then by row. That is the whole placement rule: the seat whose margin is
// closest to zero takes the slot closest to the centreline, and the safest seat
// on each side is pushed out to the horizontal edge.
function compareSlot(a, b) {
  return a.dist - b.dist || a.row - b.row;
}

function place(entry, side, angle, radius) {
  return {
    district_id: entry.race.district_id,
    race: entry.race,
    value: entry.value,
    side,
    angle,
    radius,
    x: radius * Math.sin(angle),
    y: -radius * Math.cos(angle),
  };
}

// Lay a chamber out. Returns absolute coordinates in a viewBox sized to the
// drawn seats, plus the counts the legend and the caption need.
export function layoutChamber(races) {
  const list = (races || []).map((race) => ({ race, value: normalizeMetric(race) }));

  // Sort each side by ascending absolute margin: the closest races are placed
  // first, and the slot list is already sorted nearest-centreline first, so the
  // two zip together and the most competitive seat sits central.
  const byMargin = (a, b) => Math.abs(a.value) - Math.abs(b.value) || compareId(a, b);
  const dem = list.filter((s) => s.value != null && s.value < 0).sort(byMargin);
  const rep = list.filter((s) => s.value != null && s.value > 0).sort(byMargin);
  // An exact tie is neither side. It runs down the centreline, between the two.
  const ties = list.filter((s) => s.value === 0).sort(compareId);
  // No index at all is a third state, kept apart rather than guessed into a
  // side. Unrated seats remain selectable and count toward the chamber total.
  const unrated = list.filter((s) => s.value == null).sort(compareId);

  const ratedCount = dem.length + rep.length + ties.length;
  let rows = Math.round(Math.sqrt(Math.max(1, ratedCount)) / 2.2);
  rows = Math.max(1, Math.min(9, rows));
  rows = Math.min(rows, Math.max(1, ratedCount));

  const demRows = allocate(dem.length, rows);
  const repRows = allocate(rep.length, rows);

  // Row radii are shared by both sides so the arcs stay concentric. A row is
  // pushed out far enough that its busier side clears at the minimum spacing,
  // and never closer to the row inside it than ROW_GAP.
  //
  // The apex gap grows as the row sits closer in, which shrinks the arc the row
  // has to fit its seats on -- so the radius has to satisfy the spacing using
  // the gap its own radius implies. A few passes settle it: the required radius
  // falls as the radius rises, so the sequence converges quickly.
  const radii = [];
  let previous = 0;
  for (let i = 0; i < rows; i++) {
    const maxCount = Math.max(demRows[i], repRows[i]);
    const floor = previous ? previous + ROW_GAP : R_MIN;
    let radius = Math.max(floor, R_MIN);
    if (maxCount > 1) {
      for (let iter = 0; iter < 8; iter++) {
        const gap = Math.max(MIN_GAP_RAD, Math.asin(Math.min(1, CLEAR / radius)));
        const needed = (SEAT_SPACING * maxCount) / (HALF_RAD - gap);
        if (needed <= radius + 0.01) break;
        radius = Math.max(floor, needed);
      }
    }
    radii.push(radius);
    previous = radius;
  }

  const demSlots = [];
  const repSlots = [];
  for (let i = 0; i < rows; i++) {
    const radius = radii[i];
    // Widen the apex gap just enough that the innermost seat on this row clears
    // the centreline by CLEAR at this radius, so a tie never sits on a party.
    const gap = Math.max(MIN_GAP_RAD, Math.asin(Math.min(1, CLEAR / radius)));
    const span = HALF_RAD - gap;
    pushSide(demSlots, demRows[i], i, radius, gap, span, -1);
    pushSide(repSlots, repRows[i], i, radius, gap, span, 1);
  }
  demSlots.sort(compareSlot);
  repSlots.sort(compareSlot);

  const seats = [];
  dem.forEach((entry, i) => demSlots[i] && seats.push(place(entry, 'D', demSlots[i].angle, demSlots[i].radius)));
  rep.forEach((entry, i) => repSlots[i] && seats.push(place(entry, 'R', repSlots[i].angle, repSlots[i].radius)));

  // Ties on the centreline, one per row, spilling outward if there are more
  // ties than rows. Zero angle is exactly between the two party halves.
  ties.forEach((entry, i) => {
    const radius = i < radii.length
      ? radii[i]
      : radii[radii.length - 1] + ROW_GAP * (i - radii.length + 1);
    seats.push(place(entry, 'T', 0, radius));
  });

  // Unrated seats are a separate neutral group, set on their own line beneath
  // the arc rather than mixed into the ordering they have no value for.
  if (unrated.length) {
    const arcBottom = seats.length ? Math.max(...seats.map((s) => s.y)) : 0;
    const stripY = arcBottom + ROW_GAP + CIRCLE_R;
    unrated.forEach((entry, i) => {
      const x = (i - (unrated.length - 1) / 2) * SEAT_SPACING;
      seats.push({
        district_id: entry.race.district_id,
        race: entry.race,
        value: null,
        side: 'U',
        angle: 0,
        radius: 0,
        x,
        y: stripY,
      });
    });
  }

  // Size the viewBox to the drawn seats, so a 14-seat chamber is not marooned in
  // a 120-seat canvas and no circle is ever clipped.
  const xs = seats.map((s) => s.x);
  const ys = seats.map((s) => s.y);
  const minX = (xs.length ? Math.min(...xs) : 0) - PAD;
  const maxX = (xs.length ? Math.max(...xs) : 0) + PAD;
  const minY = (ys.length ? Math.min(...ys) : 0) - PAD_TOP;
  const maxY = (ys.length ? Math.max(...ys) : 0) + PAD;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  for (const seat of seats) {
    seat.x -= minX;
    seat.y -= minY;
  }

  return {
    seats,
    width,
    height,
    metric: METRIC_LABEL,
    counts: {
      total: list.length,
      dem: dem.length,
      rep: rep.length,
      ties: ties.length,
      unrated: unrated.length,
    },
  };
}
