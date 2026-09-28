// Fetch official headshots for sitting NC General Assembly members and write
// the normalized photos drop consumed by:
//   node src/ingest/index.js photos
//
// Source: the OpenStates people repo (github.com/openstates/people), one YAML
// per current legislator, public domain / CC0, no API key. For NC the `image:`
// field is normally the member's official portrait on ncleg.gov.
//
// Only incumbents are matched, and only when the legislator's current district
// *and* their name both agree with the local candidate row. Both checks are
// required: a district match alone would hand a challenger the portrait of the
// incumbent they are running against. Anyone unmatched keeps the initials
// fallback the UI already renders.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const OUT = join(BACKEND, 'data', 'sources', 'photos.json');

const REPO = 'openstates/people';
const REF = 'main';
const TREE_API = `https://api.github.com/repos/${REPO}/contents/data/nc/legislature`;
const REPO_URL = `https://github.com/${REPO}/tree/${REF}/data/nc/legislature`;
const HEADERS = { 'User-Agent': 'nc-race-signals/0.1 (candidate photo fetch)' };
const CONCURRENCY = 8;

// Only official ncleg.gov portraits are published. OpenStates fills the rest of
// its `image:` fields with whatever it can find — campaign sites, Wix and
// Squarespace CDNs, Ballotpedia's private S3 bucket, and expiring Google
// thumbnail tokens. Those hotlink fine today and 404 later, and hotlinking a
// candidate's campaign site isn't ours to do. Widening this list is a
// deliberate call, not a default.
const OFFICIAL_HOSTS = ['ncleg.gov'];

