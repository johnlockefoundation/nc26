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

// Angular half-width each side spans. The two party arcs run from the
// centreline out toward this limit and both reach it, so every row ends on the
// same baseline and the chamber reads as a semicircle rather than two sloping
// blocks -- a full right angle would plant the outermost seats exactly on the
// baseline, and a hair under keeps them just above it.
const HALF_RAD = (89 * Math.PI) / 180;

const CIRCLE_R = 7;

// The minimum distance between two seat centres, chord length not arc length.
// Seats are 14 SVG units across, and the emphasis rings drawn over a selected
// or vulnerable seat are centered on the circle edge and reach 1.5 units past
// it (stroke-width 3 selection outline), so two seats whose centres are 17
// units apart just keep their outlines from touching: 2 * (7 + 1.5).
const MIN_DIST = 17;

// Headroom around the drawn circles so a selection stroke is never clipped.
const PAD = 9;

// A chamber's innermost row must hold at least this many seats per side, so the
// apex is an arc of members rather than one stranded dot on each flank.
const MIN_INNER = 4;

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

// ----- Row model ------------------------------------------------------------

// Two seats at angles a apart on a row of radius r are MIN_DIST apart when
//   chord = 2 r sin(a / 2) = MIN_DIST
// so the angular interval that guarantees a row's own clearance is the
// inverse-chord form, not arc length divided by radius.
function interval(r) {
  return 2 * Math.asin(Math.min(1, MIN_DIST / (2 * r)));
}

// How many seats one side of a row can hold before its spacing would dip under
// the minimum. The row reserves room for its centreline: on a row a tie
// occupies, the nearest party seat starts one full interval out (the tie sits
// at zero); on a tie-free row the nearest left and right seats sit about half
// an interval from the centreline, which is exactly MIN_DIST apart chords.
function arcCapacity(r, tied, staggered) {
  const iv = interval(r);
  const off = (tied ? 1 : 0.5) * iv;
  const span = HALF_RAD - off;
  // A staggered row steps its seats out by half an increment, which costs half
  // an interval of span; capacity compensates so a stagger never squeezes a
  // row below the minimum spacing.
  return Math.max(1, staggered ? Math.floor(span / iv + 0.5) : Math.floor(span / iv) + 1);
}

// Angular step between neighbours on a side, sized so the whole side fills the
// arc from its centreline offset out to HALF_RAD. A staggered row's first seat
// sits half a step further out, so there is half the span left for the other
// seats -- hence the minus 0.5.
function arcStep(r, count, centreOffset, staggered) {
  if (count <= 1) return 0;
  const span = HALF_RAD - centreOffset;
  return staggered ? span / (count - 0.5) : span / (count - 1);
}

function sum(a, b) {
  return a + b;
}

// Row radii, per-row capacity and which rows hold what, solved together.
//
// Radii sit one MIN_DIST apart so consecutive arcs clear each other radially,
// and the innermost radius is grown until every side of the chamber fits. The
// arc count is staked low (six for the House, four for the Senate): a chamber
// split across too many thin rows reads as rings, not a room. Counting by
// capacity instead of by row index is the whole fix for the old sloping
// blocks -- a row's share of seats is its share of usable arc length, radius
// included, so the inner rows get the arcs the old allocation starved.
function rowModel(ratedDem, ratedRep, ties) {
  const rated = ratedDem + ratedRep + ties;
  let rows = rated > 100 ? 6 : 4;
  rows = Math.max(1, Math.min(rows, rated));

  // The innermost "recognisable arc" demand can be loosened for a chamber too
  // small or too lopsided to hold one; real chambers never relax.
  for (let relax = 0; relax <= 2 && rows >= 2; relax++) {
    const inner = Math.max(1, MIN_INNER - relax);
    const found = solve(rows, ties, inner, Math.max(ratedDem, ratedRep));
    if (found) return found;
  }
  // No radius fits within the ceiling -- hand back a single-row fallback that
  // still distributes every seat.
  return solve(1, ties, 1, Math.max(ratedDem, ratedRep));
}

