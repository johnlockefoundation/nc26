// Ingests the congressional district profile seed (census demographics +
// political snapshot) into district_profiles. See seed/profiles.json.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { CYCLE } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', '..', 'data', 'seed', 'profiles.json');

export function ingestProfiles(cycle = CYCLE) {
  const data = JSON.parse(readFileSync(FILE, 'utf8'));
  const upsert = db.prepare(`INSERT OR REPLACE INTO district_profiles
    (district_id, election_cycle, median_age, median_income, bachelors_plus,
     race_white, race_black, race_hispanic, pres_margin, cpi, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let n = 0;
  for (const p of data.profiles || []) {
    const r = p.race || {};
    upsert.run(p.district_id, cycle, p.median_age ?? null, p.median_income ?? null,
      p.bachelors_plus ?? null, r.white ?? null, r.black ?? null, r.hispanic ?? null,
      p.pres_margin ?? null, p.cpi ?? null, data.source, data.updated_at);
    n++;
  }
  return { source: 'profiles', count: n };
}