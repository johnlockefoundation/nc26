// Export the normalized database as static JSON for the GitHub Pages demo.
// Writes into frontend/public/demo-data so Vite packages it with the site.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');

const { db } = await import(pathToFileURL(join(BACKEND, 'src', 'db.js')));
const { CYCLE, HOUSE_OUTLOOK } = await import(pathToFileURL(join(BACKEND, 'src', 'ingest', 'config.js')));
const races = await import(pathToFileURL(join(BACKEND, 'src', 'lib', 'races.js')));

const OUT = process.env.STATIC_OUT || resolve(BACKEND, '..', 'frontend', 'public', 'demo-data');
const OUTLINE = join(BACKEND, 'data', 'geojson', 'state-outline.json');

const RACE_TYPES = ['us_house', 'us_senate', 'state_senate', 'state_house'];

function writeJson(rel, data) {
  const abs = join(OUT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(data, null, 0));
  console.log(`  ${join('demo-data', rel)}`);
}

console.log(`Exporting static demo data (cycle ${CYCLE}) → ${OUT}`);

const meta = { cycle: CYCLE, race_types: null, house_outlook: HOUSE_OUTLOOK, sources: races.getSourceStatus() };
const counts = db.prepare(`SELECT race_type, COUNT(*) AS total,
    SUM(CASE WHEN competitive = 1 THEN 1 ELSE 0 END) AS competitive
  FROM districts WHERE election_cycle = ? GROUP BY race_type`).all(CYCLE);
meta.race_types = counts;
writeJson('meta.json', meta);

for (const raceType of RACE_TYPES) {
  writeJson(`map/${raceType}.json`, races.getMapFeatures({ cycle: CYCLE, raceType }));
}

const districts = db.prepare(`SELECT district_id FROM districts WHERE election_cycle = ?`).all(CYCLE);
for (const { district_id } of districts) {
  const race = races.getRace(district_id, CYCLE);
  if (race) writeJson(`race/${district_id}.json`, race);
}

writeJson('ticker.json', { cycle: CYCLE, items: races.getTicker({ cycle: CYCLE, limit: 25 }) });
writeJson('outline.json', JSON.parse(readFileSync(OUTLINE, 'utf8')));

console.log('Done.');