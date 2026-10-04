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
    (candidate_id, district_id, election_cycle, name, party, incumbent, photo_url, photo_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  let candidates = 0;
  for (const c of data.candidates) {
    insCand.run(c.candidate_id, c.district_id, cycle, c.name, c.party, c.incumbent ? 1 : 0, c.photo_url || '', c.photo_source || null);
    candidates++;
  }
  const upd = db.prepare(
    `UPDATE districts SET competitive = ?, competitive_source = ?, competitive_reason = ? WHERE district_id = ? AND election_cycle = ?`
  );
  // Clear the chamber first. Applying only the designated set leaves every other
  // congressional district holding whatever it had last run, so a district that
  // drops out of the competitive set keeps rendering bright forever, and a rerun
  // against an existing database never converges. Setting the whole chamber to 0
  // and then marking the in-play seats makes the job idempotent and the flag a
  // function of this cycle's table rather than of history.
  db.prepare(`UPDATE districts SET competitive = 0, competitive_source = NULL
    WHERE election_cycle = ? AND race_type = 'us_house'`).run(cycle);
  for (const spec of US_HOUSE_COMPETITIVE) {
    upd.run(1, spec.source, spec.reason, spec.id, cycle);
  }
  console.log(`[us-house] ${candidates} candidates; ${US_HOUSE_COMPETITIVE.length} districts designated competitive`);
  return { source: 'us-house', candidates, competitive: US_HOUSE_COMPETITIVE.length };
}