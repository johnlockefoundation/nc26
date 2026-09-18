// US Senate: the statewide race is stored as a single "district" row whose
// geometry is the full state outline, so the map renders North Carolina as a
// whole. Adds candidates (with headshots) and designates the race competitive.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { CYCLE, US_SENATE } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = join(__dirname, '..', '..', 'data', 'seed', 'candidates-us-senate.json');
const OUTLINE = join(__dirname, '..', '..', 'data', 'geojson', 'state-outline.json');

export function ingestUsSenate(cycle = CYCLE) {
  const outline = JSON.parse(readFileSync(OUTLINE, 'utf8'));
  const geometry = JSON.stringify(outline.features[0].geometry);

  db.prepare(`INSERT OR IGNORE INTO districts
    (district_id, race_type, district_number, election_cycle, geometry, competitive, competitive_source, competitive_reason)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
    .run(US_SENATE.district_id, 'us_senate', US_SENATE.district_number, cycle, geometry, US_SENATE.source, US_SENATE.reason);

  const data = JSON.parse(readFileSync(SEED, 'utf8'));
  const insCand = db.prepare(`INSERT OR REPLACE INTO candidates
    (candidate_id, district_id, election_cycle, name, party, incumbent, website, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  let candidates = 0;
  for (const c of data.candidates) {
    insCand.run(c.candidate_id, US_SENATE.district_id, cycle, c.name, c.party, c.incumbent ? 1 : 0, c.website || '', c.photo_url || '');
    candidates++;
  }
  console.log(`[us-senate] 1 district designated competitive; ${candidates} candidates`);
  return { source: 'us-senate', candidates, competitive: 1 };
}