function solve(rows, ties, innerFloor, need) {
  // Ties live in the central band: the innermost rows, one per row. A row that
  // carries a tie reserves its centreline; a staggered row is one in every two
  // above the bottom, never one holding a tie.
  const tieRows = new Set();
  for (let k = 0; k < Math.min(ties, rows); k++) tieRows.add(k);
  const staggered = (i) => i % 2 === 1 && !tieRows.has(i);

  for (let r0 = MIN_DIST; r0 <= 180; r0++) {
    const radii = Array.from({ length: rows }, (_, i) => r0 + i * MIN_DIST);
    const caps = radii.map((r, i) => arcCapacity(r, tieRows.has(i), staggered(i)));
    if (caps.reduce(sum, 0) < need) continue;
    if (arcCapacity(radii[0], tieRows.has(0), staggered(0)) < innerFloor) continue;
    return { rows, radii, caps, tieRows, staggered };
  }
  return null;
}

// Split a side's total across rows by largest remainder, weighted by each row's
// arc capacity, so the counts sum exactly and every row stays within what it
// can hold.
function allocate(n, caps) {
  const sizes = new Array(caps.length).fill(0);
  if (n <= 0) return sizes;
  const total = caps.reduce(sum, 0) || 1;
  const frac = [];
  let assigned = 0;
  for (let i = 0; i < caps.length; i++) {
    const raw = (n * caps[i]) / total;
    sizes[i] = Math.floor(raw);
    frac.push([raw - sizes[i], i]);
    assigned += sizes[i];
  }
  frac.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < n - assigned; k++) sizes[frac[k % frac.length][1]] += 1;
  return sizes;
}

// ----- Slotting and placement ------------------------------------------------

// A slot on one side of some row: angular distance from the centreline first,
// then row, so the most competitive seat takes the slot nearest the centre
// regardless of which row it lands in.
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

function pushSide(slots, side, count, row, radius, centreOffset, sign, staggered) {
  const step = arcStep(radius, count, centreOffset, staggered);
  for (let j = 0; j < count; j++) {
    // A staggered row starts half a step out; otherwise the first seat sits
    // against the centreline offset and the rest march to HALF_RAD.
    const angle = sign * (centreOffset + (staggered ? step / 2 : 0) + j * step);
    slots.push({ row, angle, radius, dist: Math.abs(angle) });
  }
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

  // Geometry first, districts second. Lay out every seat's slot from the data's
  // raw counts, then zip districts onto slots.
  const model = rowModel(dem.length, rep.length, ties.length);
  const demRows = allocate(dem.length, model.caps);
  const repRows = allocate(rep.length, model.caps);

  const demSlots = [];
  const repSlots = [];
  for (let i = 0; i < model.rows; i++) {
    const radius = model.radii[i];
    const tied = model.tieRows.has(i);
    const centreOffset = (tied ? 1 : 0.5) * interval(radius);
    pushSide(demSlots, 'D', demRows[i], i, radius, centreOffset, -1, model.staggered(i));
    pushSide(repSlots, 'R', repRows[i], i, radius, centreOffset, 1, model.staggered(i));
  }
  demSlots.sort(compareSlot);
  repSlots.sort(compareSlot);

  const seats = [];
  dem.forEach((entry, i) => demSlots[i] && seats.push(place(entry, 'D', demSlots[i].angle, demSlots[i].radius)));
  rep.forEach((entry, i) => repSlots[i] && seats.push(place(entry, 'R', repSlots[i].angle, repSlots[i].radius)));

  // Ties ride the normal row structure: one on each innermost row, at angle
  // zero, spilling to ever-larger radii if a chamber somehow carries more ties
  // than rows.
  ties.forEach((entry, i) => {
    const radius = i < model.radii.length
      ? model.radii[i]
      : model.radii[model.radii.length - 1] + MIN_DIST * (i - model.radii.length + 1);
    seats.push(place(entry, 'T', 0, radius));
  });

  // Unrated seats are a separate neutral group, set on their own line beneath
  // the arc rather than mixed into the ordering they have no value for.
  if (unrated.length) {
    const arcBottom = seats.length ? Math.max(...seats.map((s) => s.y)) : 0;
    const stripY = arcBottom + MIN_DIST + CIRCLE_R;
    unrated.forEach((entry, i) => {
      const x = (i - (unrated.length - 1) / 2) * MIN_DIST;
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
  const minY = (ys.length ? Math.min(...ys) : 0) - PAD;
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