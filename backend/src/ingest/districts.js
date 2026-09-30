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
  // The geometry files are the full set of seats the tracker covers, so anything
  // else left in the table for this cycle is a seat that has been dropped --
  // the other U.S. Senate states, say. Without this they would keep rendering
  // from a database that predates the change; nothing else removes them,
  // because the jobs that touch these rows only ever insert or update.
  const prune = db.prepare(`DELETE FROM districts
    WHERE election_cycle = ? AND race_type = ? AND district_id NOT IN (SELECT value FROM json_each(?))`);

  let pruned = 0;
  for (const [raceType, file] of Object.entries(RACE_TYPES)) {
    const coll = JSON.parse(readFileSync(join(GEOM, file), 'utf8'));
    const ids = [];
    for (const f of coll.features) {
      const p = f.properties;
      ins.run(p.district_id, raceType, p.district_number, cycle, JSON.stringify(f.geometry));
      ids.push(p.district_id);
      total++;
    }
    pruned += prune.run(cycle, raceType, JSON.stringify(ids)).changes;
  }
  const note = pruned ? `, pruned ${pruned} dropped seat${pruned === 1 ? '' : 's'}` : '';
  console.log(`[districts] seeded ${total} district rows for cycle ${cycle}${note}`);
  return { source: 'districts', count: total, pruned };
}