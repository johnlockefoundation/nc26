// PLACEHOLDER FIGURES. NOT REAL DATA.
//
// Shapes for the state-legislature widgets so the panels can be built and
// reviewed before an NC SBOE extract lands. Every row here is invented:
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

// --- voter velocity ---------------------------------------------------------
// Invented. Two snapshots taken at the same point in each cycle so the
// comparison is like-for-like, with ballot requests split by party because
// the change in requests is the signal, not the return rate.
export function buildDistrictVitals(cycle = '2026') {
  const rows = [];
  // Mid-September in each cycle: after registration drives have settled and
  // with early voting about to open, which is when absentee requests matter.
  const SNAPSHOTS = [
    { snapshot: '2024', date: '2024-09-20', growth: 0.055, spread: 0.55, reqGrowth: 1 },
    { snapshot: '2026', date: '2026-09-18', growth: 0.082, spread: 1, reqGrowth: 1.14 },
  ];
  const emit = (districtId, record) => {
    const lean = leanValue(record.cpi_value || record.cpi);
    const senate = districtId.startsWith('SD-');
    // A district's actual registration does not sit exactly on its CPI, so
    // give each one a fixed offset as well as the lean. The offset dominates
    // so that some seats gain Democrats and others gain Republicans -- keyed
    // on the lean alone every competitive seat would lean the same way.
    const base = noise(`${districtId}:lean`);
    const size = (senate ? 78000 : 42000) * (0.82 + base * 0.4);
    const raw = (lean.value - 10) / 60 + (base - 0.5) * 0.4;
    const shift = Math.max(-0.12, Math.min(0.12, raw));
    for (const { snapshot, date, growth, spread, reqGrowth } of SNAPSHOTS) {
      const u = noise(`${districtId}:${snapshot}:unaff`);
      const q = noise(`${districtId}:${snapshot}:req`);
      const s = shift * spread;
      const total = Math.round(size * (1 + growth));
      // Unaffiliated hold a real share, so the two parties split the rest
      // rather than being pinned to an even 50/50.
      const unaffShare = 0.13 + u * 0.05 + (snapshot === '2026' ? 0.008 : 0);
      const partyShare = 1 - unaffShare;
      const dem = Math.round(total * (partyShare / 2 - s / 2));
      const rep = Math.round(total * (partyShare / 2 + s / 2));
      const unaff = total - dem - rep;
      // Ballot requests follow registration, and a growing electorate requests
      // proportionally more of them.
      const requests = Math.round(size * (0.28 + q * 0.14) * reqGrowth);
      const reqUnaffShare = 0.11 + q * 0.04;
      const reqParty = 1 - reqUnaffShare;
      const rq = shift * spread * 1.3;
      rows.push({
        district_id: districtId,
        snapshot,
        snapshot_date: date,
        election_cycle: cycle,
        registered_total: total,
        registered_dem: dem,
        registered_rep: rep,
        registered_unaff: unaff,
        ballots_req_dem: Math.round(requests * (reqParty / 2 - rq / 2)),
        ballots_req_rep: Math.round(requests * (reqParty / 2 + rq / 2)),
        ballots_req_unaff: 0, // filled in below so the three parts sum to requests
        is_mock: 1,
        source: 'PLACEHOLDER - not NCSBE registration or ballot data',
      });
      const row = rows[rows.length - 1];
      row.ballots_req_unaff = requests - row.ballots_req_dem - row.ballots_req_rep;
    }
  };
  for (const rec of civitas.senate || []) if (isCompetitiveGa(rec)) emit(`SD-${String(rec.district_number).padStart(2, '0')}`, rec);
  for (const rec of civitas.house || []) if (isCompetitiveGa(rec)) emit(`HD-${rec.district_number}`, rec);
  return rows;
}

// Written next to the other seed files so they are version-controlled and the
// ingest path can pick them up later without a code change.
export function writeSeeds() {
  return { funds: buildStateFunds(), vitals: buildDistrictVitals() };
}
