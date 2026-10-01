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
// In the WordPress target the plugin ships its own reference layer, and Supabase
// is layered on top for the data that moves. The reference layer is static
// files in the plugin, so the page is fully readable with no network at all:
// candidate names, the Civitas lean, which seats are in play, and the geometry.
// The Supabase orchestrators are not built yet, so on first load every live
// read misses and the bundled layer stands alone -- that is the expected state,
// not an outage. For 170 of the 185 seats there is nothing else to show anyway.

const WP = typeof window !== 'undefined' ? window.jceConfig : null;
const STATIC = import.meta.env.VITE_STATIC === '1';
const BASE = import.meta.env.BASE_URL || '/';
const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
const DATA_BASE = `${BASE.replace(/\/$/, '')}/demo-data`;

export const isStatic = STATIC;
export const isWordPress = Boolean(WP);

// Fetch with a one-shot fallback. `primary` is the live source, `fallback` the
// bundled reference. A fallback failure is fatal; a primary failure is reported
// once so the console says why the page is showing only bundled data.
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
      console.warn(`[jce] ${label} unavailable (${err.message}); using the bundled reference`);
    }
    return fallback();
  }
}

// For reads that overlay onto a bundled base rather than replace it. A failure
// is the expected steady state until the orchestrators are live, so it resolves
// to null and the caller keeps the bundled record instead of unwinding.
async function awaitQuietly(label, primary) {
  try {
    return await primary();
  } catch (err) {
    if (!warned.has(label)) {
      warned.add(label);
      console.warn(`[jce] ${label} unavailable (${err.message}); showing bundled reference data only`);
    }
    return null;
  }
}

// --- WordPress / Supabase ---------------------------------------------------

async function rpc(fn, params = {}) {
  if (!WP) throw new Error('not running in WordPress');
  const url = new URL(`/rest/v1/rpc/${fn}`, WP.supabaseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return getJson(url.toString());
}

// Bundled reference paths, relative to the plugin directory. The geometry lives
// beside these: boundaries change once a redistricting cycle, so they ship in
// the plugin rather than being fetched.
function wpAsset(rel) {
  return new URL(rel, WP.assetBase).toString();
}

// The reference layer is the guaranteed floor, not a fallback. It is a static
// file inside the plugin, so it resolves without a network and without
// Supabase, and it carries only what does not move: candidate names, the
// Civitas lean, and which seats are in play. 170 of the 185 seats have no
// polling, no market and no fundraising at all, so for 92% of the map this is
// the whole content and the page is fully readable with Supabase absent.
//
// Volatile data is layered on top from Supabase when it answers. It is never
// substituted for a bundled number: a hand-entered poll or a live market price
// that is not in Supabase is left missing and rendered as unavailable. Swapping
// in a stale copy of a price would be worse than showing none, because a stale
// price looks exactly like a live one.
function wpReference(rel) {
  return getJson(wpAsset(`data/reference/${rel}`));
}

// Static files that ship in both builds, so the same <img> works whichever host
// is serving. In WordPress they come off the plugin directory via assetBase; on
// Pages they are served from the site root, which Vite reports as BASE_URL.
//
// Joined as strings rather than resolved with new URL(), because BASE_URL is
// root-relative ("/" or "/nc26/") and the URL constructor requires an absolute
// base -- it throws "Invalid URL" on exactly the values Pages supplies. That
// throw happened inside render, so React tore down the whole tree and the page
// went blank with no partial fallback. assetBase is absolute, so new URL() is
// safe on the WordPress branch and is kept there.
export function assetUrl(rel) {
  if (WP) return wpAsset(rel);
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base + rel : `${base}/${rel}`;
}

// Attach geometry to a map payload, keyed by district_id. Geometry ships
// separately from the reference layer because it is 636 KB of the total and
// changes only at a redistricting.
async function withGeometry(payload, raceType) {
  const geo = await getJson(wpAsset(`data/geo/${raceType}.json`));
  const shapes = new Map(geo.features.map((f) => [f.district_id, f.geometry]));
  return {
    ...payload,
    features: (payload.features || []).map((f) => ({ ...f, geometry: shapes.get(f.district_id) || null })),
  };
}

// Overlay Supabase's volatile fields onto a bundled record. Field-level and
// additive: only keys Supabase actually returned are copied, so an absent or
// partial payload leaves the bundled invariant fields intact rather than
// replacing the record with nulls.
function overlayVolatile(base, live) {
  if (!live) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(live)) {
    if (v == null) continue;
    out[k] = v;
  }
  return out;
}

