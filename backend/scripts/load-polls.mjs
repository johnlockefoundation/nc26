// Fill public.polls from PollResults.org, the free CC BY 4.0 feed of New York
// Times polling data. Run it instead of hand-entering toplines.
//
//   node backend/scripts/load-polls.mjs            # write polls-load.sql
//   node backend/scripts/load-polls.mjs --apply    # ...and push it with the CLI
//   node backend/scripts/load-polls.mjs --since=2026-07-01
//
// --apply shells out to `supabase db query --linked`, which authenticates through
// the Management API using the login you already have. That is deliberate: it
// needs no service_role key in CI and no cron, so refreshing polling stays a
// command a person runs rather than infrastructure that can silently rot.
//
// Why a loader at all. Ten hand-entered toplines is ten chances to mistype a
// margin, and it does not scale past the first cycle. PollResults.org is the
// replacement for RealClearPolitics, which had neither a free API nor a licence
// permitting redistribution.
//
// Precedence: hand-verified rows win. If a poll already exists for a seat and end
// date under a non-uuid poll_id, it came from a person who checked the topline
// against the release, and this skips it rather than loading a second copy.
// Loading both would double-weight one poll inside poll_summary's average, which
// is the failure this whole exercise exists to avoid.
//
// Federal only. PollResults.org has no North Carolina state-legislature polling,
// and the panel gates the POLLS block to congressional seats anyway.
//
// Recency floor. poll_summary averages every poll for a seat with no weighting and
// no window, so volume alone moves the number. The feed is generous -- 41 NC rows
// for five seats -- and it reaches back to November 2024, because NYT keeps
// benchmark polls inside the current cycle. Unfiltered, that drags the Senate
// average from D+11 on four hand-picked recent polls to D+8 on forty-one spanning
// two years, which is a worse read of the race and not a better one. Anything
// older than the floor is reported and skipped rather than silently loaded.
import { writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const OUT = join(BACKEND, 'data', 'sources', 'polls-load.sql');

const API = 'https://api.pollresults.org/v1.0/politics/results';
const CYCLE = '2026';
const STATE = 'NC';
// PollResults.org serves a browser-facing CORS policy, but it also blocks a
// default urllib agent with a 403, so the UA is set explicitly.
const HEADERS = { Accept: 'application/json', 'User-Agent': 'carolina-elections/1.0 (+jlf)' };

const APPLY = process.argv.includes('--apply');

// Default: one election cycle's worth of polling. Override with --since=YYYY-MM-DD.
const SINCE = (() => {
  const arg = process.argv.find((a) => a.startsWith('--since='));
  if (arg) {
    const v = arg.slice('--since='.length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`--since must be YYYY-MM-DD, got ${v}`);
    return v;
  }
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 180);
  return d.toISOString().slice(0, 10);
})();

// Only these stages are a general-election read. A primary poll answers a
// different question, and averaging one into a November margin would be wrong in
// a way no reader could see.
const WANTED_STAGE = 'general';

async function api(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: HEADERS });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`pollresults http ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error('pollresults retry limit exceeded');
}

// The feed writes dates as M/D/YY with no century. Everything this cycle is
// 20xx, and a 26 becoming 1926 would be worse than an explicit failure.
function isoDate(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const year = Number(m[3]);
  // Two-digit years here are always 20xx for this cycle. 50 and above would be a
  // 19xx year, which is a century-old poll rather than a missing century, so it is
  // rejected rather than silently read as 2050.
  if (year >= 50) return null;
  return `20${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}

const POPULATION = { lv: 'LV', rv: 'RV', a: 'A' };

function raceIdFor(type, question) {
  if (type === 'senate') return 'NC-SEN';
  const seat = Number(question?.seatNumber);
  return Number.isInteger(seat) && seat > 0 ? `NC-${String(seat).padStart(2, '0')}` : null;
}

// One poll becomes at most one row. A poll can carry several questions -- a
// statewide one beside a district one, or a primary beside the general -- so the
// general-stage question for this seat is the one that belongs in the table.
function toRow(result, type) {
  const question = (result.questions || []).find(
    (q) => q.stage === WANTED_STAGE && raceIdFor(type, q) !== null);
  if (!question) return null;

  const race_id = raceIdFor(type, question);
  const answers = question.answers || [];
  const dem = answers.find((a) => /^(DEM|D)$/i.test(a.party || ''));
  const rep = answers.find((a) => /^(REP|R)$/i.test(a.party || ''));
  // Minor-party and "would not vote" answers are deliberately dropped: the table
  // stores a two-party split, and the margin the panel shows is defined on it.
  if (!dem || !rep) return null;

  const dem_share = Number(dem.pct);
  const rep_share = Number(rep.pct);
  if (!Number.isFinite(dem_share) || !Number.isFinite(rep_share)) return null;

  const end_date = isoDate(result.endDate);
  const start_date = isoDate(result.startDate) || end_date;
  if (!end_date) return null;

  // sponsors is a single string in this feed, not an array, and it is often
  // empty. Normalising to a list keeps the pollster line uniform either way.
  const rawSponsors = result.sponsors;
  const sponsors = (Array.isArray(rawSponsors) ? rawSponsors : [rawSponsors])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const pollster = sponsors.length
    ? `${result.displayName} / ${sponsors.join(', ')}`
    : (result.displayName || null);
  if (!pollster) return null;

  return {
    poll_id: result.pollId,
    race_id,
    pollster,
    start_date,
    end_date,
    sample_size: Number(question.sampleSize) || null,
    population: POPULATION[String(question.population || '').toLowerCase()] || null,
    dem_share,
    rep_share,
    margin: Number((dem_share - rep_share).toFixed(1)),
    // urlArticle is the writeup; url is the pollster's own release or post. The
    // article is preferred because it is the version a reader can check against
    // a topline, which is the point of keeping the link at all.
    source_url: result.urlArticle || result.url || null,
    source: `PollResults.org (NYT polling data, CC BY 4.0), loaded ${new Date().toISOString().slice(0, 10)}`,
  };
}

