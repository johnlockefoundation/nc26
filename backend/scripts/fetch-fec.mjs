// Fetch real 2026 FEC campaign-finance totals for NC federal candidates and
// write the normalized fundraising drop consumed by:
//   node src/ingest/index.js fundraising
//
// API: OpenFEC (api.open.fec.gov). Uses the efficient /candidates/totals/
// aggregate endpoint (2-3 calls total for all NC federal candidates), so the
// public DEMO_KEY is sufficient. A free personal key may still be provided via
// the FEC_API_KEY env var or backend/data/sources/fec-key.txt.
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
        console.log('  NOTE: public DEMO_KEY is shared and may be briefly rate-limited; retrying.');
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

async function candidateTotals(office) {
  const out = [];
  let page = 1;
  for (;;) {
    const j = await fec(`/candidates/totals/?office=${office}&state=NC&cycle=${CYCLE}&election_full=true&per_page=100&page=${page}`);
    out.push(...(j.results || []));
    const pages = j.pagination?.pages || 1;
    if (page >= pages) break;
    page++;
    await sleep(250);
  }
  return out;
}

const SUFFIXES = new Set(['JR', 'SR', 'II', 'III', 'IV', 'V', 'JD', 'MD', 'DR', 'MR', 'MRS', 'REV', 'HON', 'SEN', 'REP']);

function normName(s) {
  return String(s || '').replace(/[^a-z0-9', ]/gi, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function partsOf(name) {
  const n = normName(name);
  const segments = n.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    // "LAST, FIRST MIDDLE" (suffixes may appear as their own comma segment,
    // e.g. "SMITH, JR., RAYMOND EDWARD").
    let last = segments[0];
    let i = 1;
    if (SUFFIXES.has(last)) { last = segments[1] || ''; i = 2; }
    let first = '';
    while (i < segments.length && !first) {
      first = segments[i].split(' ').find((t) => t && !SUFFIXES.has(t)) || '';
      i++;
    }
    return { last, first };
  }
  const words = n.split(' ').filter(Boolean).filter((w) => !SUFFIXES.has(w));
  return { last: words[words.length - 1] || '', first: words[0] || '' };
}

function match(candidates, localName) {
  const local = partsOf(localName);
  const surname = candidates.filter((c) => partsOf(c.name || '').last === local.last);
  if (surname.length === 0) return null;
  const pool = surname.length === 1 ? surname : surname.filter((c) => (partsOf(c.name || '').first[0] || '') === (local.first[0] || ''));
  const use = pool.length ? pool : (surname.length === 1 ? surname : []);
  let best = null, bestScore = -1;
  for (const c of use) {
    const fec = partsOf(c.name || '');
    let score = 1;
    if (fec.first === local.first) score += 3;
    else if ((fec.first[0] || '') === (local.first[0] || '')) score += 1;
    if (c.incumbent_challenge === 'I' || c.incumbent_challenge === 'C') score += 0.5;
    if (c.receipts != null) score += 0.25;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

const { db } = await import(pathToFileURL(join(BACKEND, 'src', 'db.js')));
const { CYCLE: C } = await import(pathToFileURL(join(BACKEND, 'src', 'ingest', 'config.js')));

const locals = db.prepare(`SELECT district_id, name, party FROM candidates
  WHERE election_cycle = ? AND (district_id = 'NC-SEN' OR district_id GLOB 'NC-[0-9]*')
  AND party IN ('D', 'R')`).all(C);

const houseTotals = await candidateTotals('H');
const senTotals = await candidateTotals('S');
console.log(`  FEC rows: ${houseTotals.length} house, ${senTotals.length} senate`);

const byId = [...houseTotals, ...senTotals];

const districts = new Map();
const used = new Set();
for (const local of locals) {
  const office = local.district_id === 'NC-SEN' ? 'S' : 'H';
  const district = office === 'S' ? null : Number(local.district_id.replace(/^NC-0?/, ''));
  const pool = byId.filter((c) => {
    const partial = (c.office || '').trim();
    const cd = partial === 'S' ? null : Number(c.district);
    const party = (c.party || '').toUpperCase();
    return partial === office && cd === district &&
      (party.startsWith('D') === (local.party === 'D')) && (party.startsWith('R') === (local.party === 'R'));
  });
  const matched = match(pool, local.name);
  if (!matched) {
    console.log(`  no FEC match for ${local.district_id} ${local.party} ${local.name}`);
    continue;
  }
  used.add(matched.candidate_id);
  const slot = districts.get(local.district_id) || { district_id: local.district_id, dem_amount: null, rep_amount: null, source_urls: {} };
  slot[local.party === 'D' ? 'dem_amount' : 'rep_amount'] = matched.receipts != null ? Math.round(matched.receipts) : null;
  slot.source_urls[local.party] = `https://www.fec.gov/data/candidate/${matched.candidate_id}/`;
  slot.coverage_end_date = matched.coverage_end_date || slot.coverage_end_date || null;
  districts.set(local.district_id, slot);
  console.log(`  ${local.district_id} ${local.party} ${local.name} -> ${matched.candidate_id} receipts=${matched.receipts}`);
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
    source_url: d.source_urls.D || d.source_urls.R || '',
    source_method: 'total_receipts',
  });
}

mkdirSync(join(BACKEND, 'data', 'sources'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ source: 'FEC', updated_at, fundraising }, null, 2));
console.log(`Wrote ${OUT} (${fundraising.length} districts)`);
for (const f of fundraising) {
  console.log(`  ${f.district_id}: D ${f.dem_amount} / R ${f.rep_amount} (${f.reporting_period})`);
}