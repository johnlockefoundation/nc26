// Prepares the U.S. Senate map geometry: one state outline per in-play seat,
// keyed by district_id (NC-SEN, ME-SEN, ...). Source is the Census 5m states
// shapefile converted to GeoJSON (backend/data/raw/us-states-5m.json).
// North Carolina reuses the detailed existing state outline.
// Produces data/geojson/us_senate.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT = join(ROOT, 'data', 'geojson');

// FIPS -> { abbr, name } for the in-play 2026 Senate seats (Cook battleground).
const STATES = [
  { fips: '37', abbr: 'NC', name: 'North Carolina' },
  { fips: '23', abbr: 'ME', name: 'Maine' },
  { fips: '02', abbr: 'AK', name: 'Alaska' },
  { fips: '26', abbr: 'MI', name: 'Michigan' },
  { fips: '39', abbr: 'OH', name: 'Ohio' },
  { fips: '19', abbr: 'IA', name: 'Iowa' },
  { fips: '48', abbr: 'TX', name: 'Texas' },
  { fips: '13', abbr: 'GA', name: 'Georgia' },
  { fips: '33', abbr: 'NH', name: 'New Hampshire' },
  { fips: '31', abbr: 'NE', name: 'Nebraska' },
];

const TOL_DEG = 0.02; // Douglas-Peucker tolerance in degrees (~2 km)

function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const qx = a[0] + t * dx, qy = a[1] + t * dy;
  return (p[0] - qx) ** 2 + (p[1] - qy) ** 2;
}

function simplifyRing(ring, tol) {
  if (ring.length < 4) return ring;
  const keep = [0, ring.length - 1];
  const inner = ring.slice(1, -1);
  const work = [{ start: 0, end: inner.length + 1 }];
  const sq = tol * tol;
  while (work.length) {
    const { start, end } = work.pop();
    const a = ring[start];
    const b = ring[end];
    let maxD = 0, idx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distToSegment(ring[i], a, b);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sq && idx > 0) {
      keep.push(idx);
      work.push({ start: idx, end });
      work.push({ start, end: idx });
    }
  }
  return keep.sort((x, y) => x - y).map((i) => ring[i]);
}

function simplifyMulti(geometry, tol) {
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map((ring) => simplifyRing(ring, tol)) };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates
        .map((poly) => poly.map((ring) => simplifyRing(ring, tol)))
        .filter((poly) => poly.length > 0 && poly.some((ring) => ring.length >= 4)),
    };
  }
  throw new Error(`unsupported geometry: ${geometry.type}`);
}

function fullStates() {
  const path = join(RAW, 'us-states-5m.json');
  if (!existsSync(path)) throw new Error(`Missing raw file: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ncOutline() {
  const path = join(OUT, 'state-outline.json');
  if (!existsSync(path)) throw new Error(`Missing ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')).features[0].geometry;
}

const src = fullStates();
const byFips = new Map(src.features.map((f) => [String(f.properties.STATE).padStart(2, '0'), f]));

const collection = { type: 'FeatureCollection', features: [] };
for (const s of STATES) {
  const raw = byFips.get(s.fips);
  if (!raw) throw new Error(`missing FIPS ${s.fips} (${s.name})`);
  // Alaska's Aleutian chain crosses the antimeridian; drop the tiny islands
  // west of 175°E and fold any remaining east-of-dateline points into the
  // western hemisphere so the polygon doesn't wrap the whole world on the map.
  const geometry = s.abbr === 'AK'
    ? {
        type: 'MultiPolygon',
        coordinates: raw.geometry.coordinates
          .map((poly) => poly
            .filter((ring) => ring.every(([lng]) => lng <= 175))
            .map((ring) => ring.map(([lng, lat]) => [lng > 0 ? Math.max(-180, lng - 360) : lng, lat])))
          .filter((poly) => poly.length),
      }
    : raw.geometry;

  const geom = s.abbr === 'NC' ? ncOutline() : simplifyMulti(geometry, TOL_DEG);
  collection.features.push({
    type: 'Feature',
    properties: {
      district_id: `${s.abbr}-SEN`,
      state: s.abbr,
      state_name: s.name,
      race_type: 'us_senate',
      district_number: 0,
    },
    geometry: geom,
  });
}

mkdirSync(OUT, { recursive: true });
const outFile = join(OUT, 'us_senate.json');
writeFileSync(outFile, JSON.stringify(collection));
const kb = (Buffer.byteLength(JSON.stringify(collection)) / 1024).toFixed(0);
console.log(`prepared us_senate: ${collection.features.length} states, ${kb} KB -> ${outFile}`);
collection.features.forEach((f) => {
  const size = (Buffer.byteLength(JSON.stringify(f.geometry)) / 1024).toFixed(1);
  console.log(`  ${f.properties.district_id}  ${f.properties.state_name.padEnd(16)} ${f.geometry.type} ${size} KB`);
});
