// Fetch real 2026 FEC campaign-finance totals for NC federal candidates and
// write the normalized fundraising drop consumed by:
//   node src/ingest/index.js fundraising
//
// API: OpenFEC (api.open.fec.gov). A free api.data.gov key may be provided via
// the FEC_API_KEY env var or backend/data/sources/fec-key.txt. Without one the
// public DEMO_KEY is shared by all users and heavily rate-limited.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const OUT = join(BACKEND, 'data', 'sources', 'fundraising.json');
const CYCLE = '2026';

function apiKey() {
  if (process.env.FEC_API_KEY) return process.env.FEC_API_KEY;
  const file = join(BACKEND, 'data', 'sources', 'fec-key.txt');
  if (existsSync(file)) {
    const k = readFileSync(file, 'utf8').trim();
    if (k) return k;
  }
  return null;
}

const KEY = apiKey() || 'DEMO_KEY';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fec(path) {
  const url = `https://api.open.fec.gov/v1${path}${path.includes('?') ? '&' : '?'}api_key=${KEY}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      if (!apiKey()) {
        console.log('  NOTE: using public DEMO_KEY (shared with all FEC API users, heavily rate-limited).');
        console.log('  Get a free personal key at https://api.data.gov/signup/ and save it to backend/data/sources/fec-key.txt.');
      }
      const wait = 5000 * (attempt + 1);
      console.log(`  rate-limited, waiting ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`fec http ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error(`fec rate limit persisted for ${path}`);
}

async function listCandidates(office) {
  const out = [];
  let page = 1;
  for (;;) {
    const j = await fec(`/candidates/?office=${office}&state=NC&cycle=${CYCLE}&per_page=100&page=${page}&sort=candidate_id`);
    out.push(...(j.results || []));
    const pages = j.pagination.pages || 1;
    if (page >= pages) break;
    page++;
  }
  return out;
}

async function candidateTotals(candidateId) {
  const j = await fec(`/candidate/${candidateId}/totals/?cycle=${CYCLE}&election_full=true`);
  const r = (j.results || [])[0];
  return {
    receipts: r ? r.receipts ?? null : null,
    coverage_end_date: r ? r.coverage_end_date ?? null : null,
  };
}

function normName(s) {
  return String(s || '').replace(/[^a-z0-9' ]/gi, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function partsOf(name) {
  const n = normName(name);
  const comma = n.indexOf(',');
  if (comma !== -1) {
    const last = n.slice(0, comma).trim();
    const first = n.slice(comma + 1).trim().split(' ').filter(Boolean);
    return { last, first: first[0] || '' };
  }
  const words = n.split(' ').filter(Boolean);
  return { last: words[words.length - 1] || '', first: words[0] || '' };
}

function matchFec(localName, fecList) {
  const local = partsOf(localName);
  let best = null, bestScore = -1;
  for (const c of fecList) {
    const fec = partsOf(c.name || '');
    if (fec.last !== local.last) continue;
    if ((fec.first[0] || '') !== (local.first[0] || '')) continue;
    let score = 1;
    if (fec.first === local.first) score += 2;   // full first-name match
    if (c.incumbent_challenge === 'I' || c.incumbent_challenge === 'C') score += 0.5;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

const { db } = await import(pathToFileURL(join(BACKEND, 'src', 'db.js')));
const D = await import(pathToFileURL(join(BACKEND, 'src', 'ingest', 'config.js')));

const locals = db.prepare(`SELECT district_id, name, party FROM candidates
  WHERE election_cycle = ? AND (district_id = 'NC-SEN' OR district_id GLOB 'NC-[0-9]*')
  AND party IN ('D', 'R')`).all(CYCLE);

const houseFec = await listCandidates('H');
const senFec = await listCandidates('S');
const fecByOffice = { H: houseFec, S: senFec };

const districts = new Map(); // district_id -> { dem_amount, rep_amount, ... }

for (const local of locals) {
  const office = local.district_id === 'NC-SEN' ? 'S' : 'H';
  const localDist = Number(local.district_id.replace(/^NC-0?/, ''));
  const pool = fecByOffice[office].filter((c) =>
    office === 'S' || Number(c.district) === localDist);
  const matched = matchFec(local.name, pool);
  if (!matched) {
    console.log(`  no FEC match for ${local.district_id} ${local.party} ${local.name}`);
    continue;
  }
  const totals = await candidateTotals(matched.candidate_id);
  const slot = districts.get(local.district_id) || { district_id: local.district_id, dem_amount: null, rep_amount: null };
  slot[local.party === 'D' ? 'dem_amount' : 'rep_amount'] = totals.receipts != null ? Math.round(totals.receipts) : null;
  slot.coverage_end_date = totals.coverage_end_date || null;
  slot.source_url = `https://www.fec.gov/data/candidate/${matched.candidate_id}/`;
  districts.set(local.district_id, slot);
  console.log(`  ${local.district_id} ${local.party} ${local.name} -> ${matched.candidate_id} (${matched.name}) receipts=${totals.receipts}`);
  await sleep(350);
}

const fundraising = [];
const updated_at = new Date().toISOString();
for (const d of districts.values()) {
  fundraising.push({
    district_id: d.district_id,
    dem_amount: d.dem_amount,
    rep_amount: d.rep_amount,
    reporting_period: d.coverage_end_date ? `Through ${d.coverage_end_date}` : '',
    updated_at,
    source_url: d.source_url || '',
    source_method: 'total_receipts',
  });
}

mkdirSync(join(BACKEND, 'data', 'sources'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ source: 'FEC', updated_at, fundraising }, null, 2));
console.log(`Wrote ${OUT} (${fundraising.length} districts)`);
for (const f of fundraising) {
  console.log(`  ${f.district_id}: D ${f.dem_amount} / R ${f.rep_amount} (${f.reporting_period})`);
}