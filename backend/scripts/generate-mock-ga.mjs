// PLACEHOLDER FIGURES. NOT REAL DATA.
//
// Shapes for the two new state-legislature widgets so the panels can be built
// and reviewed before an NC SBOE extract lands. Every row here is invented:
// amounts are scaled off the Civitas partisan index and district number, so
// none of them should ever be published.
//
// When the real data arrives, replace this file with backend/src/ingest/ and
// delete the generator. The is_mock column exists so no consumer can read a
// placeholder without it being visible in the payload.
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const SEED = join(BACKEND, 'data', 'seed');

const civitas = JSON.parse(readFileSync(join(SEED, 'civitas.json'), 'utf8'));
const usHouse = JSON.parse(readFileSync(join(SEED, 'candidates-us-house.json'), 'utf8')).candidates;

export function isCompetitiveGa(record) {
  return String(record.rating_lean || '').toLowerCase() !== 'safe';
}

// Deterministic pseudo-random in [0,1) from a string seed, so regenerating the
// file never produces different numbers -- a mock that shifts on every run
// makes diffs meaningless.
function noise(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function leanValue(cpi) {
  const m = /^([DR])\+(\d+)$/.exec(String(cpi || '').trim());
  if (!m) return { party: 'R', value: 4 };
  return { party: m[1], value: Number(m[2]) };
}

// --- fundraising -----------------------------------------------------------
// Invented. House and Senate races differ by roughly an order of magnitude in
// real spending, so the two are generated on separate scales.
export function buildStateFunds(cycle = '2026') {
  const rows = [];
  const emit = (districtId, record) => {
    for (const c of record.candidates || []) {
      if (!c) continue;
      const lean = leanValue(record.cpi_value || record.cpi);
      const senate = districtId.startsWith('SD-');
      const base = senate ? 1_450_000 : 165_000;
      // An incumbent and a leaner seat attract more money; the loser's number
      // is deliberately close so the widget is not a foregone conclusion.
      const n = noise(`${cycle}:${districtId}:${c.party}`);
      const pull = (c.incumbent ? 1.55 : 0.85) * (1 + Math.min(lean.value, 20) / 22);
      const raised = Math.round(base * pull * (0.72 + n * 0.6));
      const spent = Math.round(raised * (0.58 + n * 0.3));
      rows.push({
        candidate_id: `${districtId}_${c.party}_${cycle}`,
        district_id: districtId,
        election_cycle: cycle,
        candidate_name: c.name,
        party: c.party,
        total_raised: raised,
        total_spent: spent,
        cash_on_hand: Math.round(raised - spent),
        contributions: Math.round((senate ? 2400 : 320) * (0.7 + n * 0.7)),
        small_donors: Math.round((senate ? 1900 : 260) * (0.7 + n * 0.7)),
        reporting_period: 'Through 2026-09-30',
        source_url: 'https://cf.ncsbe.gov/',
        is_mock: 1,
      });
    }
  };
  for (const rec of civitas.senate || []) if (isCompetitiveGa(rec)) emit(`SD-${String(rec.district_number).padStart(2, '0')}`, rec);
  for (const rec of civitas.house || []) if (isCompetitiveGa(rec)) emit(`HD-${rec.district_number}`, rec);
  return rows;
}

// Written next to the other seed files so they are version-controlled and the
// ingest path can pick them up later without a code change.
export function writeSeeds() {
  return { funds: buildStateFunds() };
}
