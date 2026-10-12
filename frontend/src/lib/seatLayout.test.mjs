// Tests for the hemicycle layout. Run with:
//   node src/lib/seatLayout.test.mjs
//
// Node's built-in assert and test runner only; the frontend has no test
// framework and this is pure arithmetic, so a browser is not needed. The point
// is the arrangement rules from the spec: every district placed exactly once,
// the safest seats on the outside, ties on the centreline, unrated kept apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { layoutChamber, metricLabel, normalizeMetric } from './seatLayout.js';

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

test('every district is placed exactly once', () => {
  for (const [n, opts] of [[120, { ties: 3, unrated: 0 }], [50, { ties: 2 }], [170, { ties: 5, unrated: 7 }]]) {
    const races = makeRaces(n, opts);
    const { seats, counts } = layoutChamber(races);
    assert.equal(seats.length, n, `seat count for n=${n}`);
    assert.equal(counts.total, n);
    const ids = new Set(seats.map((s) => s.district_id));
    assert.equal(ids.size, n, `unique ids for n=${n}`);
    for (const r of races) assert.ok(ids.has(r.district_id), `placed ${r.district_id}`);
  }
});

test('the two real chambers place their full rosters', () => {
  for (const [file, total] of [['state_house', 120], ['state_senate', 50]]) {
    const path = resolve(here, '../../public/data/reference/map', `${file}.json`);
    if (!existsSync(path)) continue;
    const map = JSON.parse(readFileSync(path, 'utf8'));
    const { seats, counts } = layoutChamber(map.races);
    assert.equal(seats.length, total, `${file} total`);
    assert.equal(counts.total, map.races.length, `${file} counted`);
    const ids = new Set(seats.map((s) => s.district_id));
    assert.equal(ids.size, seats.length, `${file} unique`);
  }
});

test('safer seats are pushed outward on each side', () => {
  const races = makeRaces(120, { ties: 3 });
  const { seats } = layoutChamber(races);
  for (const side of ['D', 'R']) {
    const onSide = seats
      .filter((s) => s.side === side)
      .sort((a, b) => a.angle * (side === 'D' ? -1 : 1) - b.angle * (side === 'D' ? -1 : 1));
    for (let i = 1; i < onSide.length; i++) {
      assert.ok(
        Math.abs(onSide[i].value) >= Math.abs(onSide[i - 1].value) - 1e-9,
        `${side}: margin stays monotonic outward`,
      );
    }
  }
});

test('exact ties run down the centreline, unrated off to a separate group', () => {
  const races = makeRaces(40, { ties: 4, unrated: 5 });
  const { seats, counts } = layoutChamber(races);
  const ties = seats.filter((s) => s.side === 'T');
  assert.equal(ties.length, 4);
  for (const t of ties) assert.equal(t.angle, 0);
  const unrated = seats.filter((s) => s.side === 'U');
  assert.equal(unrated.length, 5);
  for (const u of unrated) assert.equal(u.value, null);
  assert.equal(counts.ties, 4);
  assert.equal(counts.unrated, 5);
});

test('a one-party chamber still places everyone', () => {
  const races = Array.from({ length: 50 }, (_, i) => race(`R-${i}`, 1 + (i % 10), 'R'));
  const { seats, counts } = layoutChamber(races);
  assert.equal(seats.length, 50);
  assert.equal(counts.dem, 0);
  assert.equal(counts.rep, 50);
  assert.equal(seats.every((s) => s.side === 'R'), true);
});

test('unequal party counts do not drop or duplicate a seat', () => {
  const races = makeRaces(120, { demRatio: 0.25 });
  const { seats, counts } = layoutChamber(races);
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

test('no two seats overlap', () => {
  const { seats } = layoutChamber(makeRaces(120, { ties: 3, unrated: 4 }));
  const min = 2 * 7; // circle diameter
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const dx = seats[i].x - seats[j].x;
      const dy = seats[i].y - seats[j].y;
      const d = Math.hypot(dx, dy);
      assert.ok(d >= min - 1.5, `seats ${seats[i].district_id} and ${seats[j].district_id} overlap (${d.toFixed(2)})`);
    }
  }
});

test('an empty or one-seat chamber does not throw', () => {
  assert.equal(layoutChamber([]).seats.length, 0);
  assert.equal(layoutChamber([race('HD-1', 2, 'R')]).seats.length, 1);
});

