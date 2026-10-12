// Tests for the seated-chamber assignment. Run with:
//   node src/lib/seatLayout.test.mjs
//
// Node's built-in assert and test runner only; the frontend has no test
// framework and this is pure arithmetic, so a browser is not needed. The point
// is the contract from the spec: the chambers are fixed templates of 120 and
// 50 absolute positions; every district is placed exactly once; slots never
// move with the lean data; the closest races sit nearest the vertical
// centreline, ties on the centre itself, unrated keep a slot; and the two
// real rosters fit their chambers with no overlaps and nothing clipped.
//
// Rendering is checked separately, by serving the page and photographing it --
// the geometry has failed visually before while passing arithmetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { layoutChamber, metricLabel, normalizeMetric } from './seatLayout.js';
import { HOUSE_TEMPLATE, SENATE_TEMPLATE } from './chamberTemplates.js';

const here = dirname(fileURLToPath(import.meta.url));

function race(id, value, party) {
  return {
    district_id: id,
    partisan: value == null ? { available: false } : { available: true, party, value: Math.abs(value) },
  };
}

function makeRaces(n, { demRatio = 0.5, ties = 0, unrated = 0 } = {}) {
  const races = [];
  const base = n - ties - unrated;
  const demCount = Math.round(base * demRatio);
  for (let i = 0; i < base; i++) {
    const dem = i < demCount;
    // Magnitudes 1..n so ties and equal margins both occur.
    const value = dem ? -(1 + (i % 20)) : 1 + (i % 20);
    races.push(race(`D-${i}`, value, dem ? 'D' : 'R'));
  }
  for (let i = 0; i < ties; i++) races.push(race(`T-${i}`, 0, i % 2 ? 'D' : 'R'));
  for (let i = 0; i < unrated; i++) races.push(race(`U-${i}`, null));
  return races;
}

