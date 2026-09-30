// Fetches the enacted North Carolina congressional district plan that the 2026
// cycle runs on, converts it to WGS84 GeoJSON, and writes a simplified copy to
// data/raw/us-house-2025-simple.geojson for scripts/prepare-geometry.mjs.
//
// Source: Senate Bill 249 / S.L. 2025-95, enacted 2025-10-22, to be used for the
// 2026 election. It replaced S.L. 2023-145 (the 2024 map) and redrew the 1st and
// 3rd districts. The General Assembly publishes it only as an ESRI shapefile in
// NAD83 NC StatePlane (metres), so this script does the download, the zip, the
// .shp/.dbf parse and the reprojection with no third-party dependencies.
//
//   node scripts/fetch-us-house-geometry.mjs [--tolerance 0.0012] [--out FILE]
//
// --tolerance is the Douglas-Peucker tolerance in degrees. The default is about
// 110 m, which takes the 210k vertices the state publishes down to roughly 6k
// so the map stays cheap to load; raise it to shrink the payload further.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW = join(ROOT, 'data', 'raw');

const SOURCE = {
  name: 'S.L. 2025-95 (S.B. 249) congressional plan',
  url: 'https://webservices.ncleg.gov/ViewBillDocument/2025/7667/0/SL%202025-95%20-%20Shapefile',
  page: 'https://www.ncleg.gov/Redistricting',
  enacted: '2025-10-22',
  cycle: '2026',
};

// NAD83 / North Carolina StatePlane (FIPS 3200), Lambert Conformal Conic, from
// the shapefile's own .prj. Values must match that file exactly.
const SP = {
  lat0: 33.75,
  lat1: 34.33333333333334,
  lat2: 36.16666666666666,
  lon0: -79.0,
  falseEasting: 609601.22,
  falseNorthing: 0.0,
  a: 6378137.0,
  invF: 298.257222101,
};

// ---------------------------------------------------------------------------
// Projection: NC StatePlane -> WGS84 lon/lat (Snyder, eqs. 15-9 .. 15-11 inverted)
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

function buildLcc({ lat0, lat1, lat2, lon0, falseEasting, falseNorthing, a, invF }) {
  const f = 1 / invF;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const ms = (phi) => {
    const s = Math.sin(phi);
    return Math.cos(phi) / Math.sqrt(1 - e2 * s * s);
  };
  const ts = (phi) => {
    const s = Math.sin(phi);
    const t = Math.tan(Math.PI / 4 - phi / 2);
    return t / Math.pow((1 - e * s) / (1 + e * s), e / 2);
  };

  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const p0 = lat0 * DEG;
  const m1 = ms(p1);
  const m2 = ms(p2);
  const t1 = ts(p1);
  const t2 = ts(p2);
  const n = Math.log(m1 / m2) / Math.log(t1 / t2);
  // Snyder carries rho in units of the semi-major axis, so a belongs in F for
  // the projection to come out in metres.
  const F = (a * m1) / (n * Math.pow(t1, n));
  const rho0 = F * Math.pow(ts(p0), n);
  const lam0 = lon0 * DEG;

  // n is positive whenever lat1 < lat2, as it is for NC StatePlane.
  const sign = n >= 0 ? 1 : -1;

  // The ellipsoidal part of the isometric latitude, factored out so the inverse
  // can iterate on it: t(phi) = tan(pi/4 - phi/2) / corr(phi).
  const corr = (phi) => {
    const s = Math.sin(phi);
    return Math.pow((1 - e * s) / (1 + e * s), e / 2);
  };

  return (x, y) => {
    // rho is measured from the cone apex rather than from the false origin, so
    // the northing has to be measured against rho0 before taking the length.
    const xd = x - falseEasting;
    const yd = y - falseNorthing;
    const rho = sign * Math.hypot(xd, rho0 - yd);
    const theta = Math.atan2(xd, rho0 - yd);

    // t is recoverable directly, but phi is not: only the spherical form of t
    // inverts in closed form, so iterate phi <- pi/2 - 2 atan(t * corr(phi)),
    // which is fixed-point and converges in a handful of passes.
    const t = Math.pow(rho / F, 1 / n);
    let phi = Math.PI / 2 - 2 * Math.atan(t);
    for (let i = 0; i < 30; i++) {
      const next = Math.PI / 2 - 2 * Math.atan(t * corr(phi));
      if (Math.abs(next - phi) < 1e-12) { phi = next; break; }
      phi = next;
    }

    const lambda = theta / n + lam0;
    return [lambda / DEG, phi / DEG];
  };
}

