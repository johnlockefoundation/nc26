import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, nowIso } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', '..', 'data');
const GEOM = join(DATA, 'geojson');

const RACE_TYPES = {
  us_house: 'us_house.json',
  us_senate: 'us_senate.json',
  state_senate: 'state_senate.json',
  state_house: 'state_house.json',
};

export async function ingestDistricts(cycle) {
  let total = 0;
  const ins = db.prepare(`INSERT OR IGNORE INTO districts
    (district_id, race_type, district_number, election_cycle, geometry, competitive)
    VALUES (?, ?, ?, ?, ?, 0)`);
  // The senate outline is refreshed (not just ignored) so a geometry rebuild
  // reaches every in-play state; competitiveness is re-marked by us-senate later.
  const insSenate = db.prepare(`INSERT OR REPLACE INTO districts
    (district_id, race_type, district_number, election_cycle, geometry, competitive)
    VALUES (?, ?, ?, ?, ?, 0)`);
  for (const [raceType, file] of Object.entries(RACE_TYPES)) {
    const coll = JSON.parse(readFileSync(join(GEOM, file), 'utf8'));
    const use = raceType === 'us_senate' ? insSenate : ins;
    for (const f of coll.features) {
      const p = f.properties;
      use.run(p.district_id, raceType, p.district_number, cycle, JSON.stringify(f.geometry));
      total++;
    }
  }
  console.log(`[districts] seeded ${total} district rows for cycle ${cycle}`);
  return { source: 'districts', count: total };
}