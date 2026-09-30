// Prepares the U.S. Senate map geometry.
//
// A Senate seat is a whole state, so this used to be one state outline per
// in-play seat built from the Census 5m states file. North Carolina is now the
// only state covered, and NC-SEN already reuses the detailed state outline that
// the in-state tabs are drawn against -- so the other states, their FIPS table,
// the simplification pass and Alaska's antimeridian/inset handling are all
// gone, and what remains is the one polygon.
//
// Produces data/geojson/us_senate.json. Run prepare-geometry.mjs first: it owns
// data/geojson/state-outline.json, which this reads.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'data', 'geojson');

const outlinePath = join(OUT, 'state-outline.json');
if (!existsSync(outlinePath)) {
  throw new Error(`Missing ${outlinePath}; run scripts/prepare-geometry.mjs first`);
}
const outline = JSON.parse(readFileSync(outlinePath, 'utf8')).features[0].geometry;

const collection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        district_id: 'NC-SEN',
        state: 'NC',
        state_name: 'North Carolina',
        race_type: 'us_senate',
        district_number: 0,
      },
      geometry: outline,
    },
  ],
};

mkdirSync(OUT, { recursive: true });
const outFile = join(OUT, 'us_senate.json');
writeFileSync(outFile, JSON.stringify(collection));
const kb = (Buffer.byteLength(JSON.stringify(collection)) / 1024).toFixed(0);
console.log(`prepared us_senate: ${collection.features.length} seat, ${kb} KB -> ${outFile}`);