function realRaces(file) {
  const path = resolve(here, '../../public/data/reference/map', `${file}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')).races;
}

test('normalizeMetric reads the signed index and nothing else', () => {
  assert.equal(normalizeMetric({ partisan: { available: true, party: 'R', value: 3 } }), 3);
  assert.equal(normalizeMetric({ partisan: { available: true, party: 'D', value: 3 } }), -3);
  assert.equal(normalizeMetric({ partisan: { available: true, party: 'R', value: 0 } }), 0);
  assert.equal(normalizeMetric({ partisan: { available: false } }), null);
  assert.equal(normalizeMetric({}), null);
});

test('metricLabel names the side, the feed and the tie', () => {
  assert.equal(metricLabel(3), 'R+3');
  assert.equal(metricLabel(-4), 'D+4');
  assert.equal(metricLabel(0), 'even');
  assert.equal(metricLabel(null), 'unrated');
});

test('the templates are exact: 120 House seats, 50 Senate seats', () => {
  assert.equal(HOUSE_TEMPLATE.seats.length, 120);
  assert.equal(SENATE_TEMPLATE.seats.length, 50);
  for (const t of [HOUSE_TEMPLATE, SENATE_TEMPLATE]) {
    for (const s of t.seats) {
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), 'positions are finite');
      assert.ok(s.x >= 0 && s.x <= t.width, `x in viewBox (${s.x})`);
      assert.ok(s.y >= 0 && s.y <= t.height, `y in viewBox (${s.y})`);
    }
    // Every seat has a mate mirrored across the centreline.
    const cx = t.width / 2;
    const seen = new Set(t.seats.map((s) => `${+s.x.toFixed(3)},${+s.y.toFixed(3)}`));
    for (const s of t.seats) {
      assert.equal(seen.has(`${+((cx - (s.x - cx))).toFixed(3)},${+s.y.toFixed(3)}`), true,
        `mirror of (${s.x},${s.y}) exists`);
    }
  }
});

test('no two template positions overlap and each row is an even arc', () => {
  for (const [t, label] of [[HOUSE_TEMPLATE, 'house'], [SENATE_TEMPLATE, 'senate']]) {
    for (let i = 0; i < t.seats.length; i++) {
      for (let j = i + 1; j < t.seats.length; j++) {
        const d = Math.hypot(t.seats[i].x - t.seats[j].x, t.seats[i].y - t.seats[j].y);
        assert.ok(d >= 24, `${label}: positions ${i} and ${j} only ${d.toFixed(2)} apart`);
      }
    }
    // Seats sit at an even angular pitch, so adjacent in-row gaps are equal.
    const byRow = new Map();
    for (const s of t.seats) {
      if (!byRow.has(s.row)) byRow.set(s.row, []);
      byRow.get(s.row).push(s);
    }
    for (const [row, rowSeats] of byRow) {
      rowSeats.sort((a, b) => a.x - b.x);
      const gaps = rowSeats.slice(1).map((s, i) => +Math.hypot(s.x - rowSeats[i].x, s.y - rowSeats[i].y).toFixed(2));
      const first = gaps[0];
      for (const g of gaps) assert.ok(Math.abs(g - first) < 1e-9, `${label} row ${row}: even pitch (${gaps.join(',')})`);
    }
  }
});

test('every row shares the common baseline and has its apex on the centreline', () => {
  for (const t of [HOUSE_TEMPLATE, SENATE_TEMPLATE]) {
    const cx = t.width / 2;
    const maxY = Math.max(...t.seats.map((s) => s.y));
    const byRow = new Map();
    for (const s of t.seats) {
      if (!byRow.has(s.row)) byRow.set(s.row, []);
      byRow.get(s.row).push(s);
    }
    for (const [row, rowSeats] of byRow) {
      const outer = rowSeats.reduce((a, s) => (Math.abs(s.x - cx) > Math.abs(a.x - cx) ? s : a));
      assert.ok(Math.abs(outer.y - maxY) < 1e-6, `row ${row} lands on the baseline`);
      const apex = rowSeats.reduce((a, s) => (Math.abs(s.x - cx) < Math.abs(a.x - cx) ? s : a));
      assert.ok(Math.abs(apex.x - cx) < 1e-6, `row ${row} has a seat on the centreline`);
    }
  }
});

test('the floor under the front row stays open', () => {
  for (const [t, gap] of [[HOUSE_TEMPLATE, 20], [SENATE_TEMPLATE, 20]]) {
    const cx = t.width / 2;
    const floorY = Math.max(...t.seats.map((s) => s.y)); // the common baseline
    let nearest = 1e9;
    for (const s of t.seats) nearest = Math.min(nearest, Math.hypot(s.x - cx, s.y - floorY));
    assert.ok(nearest >= gap, `nothing sits in the floor (nearest ${nearest.toFixed(1)})`);
  }
});

test('the arrangement hits the template, whatever the data: counts, positions, ids', () => {
  for (const [chamber, template, total] of [['state_house', HOUSE_TEMPLATE, 120], ['state_senate', SENATE_TEMPLATE, 50]]) {
    const races = makeRaces(total, { ties: chamber === 'state_house' ? 3 : 2, unrated: 3 });
    const { seats, counts, width, height } = layoutChamber(races, chamber);
    assert.equal(seats.length, total);
    assert.equal(width, template.width);
    assert.equal(height, template.height);
    assert.equal(counts.total, total);
    const ids = new Set(seats.map((s) => s.district_id));
    assert.equal(ids.size, total, 'every district placed once');
    const positions = seats.map((s) => `${+s.x.toFixed(3)},${+s.y.toFixed(3)}`).sort((a, b) => a.localeCompare(b));
    const templatePos = template.seats.map((s) => `${+s.x.toFixed(3)},${+s.y.toFixed(3)}`).sort((a, b) => a.localeCompare(b));
    assert.deepEqual(positions, templatePos, 'the seat set is exactly the template');
  }
});

test('the two real chambers place their full rosters', () => {
  for (const [file, chamber, total] of [['state_house', 'state_house', 120], ['state_senate', 'state_senate', 50]]) {
    const races = realRaces(file);
    if (!races) continue;
    const { seats, counts } = layoutChamber(races, chamber);
    assert.equal(seats.length, total, `${file} total`);
    assert.equal(counts.total, races.length, `${file} counted`);
    const ids = new Set(seats.map((s) => s.district_id));
    assert.equal(ids.size, seats.length, `${file} unique`);
  }
});

test('closest races sit nearest the centreline, in both directions', () => {
  // One party spilling (a single-sided surplus) must not disturb the promise
  // that the other side's own-half seats step outward with their margin. The
  // real rosters are exactly that case: one side is at capacity plus overflow.
  const cases = [
    ['state_house', HOUSE_TEMPLATE, 120, 0.25],  // 30 D / 87 R: R spills
    ['state_senate', SENATE_TEMPLATE, 50, 0.3],   // 12 D / 36 R: R spills
  ];
  for (const [chamber, template, total, demRatio] of cases) {
    const cx = template.width / 2;
    const cap = { D: template.seats.filter((s) => s.x < cx).length, R: template.seats.filter((s) => s.x > cx).length };
    const { seats } = layoutChamber(makeRaces(total, { demRatio, ties: 2 }), chamber);
    for (const side of ['D', 'R']) {
      const onSide = seats.filter((s) => s.side === side);
      const prefix = [...onSide].sort((a, b) => Math.abs(a.value) - Math.abs(b.value)).slice(0, cap[side]);
      for (let i = 1; i < prefix.length; i++) {
        assert.ok(prefix[i].prox >= prefix[i - 1].prox - 1e-9, `${chamber} ${side}: prox monotonic over the own half`);
      }
    }
  }
});

test('each party keeps its own half: D left, R right, spill only on the rim', () => {
  for (const [file, chamber, template] of [['state_house', 'state_house', HOUSE_TEMPLATE], ['state_senate', 'state_senate', SENATE_TEMPLATE]]) {
    const races = realRaces(file);
    if (!races) continue;
    const cx = template.width / 2;
    const { seats } = layoutChamber(races, chamber);
    const rightCap = template.seats.filter((s) => s.x > cx).length;
    const ds = seats.filter((s) => s.side === 'D');
    const rs = seats.filter((s) => s.side === 'R');
    assert.ok(ds.length > 0 && rs.length > 0, `${file} has both parties`);
    for (const s of ds) assert.ok(s.x < cx, `${file}: every D seat on the left half (${s.district_id} at ${s.x})`);
    assert.equal(rs.filter((s) => s.x > cx).length, rightCap, `${file}: R fills its own half first`);
    const rightMedian = rs.filter((s) => s.x > cx).map((s) => s.prox).sort((a, b) => a - b)[Math.floor(rightCap / 2)];
    const spill = rs.filter((s) => s.x < cx);
    assert.ok(spill.every((s) => s.prox > rightMedian), `${file}: R spill seats sit further out than its own-half median`);
    for (const s of spill) assert.ok(s.x < cx, `${file}: spill seats are on the outer left rim, off the centreline`);
  }
});

test('exact ties take the nearest available central seats', () => {
  for (const [chamber, ties, total] of [['state_house', 3, 120], ['state_senate', 2, 50]]) {
    const { seats, counts } = layoutChamber(makeRaces(total, { ties, unrated: 4 }), chamber);
    const ts = seats.filter((s) => s.side === 'T');
    assert.equal(ts.length, ties);
    for (const t of ts) assert.equal(t.prox, 0, `${chamber}: ${t.district_id} on the vertical centreline`);
    assert.equal(counts.ties, ties);
    assert.equal(counts.unrated, 4);
  }
});

test('co-ordinates never move when the lean distribution changes', () => {
  for (const [chamber, total] of [['state_house', 120], ['state_senate', 50]]) {
    const a = makeRaces(total, { ties: 3, unrated: 2 });
    const b = makeRaces(total, { ties: 3, unrated: 2, demRatio: 0.7 });
    const posA = layoutChamber(a, chamber).seats.map((s) => `${+s.x.toFixed(3)},${+s.y.toFixed(3)}`).sort();
    const posB = layoutChamber(b, chamber).seats.map((s) => `${+s.x.toFixed(3)},${+s.y.toFixed(3)}`).sort();
    assert.deepEqual(posA, posB, `${chamber}: positions identical across lean counts`);
  }
});

test('a one-party chamber still places everyone on the same silhouette', () => {
  const template = HOUSE_TEMPLATE;
  const races = Array.from({ length: 50 }, (_, i) => race(`R-${i}`, 1 + (i % 10), 'R'));
  const { seats, counts } = layoutChamber(races, 'state_house');
  assert.equal(seats.length, 50);
  assert.equal(counts.rep, 50);
  assert.equal(seats.every((s) => s.side === 'R'), true);
  const positions = seats.map((s) => `${+s.x.toFixed(3)},${+s.y.toFixed(3)}`);
  assert.equal(positions.length, new Set(positions).size, 'no two seats share a slot');
  assert.ok(positions.every((p) => template.seats.some((s) => `${+s.x.toFixed(3)},${+s.y.toFixed(3)}` === p)), 'all on the template');
});

test('unequal party counts do not drop or duplicate a seat', () => {
  const { seats, counts } = layoutChamber(makeRaces(120, { demRatio: 0.25 }), 'state_house');
  assert.equal(seats.length, 120);
  assert.equal(counts.dem + counts.rep + counts.ties + counts.unrated, 120);
  assert.equal(counts.dem, 30);
  assert.equal(counts.rep, 90);
});

test('equal margins are ordered deterministically by district id', () => {
  const races = [
    race('B', 5, 'R'), race('A', 5, 'R'), race('D', -5, 'D'), race('C', -5, 'D'),
  ];
  const a = layoutChamber(races).seats.map((s) => `${s.district_id}:${s.x.toFixed(2)},${s.y.toFixed(2)}`);
  const b = layoutChamber([...races].reverse()).seats.map((s) => `${s.district_id}:${s.x.toFixed(2)},${s.y.toFixed(2)}`);
  assert.deepEqual(a, b);
});

test('the two real chambers clear the drawn strokes', () => {
  for (const [file, chamber] of [['state_house', 'state_house'], ['state_senate', 'state_senate']]) {
    const races = realRaces(file);
    if (!races) continue;
    const { seats } = layoutChamber(races, chamber);
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const d = Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y);
        assert.ok(d >= 24, `${file}: ${seats[i].district_id} and ${seats[j].district_id} only ${d.toFixed(2)} apart`);
      }
    }
  }
});

test('an empty or one-seat chamber does not throw', () => {
  assert.equal(layoutChamber([]).seats.length, 0);
  assert.equal(layoutChamber([race('HD-1', 2, 'R'), race('HD-2', -1, 'D')]).seats.length, 2);
});