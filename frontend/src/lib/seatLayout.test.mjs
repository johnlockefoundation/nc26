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

test('competitive seats sit closest to the centre seam', () => {
  const races = makeRaces(120, { ties: 3 });
  const { seats } = layoutChamber(races);
  for (const side of ['D', 'R']) {
    const onSide = seats
      .filter((s) => s.side === side)
      .sort((a, b) => a.dist - b.dist || a.row - b.row);
    for (let i = 1; i < onSide.length; i++) {
      assert.ok(
        Math.abs(onSide[i].value) >= Math.abs(onSide[i - 1].value) - 1e-9,
        `${side}: margin stays monotonic away from the seam`,
      );
    }
  }
});

test('exact ties share the centre column, unrated off to a separate group', () => {
  const races = makeRaces(40, { ties: 4, unrated: 5 });
  const { seats, counts } = layoutChamber(races);
  const ties = seats.filter((s) => s.side === 'T');
  assert.equal(ties.length, 4);
  const tieX = ties[0].x;
  const partyXs = new Set(seats.filter((s) => s.side === 'D' || s.side === 'R').map((s) => s.x));
  for (const t of ties) {
    assert.equal(t.x, tieX, `${t.district_id} in the centre column`);
    assert.ok(!partyXs.has(t.x), `no party seat shares the centre column`);
  }
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

// --- The fixed-grid rules ----------------------------------------------------
// The chamber is an even lattice (CELL = 20 units apart in both axes), which is
// what makes the gaps uniform. Kept here as a literal so a drift shows up as a
// failing test that names the promise.

const CELL = 20;

function realRaces(file) {
  const path = resolve(here, '../../public/data/reference/map', `${file}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')).races;
}

test('every row is evenly spaced, in both axes', () => {
  for (const file of ['state_house', 'state_senate']) {
    const races = realRaces(file);
    if (!races) continue;
    const { seats } = layoutChamber(races);
    const party = seats.filter((s) => s.side !== 'U');
    const xs = new Set(party.map((s) => Math.round(s.x * 100)));
    const ys = new Set(party.map((s) => Math.round(s.y * 100)));
    const xsSorted = [...xs].sort((a, b) => a - b);
    const ysSorted = [...ys].sort((a, b) => a - b);
    for (let i = 1; i < xsSorted.length; i++) assert.equal(xsSorted[i] - xsSorted[i - 1], CELL * 100, `${file} columns at fixed pitch`);
    for (let i = 1; i < ysSorted.length; i++) assert.equal(ysSorted[i] - ysSorted[i - 1], CELL * 100, `${file} rows at fixed pitch`);
    // A party block's own seats step exactly one cell. Across the centre seam
    // the gap is a full empty column wider, which is uniform, not random.
    const byRow = new Map();
    for (const s of party) {
      if (!byRow.has(s.row)) byRow.set(s.row, []);
      byRow.get(s.row).push(s);
    }
    for (const [row, rowSeats] of byRow) {
      for (const side of ['D', 'R']) {
        const block = rowSeats.filter((s) => s.side === side).map((s) => s.x).sort((a, b) => a - b);
        for (let i = 1; i < block.length; i++) {
          assert.ok(Math.abs(block[i] - block[i - 1] - CELL) < 1e-6,
            `${file} row ${row} ${side} block gaps are exactly one cell`);
        }
      }
    }
  }
});

test('the two real chambers clear the drawn strokes and hold the full roster', () => {
  for (const [file, total] of [['state_house', 120], ['state_senate', 50]]) {
    const races = realRaces(file);
    if (!races) continue;
    const { seats } = layoutChamber(races);
    assert.equal(seats.length, total, `${file} total`);
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const d = Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y);
        assert.ok(d >= 17 - 0.05, `${file}: ${seats[i].district_id} and ${seats[j].district_id} only ${d.toFixed(2)} apart`);
      }
    }
  }
});

test('ties sit in the centre seam of both real chambers', () => {
  for (const file of ['state_house', 'state_senate']) {
    const races = realRaces(file);
    if (!races) continue;
    const { seats } = layoutChamber(races);
    const ties = seats.filter((s) => s.side === 'T');
    assert.ok(ties.length >= 2, `${file} has the fixture's ties`);
    const tieX = ties[0].x;
    for (const t of ties) assert.equal(t.x, tieX, `${file} ${t.district_id} shares the centre column`);
    const partyXs = new Set(seats.filter((s) => s.side === 'D' || s.side === 'R').map((s) => s.x));
    assert.ok(!partyXs.has(tieX), `${file} nothing else occupies the seam column`);
  }
});
