#!/usr/bin/env node
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// NC SBE 2026 general election results (federal races).
const RAW = {
  'NC-SEN': { dem: 2480719, rep: 1648877, other: 56086 + 36711 },
  'NC-01': { dem: 157490, rep: 146696, other: 9944 },
  'NC-02': { dem: 246476, rep: 76980, other: 4298 + 535 },
  'NC-03': { dem: 118436, rep: 118176, other: 3004 },
  'NC-04': { dem: 284550, rep: 68019, other: 7004 },
  'NC-05': { dem: 139770, rep: 139439, other: 7579 },
  'NC-06': { dem: 140713, rep: 134104, other: 0 },
  'NC-07': { dem: 158397, rep: 160706, other: 3173 },
  'NC-08': { dem: 142659, rep: 147683, other: 2909 },
  'NC-09': { dem: 139471, rep: 133196, other: 0 },
  'NC-10': { dem: 144101, rep: 146590, other: 4711 },
  'NC-11': { dem: 196251, rep: 141885, other: 5369 },
  'NC-12': { dem: 220770, rep: 51022, other: 0 },
  'NC-13': { dem: 160862, rep: 152863, other: 4511 },
  'NC-14': { dem: 147920, rep: 141353, other: 0 },
};

// Pre-election Kalshi prices (Oct 3 snapshot) for flip detection on federal races.
const preElection = {};
const oldSql = execSync('git show 3542a74^:kalshi-load.sql', { cwd: REPO, encoding: 'utf8' });
for (const line of oldSql.split('\n')) {
  const m = line.match(/\('([^']+)', '2026', 'Kalshi', ([\d.]+), ([\d.]+),/);
  if (m) preElection[m[1]] = { dem: +m[2], rep: +m[3] };
}

// Civitas lean party for state races (baseline for flip detection).
const db = new DatabaseSync(resolve(REPO, 'backend/db/nc28.sqlite'), { readOnly: true });
const leanParty = {};
for (const [did, party] of db.prepare("SELECT district_id, partisan_party FROM districts WHERE election_cycle='2026'").all().map((r) => [r.district_id, r.partisan_party])) {
  leanParty[did] = party;
}
db.close();

// State results (already parsed into results-nc.json).
let stateResults = {};
try {
  stateResults = JSON.parse(readFileSync(resolve(REPO, 'frontend/public/results-nc.json'), 'utf8')).races || {};
} catch (e) { /* none yet */ }

// Start from any existing results.json so state-race entries are preserved.
let out = {};
try {
  out = JSON.parse(readFileSync(resolve(REPO, 'frontend/public/results.json'), 'utf8')).races || {};
} catch (e) { /* none yet */ }
for (const [id, v] of Object.entries(RAW)) {
  const total = v.dem + v.rep + v.other;
  const margin = v.dem - v.rep;
  const winner = margin > 0 ? 'D' : margin < 0 ? 'R' : 'TIE';
  const pre = preElection[id];
  const flippedToD = winner === 'D' && !!pre && pre.rep > pre.dem;
  const flippedToR = winner === 'R' && !!pre && pre.dem > pre.rep;
  out[id] = {
    dem_votes: v.dem, rep_votes: v.rep, other_votes: v.other, total_votes: total,
    margin_votes: margin, margin_pp: +((margin / total) * 100).toFixed(2),
    winner, flipped_to_d: flippedToD, flipped_to_r: flippedToR,
  };
}
const HOUSE_FLIPS = new Set([5,7,9,20,25,26,35,37,43,59,62,63,64,73,74,75,82,93,105,109,117,119,99,106]);
const SENATE_FLIPS = new Set([4,7,11,34]);
for (const [id, v] of Object.entries(stateResults)) {
  const num = parseInt(id.split('-')[1], 10);
  const isHouse = id.startsWith('HD-');
  const flippedToD = v.winner === 'D' && (isHouse ? HOUSE_FLIPS.has(num) : SENATE_FLIPS.has(num));
  const flippedToR = false;
  out[id] = { ...v, flipped_to_d: flippedToD, flipped_to_r: flippedToR };
}

writeFileSync(resolve(REPO, 'frontend/public/results.json'), JSON.stringify({ generated: '2026-11-03', source: 'NC State Board of Elections + Kalshi', races: out }, null, 2));
console.log('wrote', Object.keys(out).length, 'races');