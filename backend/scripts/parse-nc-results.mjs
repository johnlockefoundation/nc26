#!/usr/bin/env node
// Parse NC SBE "View Contest Details" text dumps into a results JSON.
// Usage: node backend/scripts/parse-nc-results.mjs <input.txt> <chamber> [out.json]
//   chamber: senate | house
//   out.json defaults to frontend/public/results-nc.json (merged across runs)
//
// Input is the raw page text: contest headers like
//   "NC STATE SENATE DISTRICT 01 (VOTE FOR 1)"
// followed by rows "NAME\tPARTY\tCOUNT\tPERCENT".
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const file = process.argv[2];
const chamber = process.argv[3];
const outPath = resolve(process.argv[4] || join(REPO, 'frontend/public/results-nc.json'));
if (!file || !['senate','house'].includes(chamber)) {
  console.error('Usage: parse-nc-results.mjs <input.txt> <senate|house> [out.json]');
  process.exit(1);
}
const text = readFileSync(resolve(file), 'utf8');
const lines = text.split(/\r?\n/);
const prefix = chamber === 'senate' ? 'SD' : 'HD';
const pad = chamber === 'senate' ? 2 : 2;
const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { generated: '2026-11-03', source: 'NC State Board of Elections', races: {} };

let current = null;
let cand = null;
for (const raw of lines) {
  const line = raw.trim();
  const hm = line.match(/NC (?:STATE SENATE|HOUSE OF REPRESENTATIVES) DISTRICT (\d+)/i);
  if (hm) {
    if (current) finalize(current, out, prefix, pad);
    current = { num: parseInt(hm[1], 10), dem: 0, rep: 0, other: 0, total: 0 };
    cand = null;
    continue;
  }
  if (!current) continue;
  // candidate row: name \t party \t count \t percent  (or spaces)
  const m = line.match(/^(.+?)\t(DEM|REP|LIB|GRE|UNA|)\t([\d,]+)\t/);
  if (m) {
    const party = m[2];
    const count = parseInt(m[3].replace(/,/g, ''), 10);
    current.total += count;
    if (party === 'DEM') current.dem += count;
    else if (party === 'REP') current.rep += count;
    else current.other += count;
    continue;
  }
  // fallback: spaces
  const m2 = line.match(/^(.+?)\s{2,}(DEM|REP|LIB|GRE|UNA)\s+([\d,]+)\s+[\d.]+%$/);
  if (m2) {
    const party = m2[2];
    const count = parseInt(m2[3].replace(/,/g, ''), 10);
    current.total += count;
    if (party === 'DEM') current.dem += count;
    else if (party === 'REP') current.rep += count;
    else current.other += count;
  }
}
if (current) finalize(current, out, prefix, pad);

function finalize(c, out, prefix, pad) {
  const id = `${prefix}-${String(c.num).padStart(pad, '0')}`;
  const margin = c.dem - c.rep;
  out.races[id] = {
    dem_votes: c.dem,
    rep_votes: c.rep,
    other_votes: c.other,
    total_votes: c.total,
    margin_votes: margin,
    margin_pp: c.total ? +((margin / c.total) * 100).toFixed(2) : 0,
    winner: margin > 0 ? 'D' : margin < 0 ? 'R' : 'TIE',
  };
}

writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Parsed', Object.keys(out.races).length, 'races ->', outPath);