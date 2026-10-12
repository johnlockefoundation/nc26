// Assign districts to a chamber's fixed seating template.
//
// The chamber geometry lives in chamberTemplates.js: 120 absolute positions
// for the House, 50 for the Senate, arranged as concentric curved rows around
// an open floor, generated once and committed. Nothing here solves or reshapes
// the chamber. The runtime only places districts into those existing slots,
// and the slot coordinates never change whichever way the lean data moves --
// a re-run with different numbers repaints the same seats at the same places
// with different colours.
//
// The placement rule keeps the chart's one promise, that a seat's position
// answers "how competitive": the races nearest the vertical centreline sit on
// the slots nearest the vertical centreline. Ties (a lean of exactly zero) are
// the closest races of all and take the nearest available central slots.
// Democratic-leaning seats take the chamber's left half first (closest to the
// centreline outward) and Republican-leaning seats take the right half the same
// way. A party with more districts than its half has slots spills outward into
// the outermost slots of the other side -- never into the centre -- so an
// unequal count keeps every district seated without changing the silhouette.
// Unrated races (no Civitas index) still occupy a slot -- the outer ones left
// after the others are seated -- and render with an explicit unrated
// treatment, because a missing metric is not a missing seat.
import { HOUSE_TEMPLATE, SENATE_TEMPLATE } from './chamberTemplates.js';
import { signedCpi } from './vulnerability.js';

// What the arrangement is by. Shown to the reader in the caption so the chart
// cannot be mistaken for a geographic one.
export const METRIC_LABEL = 'partisan lean';

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

export const TEMPLATES = { state_house: HOUSE_TEMPLATE, state_senate: SENATE_TEMPLATE };

function proxOf(seat, cx) {
  return Math.abs(seat.x - cx);
}

// Pool orders for the fixed slots.
//
// Each party gets one half of the chamber: `sideOrder` sorts the slots on that
// side of the centreline closest-first (dx, then lower rows before higher), so
// the party's closest races land nearest the centreline and its safest races
// end up in the row ends. `centralOrder` spans every slot by distance from the
// centreline and hands equal-distance slots to the left first; ties take from
// it, which puts them on the centre's apex seats.
function sideOrder(positions, cx, side) {
  return positions
    .map((p, idx) => ({ p, idx }))
    .filter((o) => (side === 'left' ? o.p.x < cx : o.p.x > cx))
    .sort((a, b) => Math.abs(a.p.x - cx) - Math.abs(b.p.x - cx) || a.p.y - b.p.y || a.idx - b.idx);
}

function centralOrder(positions, cx) {
  return positions
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => {
      const dx = Math.abs(a.p.x - cx) - Math.abs(b.p.x - cx);
      if (dx) return dx;
      const sd = a.p.x - b.p.x;
      if (sd) return sd;
      const dy = a.p.y - b.p.y;
      if (dy) return dy;
      return a.idx - b.idx;
    });
}

// Place every race on the chamber's fixed slots. `chamber` selects which
// template ('state_house' / 'state_senate'); anything else is treated as the
// House so a caller that forgets the argument still gets a 120-seat chamber.
export function layoutChamber(races, chamber) {
  const template = TEMPLATES[chamber] || HOUSE_TEMPLATE;
  const { seats: positions, width, height } = template;
  const cx = width / 2;
  const list = (races || []).map((race) => ({ race, value: normalizeMetric(race) }));

  // Within a side, ascending absolute margin (district id as the deterministic
  // tie-breaker) so the closest races are placed in the slots closest to the
  // centreline below.
  const byMargin = (a, b) => Math.abs(a.value) - Math.abs(b.value) || compareId(a, b);
  const ties = list.filter((s) => s.value === 0).sort(compareId);
  const dem = list.filter((s) => s.value != null && s.value < 0).sort(byMargin);
  const rep = list.filter((s) => s.value != null && s.value > 0).sort(byMargin);
  const unrated = list.filter((s) => s.value == null).sort(compareId);

  const left = sideOrder(positions, cx, 'left');
  const right = sideOrder(positions, cx, 'right');
  const central = centralOrder(positions, cx);

  const used = new Set();
  const firstFree = (order) => {
    for (const o of order) if (!used.has(o.idx)) return o;
    return null;
  };

  const seats = [];
  const place = (entry, side, o, prox) => {
    used.add(o.idx);
    seats.push({
      district_id: entry.race.district_id,
      race: entry.race,
      value: entry.value,
      side,
      x: positions[o.idx].x,
      y: positions[o.idx].y,
      row: positions[o.idx].row,
      slot: positions[o.idx],
      prox,
    });
  };

  // Ties take the front-row apex seats: the nearest available central slots.
  ties.forEach((entry) => {
    const o = firstFree(central);
    if (o) place(entry, 'T', o, proxOf(positions[o.idx], cx));
  });

  // Each party takes its own half closest-first. When it has more districts
  // than its half has slots, the surplus spills into whatever slots remain,
  // outermost first, so the safest contests end up on the row ends and the
  // back of the centreline rather than thinning the middle. Slots exactly on
  // the centreline are the innermost of all, so they sort last in the spill.
  const fill = (entries, side) => {
    const own = side === 'D' ? left : right;
    const spill = positions
      .map((p, idx) => ({ p, idx }))
      .filter((o) => !own.some((w) => w.idx === o.idx) && !used.has(o.idx))
      .sort((a, b) => Math.abs(b.p.x - cx) - Math.abs(a.p.x - cx) || b.p.y - a.p.y || b.idx - a.idx);
    entries.forEach((entry) => {
      const o = firstFree(own) || firstFree(spill);
      if (o) place(entry, side, o, proxOf(positions[o.idx], cx));
    });
  };
  fill(dem, 'D');
  fill(rep, 'R');

  unrated.forEach((entry) => {
    const o = firstFree(central);
    if (o) place(entry, 'U', o, proxOf(positions[o.idx], cx));
  });

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