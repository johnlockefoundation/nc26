// Export the normalized database as static JSON for the GitHub Pages demo.
// Writes into frontend/public/demo-data so Vite packages it with the site.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');

const { db, initSchema } = await import(pathToFileURL(join(BACKEND, 'src', 'db.js')));
const { CYCLE, HOUSE_OUTLOOK, SENATE_OUTLOOK, NC_SENATE_OUTLOOK, NC_HOUSE_OUTLOOK } = await import(pathToFileURL(join(BACKEND, 'src', 'ingest', 'config.js')));
const races = await import(pathToFileURL(join(BACKEND, 'src', 'lib', 'races.js')));

const OUT = process.env.STATIC_OUT || resolve(BACKEND, '..', 'frontend', 'public', 'demo-data');
const OUTLINE = join(BACKEND, 'data', 'geojson', 'state-outline.json');

// The database is gitignored, so a clean checkout (CI) has no schema at all.
// Without this the first query fails with "no such table". Callers are still
// responsible for running the ingest to populate it; this only guarantees the
// tables exist so a missing ingest fails on an empty export rather than a
// confusing SQL error.
initSchema();

const RACE_TYPES = ['us_house', 'us_senate', 'state_senate', 'state_house'];

// The same list the plugin export strips, and for the same reason. The demo is
// static, so anything left in here is what the demo shows forever -- which is
// how the mock state_funds and vitals reached the public site even after the
// plugin export had stopped carrying them. Every key below is read live from
// Supabase by api.js, and a seat with no live row simply renders without the
// block. `profile` is deliberately kept: it is a real Census extract, fixed for
// the cycle, not a placeholder.
const VOLATILE_RACE_KEYS = [
  'polls', 'markets', 'market_list', 'money', 'state_funds', 'vitals',
  'news', 'coverage', 'last_updated',
];

function stripVolatile(race) {
  const out = {};
  for (const [k, v] of Object.entries(race)) {
    if (VOLATILE_RACE_KEYS.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

function writeJson(rel, data) {
  const abs = join(OUT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(data, null, 0));
  console.log(`  ${join('demo-data', rel)}`);
}

console.log(`Exporting static demo data (cycle ${CYCLE}) → ${OUT}`);

const districtCount = db.prepare('SELECT COUNT(*) AS n FROM districts').get().n;
if (!districtCount) {
  console.error('\nERROR: the database has no districts.');
  console.error('Run `npm run ingest` before exporting. The database is gitignored,');
  console.error('so a clean checkout (CI) starts empty.');
  process.exit(1);
}

const meta = {
  cycle: CYCLE,
  race_types: null,
  house_outlook: HOUSE_OUTLOOK,
  senate_outlook: SENATE_OUTLOOK,
  nc_senate_outlook: NC_SENATE_OUTLOOK,
  nc_house_outlook: NC_HOUSE_OUTLOOK,
  sources: races.getSourceStatus(),
};
const counts = db.prepare(`SELECT race_type, COUNT(*) AS total,
    SUM(CASE WHEN competitive = 1 THEN 1 ELSE 0 END) AS competitive
  FROM districts WHERE election_cycle = ? GROUP BY race_type`).all(CYCLE);
meta.race_types = counts;
writeJson('meta.json', meta);

for (const raceType of RACE_TYPES) {
  // The map carries a races array for the same reason the plugin export keeps
  // one: App.jsx reads mapData.races for the district matchup labels, which come
  // from the candidate names. Those names are invariant and stay.
  //
  // Everything volatile in that array has to go, exactly as it does for the
  // per-seat files below and for the plugin's map export. It used not to: this
  // line wrote getMapFeatures() straight through, so every demo-data/map/*.json
  // shipped a baked markets block -- including a market_weekly_move delta
  // computed from the local SQLite database, which is not where any of that
  // data comes from. The deployed demo was carrying NC-01 "D +1", NC-07 "R +1"
  // and NC-11 "D +6" as if they were published figures, and NC-09 with no
  // delta at all, so the map drew four arrows of which only one happened to
  // agree with Supabase.
  //
  // The reason that survived to the public site is that the deploy guard scans
  // demo-data/race/ and never demo-data/map/. A fabricated delta in a versioned
  // JSON is indistinguishable from a real one, which is the whole reason the
  // guard exists.
  const payload = races.getMapFeatures({ cycle: CYCLE, raceType });
  writeJson(`map/${raceType}.json`, { ...payload, races: (payload.races || []).map(stripVolatile) });
}

const districts = db.prepare(`SELECT district_id FROM districts WHERE election_cycle = ?`).all(CYCLE);
const exported = new Set();
for (const { district_id } of districts) {
  const race = races.getRace(district_id, CYCLE);
  if (!race) continue;
  writeJson(`race/${district_id}.json`, stripVolatile(race));
  exported.add(district_id);
}

// Drop race files for seats the database no longer carries, e.g. a state whose
// Senate race this tracker has stopped following. The export only ever writes,
// so without this a stale file from a previous run is packaged into the site by
// the Vite build and published alongside the current data.
const raceDir = join(OUT, 'race');
if (existsSync(raceDir)) {
  for (const file of readdirSync(raceDir)) {
    const id = basename(file, '.json');
    if (!file.endsWith('.json') || exported.has(id)) continue;
    rmSync(join(raceDir, file));
    console.log(`  removed demo-data/race/${file} (no longer a tracked seat)`);
  }
}

writeJson('ticker.json', { cycle: CYCLE, items: races.getTicker({ cycle: CYCLE, limit: 25 }) });
writeJson('outline.json', JSON.parse(readFileSync(OUTLINE, 'utf8')));

console.log('Done.');