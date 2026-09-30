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
  // Geometry is rewritten on conflict so a boundary rebuild -- a newly enacted
  // district plan, say -- actually reaches rows already in the table. Only the
  // geometry is updated: `competitive`, its provenance and the CPI columns are
  // left alone so that rebuilding boundaries cannot silently drop a
  // designation, whatever order the ingest jobs are run in.
  const ins = db.prepare(`INSERT INTO districts
    (district_id, race_type, district_number, election_cycle, geometry, competitive)
    VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT (district_id, election_cycle) DO UPDATE SET
      race_type = excluded.race_type,
      district_number = excluded.district_number,
      geometry = excluded.geometry`);
  for (const [raceType, file] of Object.entries(RACE_TYPES)) {
    const coll = JSON.parse(readFileSync(join(GEOM, file), 'utf8'));
    for (const f of coll.features) {
      const p = f.properties;
      ins.run(p.district_id, raceType, p.district_number, cycle, JSON.stringify(f.geometry));
      total++;
    }
  }
  console.log(`[districts] seeded ${total} district rows for cycle ${cycle}`);
  return { source: 'districts', count: total };
}