// Data access layer. Three targets, in order of precedence:
//
//   1. WordPress (the shipping target). The plugin prints a `window.jceConfig`
//      from PHP, so the Supabase URL and anon key are runtime configuration
//      rather than baked into this bundle. One build then works across staging
//      and production, and a WP filter can repoint either without a rebuild.
//   2. Static demo (GitHub Pages). Reads pre-generated JSON from the same
//      normalised model, exported by backend/scripts/export-static.mjs.
//   3. Local development. Talks to the backend API.
//
// In the WordPress target every read falls back to the snapshot bundled in the
// plugin. That snapshot is the last good export, so a Supabase outage shows
// yesterday's numbers rather than a broken page -- which is the difference
// between a stale map and an empty one on an election night.

const WP = typeof window !== 'undefined' ? window.jceConfig : null;
const STATIC = import.meta.env.VITE_STATIC === '1';
const BASE = import.meta.env.BASE_URL || '/';
const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
const DATA_BASE = `${BASE.replace(/\/$/, '')}/demo-data`;

export const isStatic = STATIC;
export const isWordPress = Boolean(WP);

// Fetch with a one-shot fallback. `primary` is the live source, `fallback` the
// bundled snapshot. A fallback failure is fatal; a primary failure is reported
// once so the console says why the page is showing old numbers.
const warned = new Set();

async function getJson(url) {
  // GitHub Pages serves static assets with cache headers, and a stale
  // demo-data JSON would leave the map showing an older race set (e.g. an
  // NC-only U.S. Senate map) after a redeploy. Never reuse cached demo data.
  const res = await fetch(url, STATIC ? { cache: 'no-store' } : undefined);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function withFallback(label, primary, fallback) {
  try {
    return await primary();
  } catch (err) {
    if (!warned.has(label)) {
      warned.add(label);
      console.warn(`[jce] ${label} unavailable (${err.message}); using the bundled snapshot`);
    }
    return fallback();
  }
}

// --- WordPress / Supabase ---------------------------------------------------

async function rpc(fn, params = {}) {
  if (!WP) throw new Error('not running in WordPress');
  const url = new URL(`/rest/v1/rpc/${fn}`, WP.supabaseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return getJson(url.toString());
}

// Bundled snapshot paths, relative to the plugin directory. The geometry lives
// beside these: boundaries change once a redistricting cycle, so they ship in
// the plugin rather than being fetched.
function wpAsset(rel) {
  return new URL(rel, WP.assetBase).toString();
}

function wpSnapshot(rel) {
  return () => getJson(wpAsset(`data/snapshot/${rel}`));
}

// The map needs geometry attached, which the Supabase payload deliberately
// omits. Merge it in from the bundled shapes, keyed by district_id.
async function wpMap(raceType) {
  const payload = await rpc('map_payload', { p_race_type: raceType, p_cycle: WP.cycle || '2026' });
  const geo = await getJson(wpAsset(`data/geo/${raceType}.json`));
  const shapes = new Map(geo.features.map((f) => [f.district_id, f.geometry]));
  return {
    ...payload,
    features: payload.features.map((f) => ({ ...f, geometry: shapes.get(f.district_id) || null })),
  };
}

// --- public surface ---------------------------------------------------------

export function getMeta() {
  if (WP) {
    return withFallback('meta',
      () => rpc('meta', { p_cycle: WP.cycle || '2026' }).then((m) => ({
        ...m,
        // The demo payload nests the gauges one-per-chamber; keep the shape the
        // components expect so there is a single contract across all targets.
        house_outlook: m.outlooks?.us_house || null,
        senate_outlook: m.outlooks?.us_senate || null,
        nc_senate_outlook: m.outlooks?.nc_senate || null,
        nc_house_outlook: m.outlooks?.nc_house || null,
      })),
      wpSnapshot('meta.json'));
  }
  return STATIC ? getJson(`${DATA_BASE}/meta.json`) : getJson(`${API_BASE}/meta`);
}

export function getMap(raceType) {
  if (WP) return withFallback(`map:${raceType}`, () => wpMap(raceType), wpSnapshot(`map/${raceType}.json`));
  return STATIC
    ? getJson(`${DATA_BASE}/map/${raceType}.json`)
    : getJson(`${API_BASE}/map?race_type=${raceType}`);
}

export function getRace(districtId) {
  if (WP) return withFallback(`race:${districtId}`, () => wpSnapshot(`race/${districtId}.json`)(), () =>
    Promise.reject(new Error(`race ${districtId} not in the bundled snapshot`)));
  return STATIC
    ? getJson(`${DATA_BASE}/race/${districtId}.json`)
    : getJson(`${API_BASE}/races/${districtId}`);
}

export function getTicker(limit = 12) {
  if (WP) {
    return withFallback('ticker',
      () => rpc('ticker', { p_limit: limit }).then((items) => ({ items })),
      wpSnapshot('ticker.json'));
  }
  return STATIC
    ? getJson(`${DATA_BASE}/ticker.json`)
    : getJson(`${API_BASE}/ticker?limit=${limit}`);
}

export function getOutline() {
  if (WP) return getJson(wpAsset('data/outline.json'));
  return STATIC ? getJson(`${DATA_BASE}/outline.json`) : getJson(`${API_BASE}/outline`);
}