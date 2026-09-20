// Data access layer. In development it talks to the backend API; in the
// static GitHub Pages demo it reads pre-generated JSON produced from the same
// normalized database by backend/scripts/export-static.mjs.

const STATIC = import.meta.env.VITE_STATIC === '1';
const BASE = import.meta.env.BASE_URL || '/';
const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
const DATA_BASE = `${BASE.replace(/\/$/, '')}/demo-data`;

async function getJson(url) {
  // GitHub Pages serves static assets with cache headers, and a stale
  // demo-data JSON would leave the map showing an older race set (e.g. an
  // NC-only U.S. Senate map) after a redeploy. Never reuse cached demo data.
  const res = await fetch(url, STATIC ? { cache: 'no-store' } : undefined);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export const isStatic = STATIC;

export function getMeta() {
  return STATIC ? getJson(`${DATA_BASE}/meta.json`) : getJson(`${API_BASE}/meta`);
}

export function getMap(raceType) {
  return STATIC
    ? getJson(`${DATA_BASE}/map/${raceType}.json`)
    : getJson(`${API_BASE}/map?race_type=${raceType}`);
}

export function getRace(districtId) {
  return STATIC
    ? getJson(`${DATA_BASE}/race/${districtId}.json`)
    : getJson(`${API_BASE}/races/${districtId}`);
}

export function getTicker(limit = 12) {
  return STATIC
    ? getJson(`${DATA_BASE}/ticker.json`)
    : getJson(`${API_BASE}/ticker?limit=${limit}`);
}

export function getOutline() {
  return STATIC ? getJson(`${DATA_BASE}/outline.json`) : getJson(`${API_BASE}/outline`);
}