// Export the invariant reference layer for the WordPress plugin.
//
// The plugin is the only deliverable, and the Supabase orchestrators are not
// built yet, so the shipped plugin has to be a complete, readable product with
// zero rows in Supabase. That means the plugin carries the facts that do not
// move -- who is running, the Civitas lean, which seats are in play -- and asks
// Supabase only for the things that do.
//
// The split is deliberate rather than by convenience:
//
//   Bundled here (invariant): candidate name/party/incumbent, the Civitas
//     lean and rating bucket, the in-play designation and its reason, and the
//     map geometry. 170 of the 185 seats have no polling, no market and no
//     fundraising at all, so for 92% of the map this file IS the product -- not
//     a fallback for it.
//
//   Left to Supabase (volatile): polls, prediction markets, fundraising and
//     news. Markets keep their live fetch. Polls and money are hand-entered,
//     which is why they must never be frozen into a plugin file: a bundled
//     hand-entered number would carry no timestamp and read as live.
//
// Geometry is stripped from the map features and shipped separately by
// prepare-geometry, because it is 636 KB of the payload and the client already
// merges it in by district_id (see api.js).
//
// The export deliberately reuses getMapFeatures/getRace rather than reshaping
// the payload by hand, so the reference layer cannot drift from the shape the
// components actually consume. Volatile keys are then removed from that
// serializer's own output.

import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BACKEND = resolve(__dirname, '..');

const { db, initSchema } = await import(pathToFileURL(join(BACKEND, 'src', 'db.js')));
const { CYCLE } = await import(pathToFileURL(join(BACKEND, 'src', 'ingest', 'config.js')));
const races = await import(pathToFileURL(join(BACKEND, 'src', 'lib', 'races.js')));

// The plugin is a directory that can be uploaded, so the default output is a
// plugin-shaped tree rather than the demo-data tree the Pages export writes.
const OUT = process.env.REFERENCE_OUT || resolve(BACKEND, '..', 'frontend', 'public', 'data', 'reference');

const RACE_TYPES = ['us_house', 'us_senate', 'state_senate', 'state_house'];

// Everything a Supabase read is expected to supply. Absent from the reference
// layer, absent from the page, rendered as "unavailable" by the components
// that already handle a null summary.
// Volatile = things a person or a fetch changes on a schedule, and which must
// therefore never be frozen into a shipped plugin file. Polls and money are
// hand-entered in Supabase (`money` for federal races, `state_funds` for
// General Assembly ones); markets keep their live fetch.
//
// `profile` and `vitals` are deliberately NOT here. They look volatile because
// they sit beside the signal blocks in the panel, but they are fixed for the
// cycle: the profile is a Census ACS 2024 5-year extract plus fixed 2024
// results, and the vitals are the delta between two dated NCSBE snapshots.
// Bundling them is what lets the plugin's DEMOGRAPHICS block render with no
// network at all, and it is the whole reason demographics is a category across
// all four chambers rather than only on the seats Supabase happens to cover.
const VOLATILE_RACE_KEYS = [
  'polls', 'poll_detail', 'markets', 'market_list', 'money', 'state_funds',
  'news', 'coverage', 'last_updated',
];

// Same list for the map feature's metrics block, which is a compressed copy of
// the volatile advantages.
function stripMetrics(feature) {
  const { metrics, geometry, ...rest } = feature;
  return rest;
}

function writeJson(rel, data) {
  const abs = join(OUT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(data, null, 0));
  return Buffer.byteLength(JSON.stringify(data, null, 0));
}

initSchema();

const districtCount = db.prepare('SELECT COUNT(*) AS n FROM districts WHERE election_cycle = ?').get(CYCLE).n;
if (!districtCount) {
  console.error('\nERROR: the database has no districts for cycle ' + CYCLE + '.');
  console.error('Run `npm run ingest` first -- the database is gitignored, so a clean');
  console.error('checkout (CI) starts empty.');
  process.exit(1);
}

console.log(`Exporting reference layer (cycle ${CYCLE}) -> ${OUT}`);

const civitas = JSON.parse(readFileSync(join(BACKEND, 'data', 'seed', 'civitas.json'), 'utf8'));
let bytes = 0;

// --- map features, per race type, geometry stripped -------------------------
// The `races` array is kept, slimmed to the invariant fields. App.jsx reads
// mapData.races for the district matchup labels, so dropping it would leave
// every shape on the map blank -- the labels come from the candidate names.
for (const raceType of RACE_TYPES) {
  const payload = races.getMapFeatures({ cycle: CYCLE, raceType });
  const stripped = {
    cycle: payload.cycle,
    race_type: payload.race_type,
    races: payload.races.map((r) => {
      const out = {};
      for (const [k, v] of Object.entries(r)) {
        if (VOLATILE_RACE_KEYS.includes(k)) continue;
        out[k] = v;
      }
      return out;
    }),
    features: payload.features.map(stripMetrics),
  };
  bytes += writeJson(`map/${raceType}.json`, stripped);
  console.log(`  map/${raceType}.json  ${stripped.features.length} features, ${stripped.races.length} races`);
}

// --- per-seat race detail, volatile keys removed ----------------------------
const districts = db.prepare(
  'SELECT district_id FROM districts WHERE election_cycle = ? ORDER BY race_type, district_number'
).all(CYCLE);

