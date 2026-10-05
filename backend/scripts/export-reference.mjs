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
// prepare-geometry, because it is ~610 KB of the ~960 KB plugin payload and the
// client already merges it in by district_id (see api.js). The total the export
// prints on its last line is the source of truth; it moves as the race set does.
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
const { CYCLE, HOUSE_OUTLOOK, SENATE_OUTLOOK, NC_SENATE_OUTLOOK, NC_HOUSE_OUTLOOK } = await import(pathToFileURL(join(BACKEND, 'src', 'ingest', 'config.js')));
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
// Every key here is read live per-seat by getRace in api.js: polls from
// poll_summary, markets and market_list from markets_summary and market_list,
// money from money_summary, state_funds from state_funds_summary, vitals from
// vitals_summary, news from district_news. All seven were stripped before any of
// those reads existed, which is why a key here without a matching function is a
// bug rather than a to-do: markets and money sat stripped for a month and their
// widgets rendered nothing.
//
// `vitals` joined this list for a different reason than the others. It was
// treated as fixed for the cycle -- the delta between two dated NCSBE
// snapshots -- and bundled on that basis. The rows it was bundling were
// invented placeholders (backend/scripts/generate-mock-ga.mjs, every row
// is_mock = 1), so "fixed for the cycle" turned out to mean "frozen fiction
// that shipped to every site". Real extracts get loaded into Supabase and read
// through vitals_summary() like every other panel figure.
//
// `profile` is deliberately still absent from this list. It is a genuine Census
// ACS 2024 5-year extract plus fixed 2024 results, so it is really fixed for
// the cycle, and bundling it is what lets the plugin's DEMOGRAPHICS block render
// with no network at all -- the whole reason demographics is a category across
// all four chambers rather than only on the seats Supabase happens to cover.
// The distinction the list now draws is verified-against-a-real-extract versus
// not, not how volatile the number looks.
// Keys that only the Pages demo reads, stripped from the plugin's reference
// layer and kept in the demo export.
//
// This list exists because the two exports share the payload builders
// (getMapFeatures / getRaceSummary) so they cannot drift apart in shape. That
// sharing has a cost: anything added to a race lands in both targets, so a field
// added for a Pages-only view ships to every WordPress install unless it is
// named here. holder_party and holder_name are read by exactly one component --
// the General Assembly hemicycle on /seats.html, which is a Pages route and is not
// part of the plugin at all -- and nothing in the plugin's bundle references
// either name, so shipping them was 170 seats' worth of payload describing a
// chart that does not exist there.
//
// The check that this is true is in tools/build.sh, which fails the package if
// any of these keys reaches the zip.
const PAGES_ONLY_RACE_KEYS = ['holder_party', 'holder_name'];

// The same list applied one level deeper. holder_party and holder_name are not
// top-level race keys -- they live inside the nested `partisan` block that
// getRaceSummary builds -- so the top-level filter above silently does nothing
// to them, which is exactly what happened the first time this was wired up. The
// package check caught it.
function stripPartisanKeys(race) {
  if (!race.partisan || typeof race.partisan !== 'object') return race;
  const partisan = { ...race.partisan };
  let changed = false;
  for (const k of PAGES_ONLY_RACE_KEYS) {
    if (k in partisan) { delete partisan[k]; changed = true; }
  }
  return changed ? { ...race, partisan } : race;
}

const VOLATILE_RACE_KEYS = [
  'polls', 'markets', 'market_list', 'money', 'state_funds', 'vitals',
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
        if (PAGES_ONLY_RACE_KEYS.includes(k)) continue;
        out[k] = v;
      }
      return stripPartisanKeys(out);
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
// Civitas is an NCGA instrument, so the per-seat partisan block is exported for
// General Assembly races only. The congressional rows in the database carry a
// Council-of-State-derived stand-in rather than a Civitas rating, and races.js
// already withholds it, so nothing further is needed here beyond not
// reintroducing the us_house source_note correction that is now moot.
for (const { district_id } of districts) {
  const race = races.getRace(district_id, CYCLE);
  if (!race) continue;
  const stripped = {};
  for (const [k, v] of Object.entries(race)) {
    if (VOLATILE_RACE_KEYS.includes(k)) continue;
    if (PAGES_ONLY_RACE_KEYS.includes(k)) continue;
    stripped[k] = v;
  }
  bytes += writeJson(`race/${district_id}.json`, stripPartisanKeys(stripped));
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
    console.error('Run the matching script under backend/scripts/ first:');
    console.error('  node backend/scripts/fetch-us-house-geometry.mjs   (us_house)');
    console.error('  node backend/scripts/prepare-senate-geometry.mjs  (us_senate)');
    console.error('  node backend/scripts/prepare-geometry.mjs         (state_house, state_senate)');
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
// The chamber outlooks are bundled for the same reason the Civitas leans are:
// a forecast is dated and sourced, so freezing it is honest, and freezing the
// *absence* of it is not. Without these the plugin's meta.json carries no gauge
// figures at all, and since Supabase's outlooks table is empty the four gauge
// tabs silently disappear from the shipped plugin -- a regression from the
// Pages build, which gets them from the static export. They stay overridable
// from Supabase: api.js prefers a live outlook and falls back to these.
bytes += writeJson('meta.json', {
  cycle: CYCLE,
  generated_at: new Date().toISOString(),
  house_outlook: HOUSE_OUTLOOK,
  senate_outlook: SENATE_OUTLOOK,
  nc_senate_outlook: NC_SENATE_OUTLOOK,
  nc_house_outlook: NC_HOUSE_OUTLOOK,
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
    us_senate: {
      source: 'Cook Political Report, September 2026.',
      note: 'No Civitas index for this seat; the panel reports the partisan block as unavailable.',
    },
    // Civitas is an NCGA instrument, so it is deliberately absent from the
    // congressional payloads rather than approximated. There is no us_house
    // partisan provenance entry because there is no us_house partisan data:
    // federal races are carried by polling and money in Supabase, and a
    // Council-of-State stand-in would be a baseline lean wearing a rating's
    // name.
    civitas_scope: {
      source: civitas.source,
      note: 'Applies to General Assembly seats only. Withheld from US House and US Senate races.',
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
    note: 'Absent from this export by design, so no hand-entered number is frozen into a shipped plugin file. Each has a live read on the panel: polls (poll_summary), markets and market_list (markets_summary, market_list), money (money_summary), state_funds (state_funds_summary), vitals (vitals_summary), news (district_news). A seat with no rows reads available:false and the block renders as pending rather than showing a bundled figure.',
  },
});

console.log(`Done. ${exported.size} seats, ${(bytes / 1024).toFixed(0)} KB total.`);