// Same, for the map. Features merge by district_id; the races array is matched
// by district_id too rather than by position, so a seat added on one side
// cannot shift every later row onto the wrong race.
function overlayMap(base, live) {
  if (!live) return base;
  const liveFeatures = new Map((live.features || []).map((f) => [f.district_id, f]));
  return {
    ...base,
    features: base.features.map((f) => {
      const l = liveFeatures.get(f.district_id);
      if (!l) return f;
      const merged = { ...f };
      if (l.metrics) merged.metrics = l.metrics;
      return merged;
    }),
    races: base.races.map((r) => overlayVolatile(r, live.races?.find((x) => x.district_id === r.district_id))),
  };
}

// --- public surface ---------------------------------------------------------

export function getMeta() {
  if (WP) {
    // The reference meta is the cycle, the race-type counts and the provenance
    // block -- all invariant, so the gauges' outlook figures are the only part
    // that can be missing. MiniGauge returns null without an outlook, which
    // leaves the tab absent rather than showing an empty dial.
    return wpReference('meta.json').then((base) =>
      withFallback('meta',
        () => rpc('meta', { p_cycle: WP.cycle || '2026' }).then((m) => ({
          ...base,
          ...m,
          // The demo payload nests the gauges one-per-chamber; keep the shape the
          // components expect so there is a single contract across all targets.
          house_outlook: m.outlooks?.us_house || null,
          senate_outlook: m.outlooks?.us_senate || null,
          nc_senate_outlook: m.outlooks?.nc_senate || null,
          nc_house_outlook: m.outlooks?.nc_house || null,
        })),
        () => base));
  }
  return STATIC ? getJson(`${DATA_BASE}/meta.json`) : getJson(`${API_BASE}/meta`);
}

export function getMap(raceType) {
  if (WP) {
    return wpReference(`map/${raceType}.json`).then((base) =>
      withGeometry(overlayMap(base,
        // A failed read is normal, not exceptional: the orchestrators are not
        // built yet, so this resolves to the bundled map on first load.
        awaitQuietly(`map:${raceType}`, () => rpc('map_payload', { p_race_type: raceType, p_cycle: WP.cycle || '2026' })),
      ), raceType));
  }
  return STATIC
    ? getJson(`${DATA_BASE}/map/${raceType}.json`)
    : getJson(`${API_BASE}/map?race_type=${raceType}`);
}

export function getRace(districtId) {
  if (WP) {
    // Reference-only for now. Per-seat volatile reads (polls, money, news) have
    // no Supabase endpoint defined yet, so the bundled invariant record is the
    // whole payload rather than a fallback -- the panel renders its unavailable
    // states and the seat is still fully readable.
    return wpReference(`race/${districtId}.json`).catch(() => {
      throw new Error(`race ${districtId} not in the bundled reference layer`);
    });
  }
  return STATIC
    ? getJson(`${DATA_BASE}/race/${districtId}.json`)
    : getJson(`${API_BASE}/races/${districtId}`);
}

export function getTicker(limit = 12) {
  if (WP) {
    // No bundled ticker: every story is by definition newer than the plugin
    // build, so a frozen copy would be stale on arrival. With Supabase absent
    // the ticker is simply absent, which is honest.
    return withFallback('ticker',
      () => rpc('ticker', { p_limit: limit }).then((items) => ({ items })),
      () => ({ items: [] }));
  }
  return STATIC
    ? getJson(`${DATA_BASE}/ticker.json`)
    : getJson(`${API_BASE}/ticker?limit=${limit}`);
}

export function getOutline() {
  if (WP) return getJson(wpAsset('data/outline.json'));
  return STATIC ? getJson(`${DATA_BASE}/outline.json`) : getJson(`${API_BASE}/outline`);
}