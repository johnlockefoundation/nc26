#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// pre-election prices from the last committed kalshi-load.sql before the refresh
const oldSql = execSync('git show 3542a74^:kalshi-load.sql', { cwd: REPO, encoding: 'utf8' });
const pre = {};
for (const line of oldSql.split('\n')) {
  const m = line.match(/\('([^']+)', '2026', 'Kalshi', ([\d.]+), ([\d.]+),/);
  if (m) pre[m[1]] = { dem: +m[2], rep: +m[3] };
}
const resolved = JSON.parse(readFileSync(resolve(REPO, 'backend/data/sources/markets-kalshi.json'), 'utf8'));
const out = {};
for (const m of resolved.markets) {
  const p = pre[m.district_id];
  if (!p) continue;
  out[m.district_id] = {
    pre_dem: p.dem,
    pre_rep: p.rep,
    actual: m.dem_price > m.rep_price ? 'D' : 'R',
  };
}
writeFileSync(resolve(REPO, 'frontend/public/kalshi-results.json'), JSON.stringify({ generated: new Date().toISOString().slice(0,10), races: out }, null, 2));
console.log('wrote', Object.keys(out).length, 'races');
