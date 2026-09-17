// Prepares canonical district GeoJSON from downloaded source files.
// Produces data/geojson/{us-house,state-senate,state-house}.json plus a state outline.
// Districts are keyed by district_id (NC-01, SD-18, HD-98).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT = join(ROOT, 'data', 'geojson');

const PLANS = [
  { file: 'us-house-2023-simple.geojson', raceType: 'us_house', id: (p) => `NC-${String(p.District).padStart(2, '0')}`, num: (p) => p.District },
  { file: 'nc-senate-2023-simple.geojson', raceType: 'state_senate', id: (p) => `SD-${String(p.District).padStart(2, '0')}`, num: (p) => p.District },
  { file: 'nc-house-2023-simple.geojson', raceType: 'state_house', id: (p) => `HD-${p.District}`, num: (p) => p.District },
];

function load(name) {
  const path = join(RAW, name);
  if (!existsSync(path)) throw new Error(`Missing raw file: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function clean(geojson, raceType, idFn, numFn) {
  const collection = { type: 'FeatureCollection', features: [] };
  for (const f of geojson.features) {
    const p = f.properties;
    collection.features.push({
      type: 'Feature',
      properties: { district_id: idFn(p), race_type: raceType, district_number: numFn(p) },
      geometry: f.geometry,
    });
  }
  return collection;
}

mkdirSync(OUT, { recursive: true });

for (const plan of PLANS) {
  const raw = load(plan.file);
  const canonical = clean(raw, plan.raceType, plan.id, plan.num);
  const outFile = join(OUT, `${plan.raceType}.json`);
  writeFileSync(outFile, JSON.stringify(canonical));
  const n = canonical.features.length;
  const sizeKb = (Buffer.byteLength(JSON.stringify(canonical)) / 1024).toFixed(0);
  console.log(`prepared ${plan.raceType}: ${n} features, ${sizeKb} KB -> ${outFile}`);
}

const outline = load('nc-state-outline.geojson');
const outlineGeom = outline.type === 'FeatureCollection'
  ? outline.features[0].geometry
  : outline.geometries?.length === 1 ? outline.geometries[0] : { type: 'MultiPolygon', coordinates: outline.geometries.flatMap((g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates) };
writeFileSync(join(OUT, 'state-outline.json'), JSON.stringify({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { name: 'North Carolina' }, geometry: outlineGeom }],
}));
console.log('prepared state-outline');