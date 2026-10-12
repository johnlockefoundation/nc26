// Layout for the General Assembly chambers: evenly spaced rows of circles,
// tapered along a semicircle.
//
// Every seat sits on the same lattice: rows at a fixed vertical pitch, and
// within a row a fixed horizontal pitch. The grid spans the whole semicircle:
// the bottom row is the full diameter and rows shrink toward the top, each
// row's length the chord of the arc at its height -- sqrt(radius² - y²) cells
// wide on each side -- so the outer edges of the drawn rows trace the arc.
// Because spacing never changes, no row ever has to "reach" a boundary it
// can't, and a side with fewer seats simply stops short of the arc at the far
// end of its rows; every gap between drawn circles is identical, which is the
// one thing a chamber chart must not fake.
//
// Democratic seats fill each row from the centre column outward on the left,
// Republicans from the centre outward on the right, and a tie sits on the
// centre column itself, nearest the apex. Seats are shared across rows by
// filling the base rows to the arc first, so the dome is a solid, smoothly
// stepping staircase whatever the party counts; the closest races of each
// party stack down the middle and the safest sit at the row ends --
// competitive seats central, the same ordering promise the map makes.
//
// The chamber is sized from its real fixed roster (120 House seats, 50 Senate)
// by choosing a radius big enough that every side fits; nothing else is solved.
import { signedCpi } from './vulnerability.js';

// What the arrangement is by. Shown to the reader in the caption so the chart
// cannot be mistaken for a geographic one.
export const METRIC_LABEL = 'partisan lean';

// Lattice pitch in both axes. Circles are 7 units and the selection/vulnerability
// strokes reach 1.5 past the rim, so two centres need to stay at least 17
// apart; 20 keeps that with clean uniform gaps everywhere.
const CELL = 20;

// Headroom around the drawn circles so a selection stroke is never clipped.
const PAD = 9;

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

// ----- The semicircle sheet ---------------------------------------------------

// How many cells one side of a row holds: the chord of the semicircle radius K
// at y units above the base, floor'd so a seat cell never hangs off the arc.
// Row t (0 = apex, the narrow top) sits y = rows-1-t above the base, so the
// base row is the full diameter and the top row is the last place the arc
// still reaches.
function halfWidths(rows, radius) {
  return Array.from({ length: rows }, (_, t) => {
    const y = rows - 1 - t;
    return Math.max(0, Math.floor(Math.sqrt(radius * radius - y * y)));
  });
}

// The chamber grid spans the whole semicircle: rows = radius, one row per unit
// of height, so the base row is the diameter and the rows taper up to the
// arc's last cell. That full span -- not a band taken from the middle of the
// circle -- is what makes the silhouette read as a dome; a handful of rows all
// at similar chord lengths reads as a rectangle. The radius is the smallest
// one whose per-side capacity fits the larger party (K=10 for the House, K=7
// for the Senate, and never changes).
function sheetFor(need) {
  for (let radius = 1; radius <= need + 1; radius++) {
    const h = halfWidths(radius, radius);
    if (h.reduce((a, b) => a + b, 0) >= need) return { rows: radius, radius, h };
  }
  const radius = need + 1;
  return { rows: radius, radius, h: halfWidths(radius, radius) };
}

// Share a side's total across the rows by filling the base rows to the arc
// first, so the dome's lower storeys are solid and the silhouette tapers
// smoothly instead of waving with the party's exact count. A side with fewer
// seats simply stops partway up the dome.
function allocateStairs(total, h) {
  const out = new Array(h.length).fill(0);
  let left = total;
  for (let t = h.length - 1; t >= 0 && left > 0; t--) {
    out[t] = Math.min(h[t], left);
    left -= out[t];
  }
  return out;
}

// Lay a chamber out. Returns absolute coordinates in a viewBox that always
// spans the full arc (so the silhouette is a stable semicircle whatever the
// party counts), plus the counts the legend and the caption need.
export function layoutChamber(races) {
  const list = (races || []).map((race) => ({ race, value: normalizeMetric(race) }));

  // Sort each side by ascending absolute margin, district id as the
  // deterministic tie-breaker, so the closest races are placed in the slots
  // nearest the centre seam below.
  const byMargin = (a, b) => Math.abs(a.value) - Math.abs(b.value) || compareId(a, b);
  const dem = list.filter((s) => s.value != null && s.value < 0).sort(byMargin);
  const rep = list.filter((s) => s.value != null && s.value > 0).sort(byMargin);
  const ties = list.filter((s) => s.value === 0).sort(compareId);
  const unrated = list.filter((s) => s.value == null).sort(compareId);

  const { rows, radius, h } = sheetFor(Math.max(dem.length, rep.length));
  // Centre column at K: cells run 0..2K, ties occupy K, D take K-1 downward
  // and R take K+1 upward, so the seam is one fixed gutter down the middle.
  const demRows = allocateStairs(dem.length, h);
  const repRows = allocateStairs(rep.length, h);

  // Slots are ordered by distance from the centre seam, then by row, so the
  // most competitive seats stack down the column next to the middle and the
  // safest seats sit at the row ends.
  const demSlots = [];
  const repSlots = [];
  for (let t = 0; t < rows; t++) {
    for (let k = 0; k < demRows[t]; k++) demSlots.push({ row: t, col: radius - 1 - k, dist: k });
    for (let k = 0; k < repRows[t]; k++) repSlots.push({ row: t, col: radius + 1 + k, dist: k });
  }
  demSlots.sort((a, b) => a.dist - b.dist || a.row - b.row);
  repSlots.sort((a, b) => a.dist - b.dist || a.row - b.row);

  const place = (entry, side, col, row, dist) => ({
    district_id: entry.race.district_id,
    race: entry.race,
    value: entry.value,
    side,
    col,
    row,
    dist,
    x: (col - radius) * CELL,
    y: row * CELL,
  });

  const seats = [];
  dem.forEach((entry, i) => demSlots[i] && seats.push(place(entry, 'D', demSlots[i].col, demSlots[i].row, demSlots[i].dist)));
  rep.forEach((entry, i) => repSlots[i] && seats.push(place(entry, 'R', repSlots[i].col, repSlots[i].row, repSlots[i].dist)));

  // Ties on the centre line, apex rows first, sorted by district id.
  ties.forEach((entry, i) => seats.push(place(entry, 'T', radius, Math.min(i, rows - 1), 0)));

  // Unrated seats are a separate neutral group, set on their own line beneath
  // the arc rather than mixed into the ordering they have no value for.
  if (unrated.length) {
    const stripY = (rows - 1) * CELL + 2 * CELL;
    unrated.forEach((entry, i) => {
      const x = (i - (unrated.length - 1) / 2) * CELL;
      seats.push({ ...place(entry, 'U', radius, rows - 1, 0), x, y: stripY });
    });
  }

  // The canvas spans the full chord and all rows so the semicircle keeps its
  // silhouette even when a side has plenty of cells to spare.
  const minX = -radius * CELL - PAD;
  const maxX = radius * CELL + PAD;
  let minY = -PAD;
  let maxY = (rows - 1) * CELL + PAD;
  if (unrated.length) maxY = Math.max(maxY, Math.max(...seats.map((s) => s.y)) + PAD);
  const width = maxX - minX;
  const height = maxY - minY;
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