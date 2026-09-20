// US Senate: each in-play state is stored as a single "district" row whose
// geometry is the full state outline, so the map renders the whole state.
// Marks every 2026 battleground seat competitive and adds candidates.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { CYCLE, SENATE_RACES } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = join(__dirname, '..', '..', 'data', 'seed', 'candidates-us-senate.json');

export function ingestUsSenate(cycle = CYCLE) {
  const mark = db.prepare(
    `UPDATE districts SET competitive = 1, competitive_source = ?, competitive_reason = ?
     WHERE district_id = ? AND election_cycle = ?`
  );
  let designated = 0;
  for (const r of SENATE_RACES) {
    const res = mark.run(r.source, r.reason, r.id, cycle);
    designated += res.changes;
  }

  const data = JSON.parse(readFileSync(SEED, 'utf8'));
  const delCand = db.prepare(`DELETE FROM candidates WHERE election_cycle = ? AND district_id = ?`);
  const insCand = db.prepare(`INSERT OR REPLACE INTO candidates
    (candidate_id, district_id, election_cycle, name, party, incumbent, website, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  let candidates = 0;
  for (const districtId of new Set(data.candidates.map((c) => c.district_id))) {
    delCand.run(cycle, districtId);
  }
  for (const c of data.candidates) {
    insCand.run(c.candidate_id, c.district_id, cycle, c.name, c.party, c.incumbent ? 1 : 0, c.website || '', c.photo_url || '');
    candidates++;
  }
  console.log(`[us-senate] ${designated} districts designated competitive; ${candidates} candidates`);
  return { source: 'us-senate', candidates, competitive: designated };
}