const q = (v) => {
  if (v == null) return 'null';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

// Existing rows, so a hand-verified poll is never loaded a second time. The anon
// key reads this table under the same SELECT-only RLS policy the page uses.
async function existingHandVerified() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = await loadEnv();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('  no Supabase endpoint configured; cannot check for existing rows.');
    console.warn('  every row will be emitted, so re-running could double-weight a poll.');
    return new Set();
  }
  const url = `${SUPABASE_URL}/rest/v1/polls?select=race_id,end_date,poll_id&cycle=eq.${CYCLE}`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
  if (!res.ok) throw new Error(`supabase http ${res.status} reading existing polls`);
  const rows = await res.json();
  // A uuid poll_id means a previous run of this loader. Anything else is a
  // hand-entered slug and outranks what we are about to write.
  const hand = new Set();
  for (const r of rows) {
    if (!/^[0-9a-f-]{36}$/i.test(r.poll_id)) hand.add(`${r.race_id}|${r.end_date}`);
  }
  return hand;
}

async function loadEnv() {
  const { readFileSync, existsSync } = await import('node:fs');
  const out = {};
  for (const f of ['.env.plugin', '.env.pages']) {
    const p = join(BACKEND, '..', 'frontend', f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = /^VITE_SUPABASE_(URL|ANON_KEY)=(.+)$/.exec(line.trim());
      if (m && !out[`SUPABASE_${m[1]}`]) out[`SUPABASE_${m[1]}`] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const rows = [];
const skipped = { hand: 0, unmappable: 0, stale: 0 };

for (const type of ['senate', 'house']) {
  let cursor = '';
  do {
    const page = await api(`/${type}?state=${STATE}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    for (const result of page.results || []) {
      const row = toRow(result, type);
      if (!row) { skipped.unmappable++; continue; }
      if (row.end_date < SINCE) { skipped.stale++; continue; }
      rows.push(row);
    }
    cursor = page.cursor || '';
  } while (cursor);
}

const hand = await existingHandVerified();
const fresh = rows.filter((r) => {
  if (hand.has(`${r.race_id}|${r.end_date}`)) { skipped.hand++; return false; }
  return true;
});

const seats = [...new Set(fresh.map((r) => r.race_id))].sort();
console.log(`fetched ${rows.length} general-stage polls`);
console.log(`  since ${SINCE}`);
console.log(`  skipped ${skipped.hand} hand-verified, ${skipped.stale} older than the floor, ${skipped.unmappable} unmappable`);
console.log(`  writing ${fresh.length} across ${seats.length} seats: ${seats.join(' ') || '(none)'}`);

const sql = [
  `-- Generated by backend/scripts/load-polls.mjs on ${new Date().toISOString().slice(0, 10)}.`,
  '-- Source: PollResults.org, New York Times polling data, CC BY 4.0.',
  '-- Idempotent. Hand-verified polls already in the table are excluded above, not',
  '-- deleted here, so a person-checked topline keeps priority over the feed.',
  'begin;',
  '',
  'insert into public.polls',
  '  (poll_id, race_id, cycle, pollster, start_date, end_date, sample_size, population,',
  '   dem_share, rep_share, margin, source_url, source, is_seed) values',
  fresh.map((r) => `  (${q(r.poll_id)}, ${q(r.race_id)}, '${CYCLE}', ${q(r.pollster)}, ${q(r.start_date)}, `
    + `${q(r.end_date)}, ${q(r.sample_size)}, ${q(r.population)}, ${q(r.dem_share)}, ${q(r.rep_share)}, `
    + `${q(r.margin)}, ${q(r.source_url)}, ${q(r.source)}, false)`).join(',\n'),
  'on conflict (poll_id) do update set',
  '  race_id = excluded.race_id, pollster = excluded.pollster,',
  '  start_date = excluded.start_date, end_date = excluded.end_date,',
  '  sample_size = excluded.sample_size, population = excluded.population,',
  '  dem_share = excluded.dem_share, rep_share = excluded.rep_share, margin = excluded.margin,',
  '  source_url = excluded.source_url, source = excluded.source;',
  '',
  'commit;',
  '',
].join('\n');

writeFileSync(OUT, sql);
console.log(`\nwrote ${OUT}`);

if (APPLY) {
  if (!fresh.length) {
    console.log('nothing to apply.');
  } else {
    const { spawnSync } = await import('node:child_process');
    console.log('\napplying with the Supabase CLI...');
    const r = spawnSync('supabase', ['db', 'query', '--linked', '--file', OUT], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log('applied.');
  }
}
