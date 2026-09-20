// Ingested from the John Locke / Civitas 2026 CPI reference file:
//  - candidates for all General Assembly districts (from the official xlsx),
//  - the per-cycle "competitive" designation for GA districts,
//  - congressional CPI values for the 14 U.S. House districts.
// CPI values are stored but kept out of the user-facing race signal.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { CYCLE, GA_COMPETITIVE_RULE, COMPETITIVE_OVERRIDES } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CIVITAS_FILE = join(__dirname, '..', '..', 'data', 'seed', 'civitas.json');

export function ingestCivitas(cycle = CYCLE) {
  const data = JSON.parse(readFileSync(CIVITAS_FILE, 'utf8'));
  const insCand = db.prepare(`INSERT OR REPLACE INTO candidates
    (candidate_id, district_id, election_cycle, name, party, incumbent, website)
    VALUES (?, ?, ?, ?, ?, ?, '')`);
  const updDistrict = db.prepare(
    `UPDATE districts SET competitive = ?, competitive_source = ?, competitive_reason = ?, cpi_value = ?, partisan_lean = ?, partisan_party = ? WHERE district_id = ? AND election_cycle = ?`
  );
  const updCpi = db.prepare(
    `UPDATE districts SET cpi_value = ?, partisan_lean = ?, partisan_party = ? WHERE district_id = ? AND election_cycle = ?`
  );

  let candidates = 0;
  let competitive = 0;
  const record = (rec, raceType) => {
    const districtId = raceType === 'state_senate'
      ? `SD-${String(rec.district_number).padStart(2, '0')}`
      : `HD-${rec.district_number}`;
    for (const c of rec.candidates) {
      if (!c) continue;
      insCand.run(
        `${districtId}_${c.party}_${cycle}`,
        districtId,
        cycle,
        c.name,
        c.party,
        c.incumbent ? 1 : 0
      );
      candidates++;
    }
    const ruleHit = GA_COMPETITIVE_RULE.matches(rec);
    const override = COMPETITIVE_OVERRIDES.find((o) => o.id === districtId);
    const isComp = ruleHit || Boolean(override);
    const source = override ? override.source : GA_COMPETITIVE_RULE.source;
    const reason = override
      ? override.reason
      : `${rec.rating} (${rec.cpi}) per the ${GA_COMPETITIVE_RULE.label}.`;
    updDistrict.run(isComp ? 1 : 0, source, reason, rec.cpi, rec.rating_lean, rec.rating_party, districtId, cycle);
    if (isComp) competitive++;
  };

  for (const rec of data.senate) record(rec, 'state_senate');
  for (const rec of data.house) record(rec, 'state_house');

  let congressCpi = 0;
  for (const rec of data.congress || []) {
    const districtId = `NC-${String(rec.district_number).padStart(2, '0')}`;
    updCpi.run(rec.cpi ?? null, rec.rating_lean, rec.rating_party, districtId, cycle);
    congressCpi++;
  }

  console.log(`[civitas] ${candidates} candidates, ${competitive} GA districts marked competitive, ${congressCpi} congressional CPI values for ${cycle}`);
  return { source: 'civitas', candidates, competitive, congress_cpi: congressCpi };
}