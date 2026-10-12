// Layout for the General Assembly chambers: evenly spaced rows of circles,
// tapered along a semicircle.
//
// Every seat sits on the same lattice: rows at a fixed vertical pitch, and
// within a row a fixed horizontal pitch. A row's length is the chord of a
// semicircle at that row's height -- sqrt(radius² - y²) cells wide on each
// side -- so the bottom row is the longest, rows shrink toward the top, and
// the outer edges of the drawn rows trace the arc. Because spacing never
// changes, no row ever has to "reach" a boundary it can't, and a side with
// fewer seats simply stops short of the arc at the far end of its rows; every
// gap between drawn circles is identical, which is the one thing a chamber
// chart must not fake.
//
// Democratic seats fill each row from the centre column outward on the left,
// Republicans from the centre outward on the right, and a tie sits on the
// centre column itself. So the closest races of each party stack down the
// middle and the safest sit at the row ends -- competitive seats central, the
// same ordering promise the map makes.
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

// Rows per chamber. Eight for the House, six for the Senate -- neither so tall
// that the apex releases into a point, nor so low that the sweep reads as a
// rectangle. A tiny fixture scales the row count down with its size.
function rowsFor(rated) {
  if (rated > 100) return 8;
  if (rated > 20) return 6;
  return Math.max(1, Math.ceil(rated / 6));
}

// How many cells one side of a row holds: the chord of the semicircle radius K
// at that row's height above the baseline. Row t (0 = apex) is d = rows-1-t
// above the bottom row, so its half-width is floor(sqrt(K² - d²)) cells.
function halfWidths(rows, radius) {
  return Array.from({ length: rows }, (_, t) => {
    const d = rows - 1 - t;
    return Math.floor(Math.sqrt(radius * radius - d * d));
  });
}

// Smallest radius whose per-side capacity fits the larger party. The real
// chambers resolve to K=11 (House) and K=7 (Senate) and never change.
function findRadius(rows, need) {
  for (let K = Math.max(1, rows); K <= rows + 12; K++) {
    if (halfWidths(rows, K).reduce((a, b) => a + b, 0) >= need) return K;
  }
  return rows + 12;
}

// Distribute a side's total across the rows in proportion to each row's
// half-width, largest remainder, so the silhouette of a side keeps the arc's
// proportions no matter how many of its seats are real.
function allocateProportional(total, h) {
  const sizes = new Array(h.length).fill(0);
  if (total <= 0) return sizes;
  const sum = h.reduce((a, b) => a + b, 0) || 1;
  const frac = [];
  let assigned = 0;
  for (let i = 0; i < h.length; i++) {
    const raw = (total * h[i]) / sum;
    sizes[i] = Math.floor(raw);
    frac.push([raw - sizes[i], i]);
    assigned += sizes[i];
  }
  frac.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < total - assigned; k++) sizes[frac[k % frac.length][1]] += 1;
  return sizes;
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

  const rated = dem.length + rep.length + ties.length;
  const rows = rowsFor(rated);
  const radius = findRadius(rows, Math.max(dem.length, rep.length));
  const h = halfWidths(rows, radius);
  // Centre column at K: cells run 0..2K, ties occupy K, D take K-1 downward
  // and R take K+1 upward, so the seam is one fixed gutter down the middle.
  const demRows = allocateProportional(dem.length, h);
  const repRows = allocateProportional(rep.length, h);

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