const exported = new Set();
for (const { district_id } of districts) {
  const race = races.getRace(district_id, CYCLE);
  if (!race) continue;
  const stripped = {};
  for (const [k, v] of Object.entries(race)) {
    if (VOLATILE_RACE_KEYS.includes(k)) continue;
    stripped[k] = v;
  }
  // Keep the provenance pointer on the partisan block honest. races.js stamps
  // the Civitas source URL unconditionally, which is wrong for the House
  // districts: those leans are a "Civitas-style CPI" derived from 2024 Council
  // of State races, not from the General Assembly dump that URL describes.
  // Without this the plugin would ship a mis-attribution that is invisible once
  // it is baked into a file.
  if (stripped.partisan && stripped.partisan.available && race.race_type === 'us_house') {
    stripped.partisan = {
      ...stripped.partisan,
      source_note: 'Civitas-style index derived from 2024 Council of State results, not a Civitas congressional rating.',
    };
  }
  bytes += writeJson(`race/${district_id}.json`, stripped);
  exported.add(district_id);
}

// The export only ever writes, so a seat dropped from the tracker (a state
// Senate race we stopped following) would otherwise leave a stale file in the
// tree and ship it inside the plugin.
const raceDir = join(OUT, 'race');
if (existsSync(raceDir)) {
  for (const file of readdirSync(raceDir)) {
    if (!file.endsWith('.json')) continue;
    const id = file.slice(0, -5);
    if (exported.has(id)) continue;
    rmSync(join(raceDir, file));
    console.log(`  removed race/${file} (no longer a tracked seat)`);
  }
}

// --- geometry ---------------------------------------------------------------
// Shipped rather than fetched: boundaries change once a redistricting cycle, so
// putting them in the plugin costs nothing in updates and makes the map work
// with no network at all.
//
// district_id is lifted out of `properties` to the feature top level. That is
// the convention every other payload here already uses -- map features and race
// records both carry it flat -- and api.js keys the geometry merge on the
// top-level field. The source shapefiles nest it, so a straight copy would key
// every shape on `undefined`, resolve every merge to null, and render an empty
// map with no error raised anywhere.
const GEO_DIR = join(BACKEND, 'data', 'geojson');
for (const raceType of RACE_TYPES) {
  const src = join(GEO_DIR, `${raceType}.json`);
  if (!existsSync(src)) {
    console.error(`\nERROR: missing geometry for ${raceType}: ${src}`);
    console.error('Run the geometry prepare scripts before exporting.');
    process.exit(1);
  }
  const geo = JSON.parse(readFileSync(src, 'utf8'));
  const out = {
    type: 'FeatureCollection',
    features: geo.features.map((f) => ({
      type: 'Feature',
      district_id: f.properties?.district_id ?? null,
      properties: f.properties || {},
      geometry: f.geometry,
    })),
  };
  const missing = out.features.filter((f) => !f.district_id).length;
  if (missing) {
    console.error(`\nERROR: ${missing} feature(s) in ${raceType}.json carry no district_id.`);
    process.exit(1);
  }
  bytes += writeJson(`../geo/${raceType}.json`, out);
  console.log(`  geo/${raceType}.json  ${out.features.length} shapes`);
}

const OUTLINE = join(GEO_DIR, 'state-outline.json');
if (existsSync(OUTLINE)) {
  bytes += writeJson('../outline.json', JSON.parse(readFileSync(OUTLINE, 'utf8')));
  console.log('  outline.json');
}

// --- meta ------------------------------------------------------------------
// Provenance is per-field rather than one global "source", because the fields
// in this file do not share a source and do not share a strength of claim.
bytes += writeJson('meta.json', {
  cycle: CYCLE,
  generated_at: new Date().toISOString(),
  race_types: db.prepare(`SELECT race_type, COUNT(*) AS total,
      SUM(CASE WHEN competitive = 1 THEN 1 ELSE 0 END) AS competitive
    FROM districts WHERE election_cycle = ? GROUP BY race_type`).all(CYCLE),
  provenance: {
    state_candidates: {
      source: civitas.source,
      note: 'Official Civitas CPI reference file from the John Locke Foundation.',
    },
    state_partisan: {
      source: civitas.source,
      note: 'Signed lean and rating bucket per General Assembly seat. Fixed for the cycle.',
    },
    us_house_candidates: {
      source: 'NC Board of Elections 2026 candidate list and public reporting; matched to FEC statements of candidacy.',
      note: 'Hand-curated. Changes on a withdrawal or a convention selection, not on a schedule.',
    },
    us_house_partisan: {
      source: 'Civitas-style index derived from 2024 Council of State results.',
      note: 'Not a Civitas rating of the congressional race. Treat as a baseline lean only.',
    },
    us_senate: {
      source: 'Cook Political Report, September 2026.',
      note: 'No Civitas index for this seat; the panel reports the partisan block as unavailable.',
    },
    geometry: {
      source: 'NC General Assembly redistricting shapefiles (2023); US House and Senate from Census TIGER/Line.',
      note: 'Fixed until the next redistricting cycle.',
    },
  },
  volatile: {
    polls: 'supabase',
    markets: 'supabase',
    money: 'supabase',
    news: 'supabase',
    note: 'Absent from this export by design. The page renders these as unavailable until a Supabase read succeeds.',
  },
});

console.log(`Done. ${exported.size} seats, ${(bytes / 1024).toFixed(0)} KB total.`);