// ncleg.gov serves /Low at 386x540, which is the right weight for the
// square candidate card. /High is ~1.3MB per portrait.
const preferSize = (url) => url.replace(/\/(Low|Med|High)$/, '/Low');
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, asText = true) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 429 || res.status >= 500) {
      const wait = 1500 * (attempt + 1);
      console.log(`  ${res.status} on ${url.slice(0, 90)}..., retrying in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`http ${res.status} for ${url}`);
    return asText ? res.text() : res.json();
  }
  throw new Error(`giving up on ${url}`);
}

// --- minimal YAML reading -------------------------------------------------
// The people repo files are flat enough that four top-level keys plus the
// roles block cover everything needed, and it keeps this script dependency-free.

function scalar(v) {
  const t = v.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length > 1) {
    return t.slice(1, -1).replace(/\\(x[0-9a-fA-F]{2}|.)/g, (_, esc) =>
      esc[0] === 'x' ? String.fromCharCode(parseInt(esc.slice(1), 16)) : esc
    );
  }
  return t.replace(/^'(.*)'$/, '$1');
}

function topKey(text, key) {
  const m = text.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? scalar(m[1]) : null;
}

function block(text, key) {
  const lines = text.split('\n');
  const start = lines.indexOf(`${key}:`);
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    // Stop at the next unindented key, but not at a column-0 list item dash
    // ("- start_date: ..."), which still belongs to this block.
    if (/^(?:[A-Za-z_][A-Za-z0-9_]*:|---|\.\.\.)/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

function listOf(blockLines, field) {
  const re = new RegExp(`^\\s*-\\s*${field}:[ \\t]*(.*)$`);
  return blockLines.map((l) => l.match(re)).filter(Boolean).map((m) => scalar(m[1])).filter(Boolean);
}

function parsePerson(yaml) {
  // A role without an end_date is the seat the member currently holds; older
  // roles (e.g. a House seat before a Senate run) are ignored.
  const seats = [];
  for (const entry of block(yaml, 'roles').join('\n').split(/\n(?=\s*-\s)/)) {
    if (/^\s*-\s*end_date:/m.test(entry)) continue;
    const type = entry.match(/^\s*type:\s*(\w+)/m);
    const district = entry.match(/^\s*district:\s*(.+?)\s*$/m);
    if (type && district) seats.push(`${type[1]}:${scalar(district[1])}`);
  }
  return {
    name: topKey(yaml, 'name'),
    image: topKey(yaml, 'image'),
    aliases: listOf(block(yaml, 'other_names'), 'name'),
    seats,
  };
}

// --- name verification -----------------------------------------------------

const NOISE = new Set([
  'jr', 'sr', 'ii', 'iii', 'iv', 'v', 'jd', 'md', 'dr', 'mr', 'mrs', 'ms', 'miss',
  'rev', 'hon', 'sen', 'rep', 'gov', 'the',
]);

function tokens(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Erin Paré -> Erin Pare
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t));
}

function samePerson(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (A.length < 2 || B.length < 2) return false;
  if (A[A.length - 1] !== B[B.length - 1]) return false;   // surname must agree
  const set = new Set(B);
  return A.filter((t) => set.has(t)).length >= 2;            // plus one given/middle name
}

// --- fetch -----------------------------------------------------------------

console.log('Listing NC legislators in the OpenStates people repo...');
const listing = await get(TREE_API, false);
const files = listing.filter((f) => f.type === 'file' && /\.ya?ml$/.test(f.name));
console.log(`  ${files.length} legislator files`);

const people = [];
let cursor = 0;
let failed = 0;
async function worker() {
  while (cursor < files.length) {
    const f = files[cursor++];
    try {
      people.push(parsePerson(await get(f.download_url)));
    } catch (err) {
      failed++;
      console.log(`  ! ${f.name}: ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
if (failed) console.log(`  WARNING: ${failed} legislator files could not be read`);

const withPhoto = people.filter((p) => p.image);
console.log(`Parsed ${people.length} members, ${withPhoto.length} carry a photo`);

// --- match against local incumbents ---------------------------------------

const { db } = await import(pathToFileURL(join(BACKEND, 'src', 'db.js')));
const { CYCLE } = await import(pathToFileURL(join(BACKEND, 'src', 'ingest', 'config.js')));

const locals = db.prepare(`SELECT candidate_id, district_id, name, party FROM candidates
  WHERE election_cycle = ? AND incumbent = 1
    AND (district_id LIKE 'SD-%' OR district_id LIKE 'HD-%')
    AND party IN ('D', 'R')`).all(CYCLE);

const photos = [];
const unmatched = [];
const unofficial = [];
for (const local of locals) {
  const chamber = local.district_id.startsWith('SD-') ? 'upper' : 'lower';
  const seat = `${chamber}:${String(Number(local.district_id.slice(3)))}`;
  const inSeat = people.filter((p) => p.seats.includes(seat));
  const hit = inSeat.find((p) => p.image && (samePerson(p.name, local.name) || p.aliases.some((a) => samePerson(a, local.name))));
  if (!hit) {
    unmatched.push({ local, inSeat: inSeat.map((p) => p.name) });
    continue;
  }
  const url = preferSize(hit.image);
  const host = hostOf(url);
  if (!url.startsWith('https://') || !OFFICIAL_HOSTS.includes(host)) {
    unofficial.push({ local, host, url });
    continue;
  }
  photos.push({
    candidate_id: local.candidate_id,
    name: local.name,
    district_id: local.district_id,
    photo_url: url,
    photo_source: host,
  });
}

photos.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));

mkdirSync(join(BACKEND, 'data', 'sources'), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  source: 'openstates-people',
  source_url: REPO_URL,
  license: 'CC0-1.0 (public domain in the US)',
  updated_at: new Date().toISOString(),
  photos,
}, null, 2));

console.log(`\nWrote ${OUT}`);
console.log(`  ${photos.length}/${locals.length} incumbents matched to an official ncleg.gov portrait`);
if (unofficial.length) {
  console.log(`  ${unofficial.length} matched a sitting member but only via a non-official image, so left on initials:`);
  for (const { local, host } of unofficial) console.log(`    ${local.candidate_id} ${local.name}  [via ${host}]`);
}
console.log(`  ${unmatched.length} left on the initials fallback:`);
for (const { local, inSeat } of unmatched) {
  console.log(`    ${local.candidate_id} ${local.name}${inSeat.length ? `  [seat held by ${inSeat.join('/')}]` : '  [no current member in seat]'}`);
}
