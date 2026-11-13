#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const db = new DatabaseSync(resolve(REPO, 'backend/db/nc28.sqlite'), { readOnly: true });
const kalshi = JSON.parse(readFileSync(resolve(REPO, 'frontend/public/kalshi-results.json'), 'utf8'));
const results = JSON.parse(readFileSync(resolve(REPO, 'frontend/public/results.json'), 'utf8'));
const out = {};
for (const r of db.prepare("SELECT district_id, dem_average, rep_average, margin FROM polling_averages WHERE election_cycle='2026'").all()) {
  const k = kalshi.races[r.district_id];
  if (!k) continue;
  const res = results.races[r.district_id];
  out[r.district_id] = {
    poll_dem: r.dem_average,
    poll_rep: r.rep_average,
    poll_margin: r.margin,
    actual: k.actual,
    final_mov: res ? res.margin_votes : null,
    final_margin_pp: res ? res.margin_pp : null,
    n_polls: db.prepare('SELECT count(*) c FROM polls WHERE district_id=? AND election_cycle=?').get(r.district_id, '2026').c,
  };
}
db.close();
writeFileSync(resolve(REPO, 'frontend/public/polls-results.json'), JSON.stringify({ generated: new Date().toISOString().slice(0,10), races: out }, null, 2));
console.log('wrote', Object.keys(out).length, 'races');