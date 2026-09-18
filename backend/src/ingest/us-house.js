// US House candidates (federal races aren't in the GA-only Civitas CPI file)
// plus the federal competitive set for the cycle.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { CYCLE, US_HOUSE_COMPETITIVE } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', '..', 'data', 'seed', 'candidates-us-house.json');

export function ingestUsHouse(cycle = CYCLE) {
  const data = JSON.parse(readFileSync(FILE, 'utf8'));
  const insCand = db.prepare(`INSERT OR REPLACE INTO candidates
    (candidate_id, district_id, election_cycle, name, party, incumbent, website, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  let candidates = 0;
  for (const c of data.candidates) {
    insCand.run(c.candidate_id, c.district_id, cycle, c.name, c.party, c.incumbent ? 1 : 0, c.website || '', c.photo_url || '');
    candidates++;
  }
  const upd = db.prepare(
    `UPDATE districts SET competitive = ?, competitive_source = ?, competitive_reason = ? WHERE district_id = ? AND election_cycle = ?`
  );
  for (const spec of US_HOUSE_COMPETITIVE) {
    upd.run(1, spec.source, spec.reason, spec.id, cycle);
  }
  console.log(`[us-house] ${candidates} candidates; ${US_HOUSE_COMPETITIVE.length} districts designated competitive`);
  return { source: 'us-house', candidates, competitive: US_HOUSE_COMPETITIVE.length };
}