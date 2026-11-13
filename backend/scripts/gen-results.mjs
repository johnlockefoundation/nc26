#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// NC SBE 2026 general election results (federal races), pasted by the user.
// Ballot counts per candidate; total includes minor parties and write-ins.
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

const out = {};
for (const [id, v] of Object.entries(RAW)) {
  const total = v.dem + v.rep + v.other;
  const margin = v.dem - v.rep;
  out[id] = {
    dem_votes: v.dem,
    rep_votes: v.rep,
    other_votes: v.other,
    total_votes: total,
    margin_votes: margin,
    margin_pp: +((margin / total) * 100).toFixed(2),
    winner: margin > 0 ? 'D' : margin < 0 ? 'R' : 'TIE',
  };
}
writeFileSync(resolve(REPO, 'frontend/public/results.json'), JSON.stringify({ generated: '2026-11-03', source: 'NC State Board of Elections', races: out }, null, 2));
console.log('wrote', Object.keys(out).length, 'races');
for (const [id, v] of Object.entries(out)) console.log(id, v.winner, v.margin_votes.toLocaleString(), '(' + v.margin_pp + ' pp)');
node /Users/mihirkale/repos/locke/carolina_elections/backend/scripts/gen-results.mjs