const project = buildLcc(SP);

// ---------------------------------------------------------------------------
// ZIP (stored + deflate) via the central directory
// ---------------------------------------------------------------------------

function unzip(buf) {
  // locate End Of Central Directory, then walk the central directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');

    // local header, whose variable lengths may differ from the central entry
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    out.set(name, method === 0 ? Buffer.from(raw) : inflateRawSync(raw));

    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shapefile + DBF
// ---------------------------------------------------------------------------

// A .shp stores every integer and double little-endian except the leading File
// Code, which the ESRI spec writes big-endian.
function readShp(buf) {
  if (buf.readInt32BE(0) !== 9994) throw new Error('unexpected shapefile file code');
  const shapeType = buf.readInt32LE(32);
  const features = [];

  let off = 100;
  while (off + 8 <= buf.length) {
    const contentLen = buf.readInt32BE(off + 4) * 2;
    const start = off + 8;
    if (shapeType !== 5) throw new Error(`expected Polygon (5), got shape type ${shapeType}`);
    const numParts = buf.readInt32LE(start + 36);
    const numPoints = buf.readInt32LE(start + 40);
    const partsOff = start + 44;
    const pointsOff = partsOff + numParts * 4;

    const parts = [];
    for (let i = 0; i < numParts; i++) parts.push(buf.readInt32LE(partsOff + i * 4));

    const rings = [];
    for (let i = 0; i < numParts; i++) {
      const from = parts[i];
      const to = i + 1 < numParts ? parts[i + 1] : numPoints;
      const ring = [];
      for (let j = from; j < to; j++) {
        const p = pointsOff + j * 16;
        ring.push([buf.readDoubleLE(p), buf.readDoubleLE(p + 8)]);
      }
      rings.push(ring);
    }
    features.push(rings);
    off += 8 + contentLen;
  }
  return features;
}

function readDbf(buf) {
  const numRecords = buf.readInt32LE(4);
  const headerLen = buf.readInt16LE(8);
  const recordLen = buf.readInt16LE(10);

  const fields = [];
  for (let p = 32; p < headerLen - 1; ) {
    const name = buf.subarray(p, p + 11).toString('utf8').replace(/\0.*$/, '').trim();
    const len = buf[p + 16];
    fields.push({ name, len });
    p += 32;
  }

  const rows = [];
  for (let i = 0; i < numRecords; i++) {
    let p = headerLen + i * recordLen + 1; // skip the deletion flag
    const row = {};
    for (const f of fields) {
      row[f.name] = buf.subarray(p, p + f.len).toString('utf8').trim();
      p += f.len;
    }
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Ring helpers
// ---------------------------------------------------------------------------

function signedArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum / 2;
}

// Iterative Douglas-Peucker: rings here run to tens of thousands of points, so
// recursion is not an option.
function simplify(ring, tolerance) {
  const n = ring.length;
  if (n < 4) return ring;

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  const t2 = tolerance * tolerance;

  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (hi <= lo + 1) continue;
    const [ax, ay] = ring[lo];
    const [bx, by] = ring[hi];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;

    let best = -1;
    let bestD = 0;
    for (let i = lo + 1; i < hi; i++) {
      const [px, py] = ring[i];
      let d2;
      if (len2 === 0) {
        d2 = (px - ax) ** 2 + (py - ay) ** 2;
      } else {
        // perpendicular distance to the chord
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + t * dx;
        const qy = ay + t * dy;
        d2 = (px - qx) ** 2 + (py - qy) ** 2;
      }
      if (d2 > bestD) { bestD = d2; best = i; }
    }

    if (bestD > t2 && best > 0) {
      keep[best] = 1;
      stack.push([lo, best], [best, hi]);
    }
  }

  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(ring[i]);
  return out;
}

// A closed ring needs four positions (three corners plus the repeat) to be
// renderable; anything shorter is a sliver left behind by simplification.
const minRingPoints = 4;

// Six decimals is about 0.1 m, far finer than the tolerance already in play but
// it keeps the payload from being dominated by float noise.
const round = (v) => Math.round(v * 1e6) / 1e6;

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { tolerance: 0.0012, out: join(RAW, 'us-house-2025-simple.geojson') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tolerance') args.tolerance = Number(argv[++i]);
    else if (argv[i] === '--out') args.out = join(RAW, argv[++i]);
  }
  if (!Number.isFinite(args.tolerance) || args.tolerance <= 0) {
    throw new Error('--tolerance must be a positive number of degrees');
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
mkdirSync(RAW, { recursive: true });

const res = await fetch(SOURCE.url);
if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
const zip = Buffer.from(await res.arrayBuffer());

const files = unzip(zip);
const shpName = [...files.keys()].find((n) => n.toLowerCase().endsWith('.shp'));
const dbfName = [...files.keys()].find((n) => n.toLowerCase().endsWith('.dbf'));
if (!shpName || !dbfName) throw new Error('shapefile (.shp/.dbf) not found in archive');

const geometries = readShp(files.get(shpName));
const attributes = readDbf(files.get(dbfName));
if (geometries.length !== attributes.length) {
  throw new Error(`geometry/attribute mismatch: ${geometries.length} vs ${attributes.length}`);
}

const features = [];
let rawPoints = 0;
let keptPoints = 0;

for (let i = 0; i < geometries.length; i++) {
  const district = attributes[i].DISTRICT ?? attributes[i].District;
  if (district == null) throw new Error(`record ${i} has no DISTRICT attribute`);

  const rings = geometries[i].map((ring) => {
    rawPoints += ring.length;
    const projected = ring.map(([x, y]) => project(x, y));
    return simplify(projected, args.tolerance);
  });

  // Shapefile rings are clockwise for outer boundaries and counter-clockwise for
  // holes, so a ring whose orientation matches the first ring's starts a new
  // polygon and anything else is a hole in the polygon currently being built.
  const polygons = [];
  let current = null;
  const outerSign = Math.sign(signedArea(rings[0]));
  for (const ring of rings) {
    if (ring.length < minRingPoints) continue;
    const isOuter = Math.sign(signedArea(ring)) === outerSign;
    if (isOuter) {
      current = [ring];
      polygons.push(current);
    } else if (current) {
      current.push(ring);
    }
  }
  if (!polygons.length) throw new Error(`district ${district} simplified away entirely`);

  for (const poly of polygons) for (const ring of poly) keptPoints += ring.length;

  // RFC 7946 wants exterior rings counter-clockwise and holes clockwise.
  const orient = (ring) => (signedArea(ring) > 0 ? ring : ring.slice().reverse());
  const coordinates = polygons.map((poly) => poly.map((ring, idx) => {
    const closed = orient(ring).map(([lon, lat]) => [round(lon), round(lat)]);
    if (closed[0][0] !== closed[closed.length - 1][0] || closed[0][1] !== closed[closed.length - 1][1]) {
      closed.push(closed[0]);
    }
    return idx === 0 ? closed : closed.slice().reverse();
  }));

  features.push({
    type: 'Feature',
    properties: {
      // Same key the other raw district files use, which is what
      // scripts/prepare-geometry.mjs reads to derive district_id.
      District: Number(district),
      PL20AA_TOT: Number(attributes[i].PL20AA_TOT) || null,
      Enacted: SOURCE.enacted,
      Cycle: SOURCE.cycle,
    },
    geometry: coordinates.length === 1
      ? { type: 'Polygon', coordinates: coordinates[0] }
      : { type: 'MultiPolygon', coordinates },
  });
}

features.sort((a, b) => a.properties.District - b.properties.District);

const collection = { type: 'FeatureCollection', features };
writeFileSync(args.out, JSON.stringify(collection));

const kb = (Buffer.byteLength(JSON.stringify(collection)) / 1024).toFixed(0);
console.log(`${SOURCE.name} (enacted ${SOURCE.enacted}, ${SOURCE.cycle} cycle)`);
console.log(`  districts ${features.length} | points ${rawPoints} -> ${keptPoints} | tolerance ${args.tolerance} deg | ${kb} KB`);
console.log(`  wrote ${args.out}`);