// --- Hemicycle silhouette rules ---------------------------------------------
// The layout constants these assert against live in seatLayout.js: MIN_DIST
// (17 draw units, the distance two circles keep so the 3-unit selection and
// vulnerability strokes cannot touch) and HALF_RAD (89 degrees, the arc every
// row's end reaches). Keeping them here as literals means a drift in the
// geometry shows up as a failing test that names the promise.

const MIN_DIST = 17;
const HALF_DEG = 89;

function realRaces(file) {
  const path = resolve(here, '../../public/data/reference/map', `${file}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')).races;
}

test('no two seats come within the drawn-stroke clearance', () => {
  for (const file of ['state_house', 'state_senate']) {
    const races = realRaces(file);
    if (!races) continue;
    const { seats } = layoutChamber(races);
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const d = Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y);
        assert.ok(
          d >= MIN_DIST - 0.05,
          `${file}: ${seats[i].district_id} and ${seats[j].district_id} only ${d.toFixed(2)} apart`,
        );
      }
    }
  }
});

test('both sides reach the same baseline, completing the semicircle', () => {
  for (const file of ['state_house', 'state_senate']) {
    const races = realRaces(file);
    if (!races) continue;
    const { seats } = layoutChamber(races);
    for (const side of ['D', 'R']) {
      const outer = Math.max(...seats.filter((s) => s.side === side).map((s) => Math.abs(s.angle)));
      const deg = (outer * 180) / Math.PI;
      assert.ok(deg >= HALF_DEG - 1.5, `${file} ${side} outer reaches ${deg.toFixed(1)}deg of the baseline`);
      assert.ok(deg <= HALF_DEG + 0.5, `${file} ${side} outer ${deg.toFixed(1)}deg does not overshoot`);
    }
  }
});

test('the innermost rows are arcs, not one seat per side', () => {
  for (const file of ['state_house', 'state_senate']) {
    const races = realRaces(file);
    if (!races) continue;
    const { seats } = layoutChamber(races);
    const inner = Math.min(...seats.filter((s) => s.side !== 'U').map((s) => s.radius));
    const onRow = seats.filter((s) => s.radius === inner && s.side !== 'U');
    assert.ok(onRow.length >= 8, `${file} innermost row holds ${onRow.length} seats`);
    assert.ok(onRow.some((s) => s.side === 'D') && onRow.some((s) => s.side === 'R'),
      `${file} innermost row has both sides`);
  }
});

test('ties ride the central band through the normal row structure', () => {
  for (const file of ['state_house', 'state_senate']) {
    const races = realRaces(file);
    if (!races) continue;
    const { seats } = layoutChamber(races);
    const ties = seats.filter((s) => s.side === 'T');
    const rowRadii = new Set(seats.filter((s) => s.side !== 'U').map((s) => s.radius));
    for (const t of ties) {
      assert.equal(t.angle, 0, `${file} ${t.district_id} sits on the centreline`);
      assert.ok(rowRadii.has(t.radius), `${file} ${t.district_id} is on a real row, not dangling between rows`);
    }
    // Ties take the innermost rows precisely: the set of their radii is the
    // first `ties.length` distinct row radii, so the competitive band stays
    // central and no tie is stranded out among the safer seats.
    const distinctRows = [...rowRadii].sort((a, b) => a - b);
    const tieRadii = [...new Set(ties.map((t) => t.radius))].sort((a, b) => a - b);
    assert.deepEqual(tieRadii, distinctRows.slice(0, ties.length),
      `${file} ties occupy the innermost rows, keeping the competitive band central`);
  }
});

test('seat row widths track usable arc length, not row index', () => {
  // Two equal 50-vote fixtures, one chamber with all 120 votes fresh... use
  // synthetic sizes: a fixture whose scalar weights ignore radius would give a
  // different, sparser inner ring than the arc-length model does.
  const races = makeRaces(120, { ties: 0, unrated: 0 });
  const { seats } = layoutChamber(races);
  const rows = {};
  for (const s of seats.filter((x) => x.side !== 'U')) {
    (rows[s.radius] ||= { D: 0, R: 0 });
    rows[s.radius][s.side] += 1;
  }
  const innerRow = rows[Math.min(...Object.keys(rows).map(Number))];
  assert.ok(innerRow.D + innerRow.R >= 12, `innermost row spans ${innerRow.D + innerRow.R} seats, not one each side`);
});
