// Cached loader for the Kalshi accuracy dataset (pre-election prices + actual
// winners for the 15 NC federal races). Returns null if unavailable, so callers
// can omit the scorecard silently (e.g. in the plugin build).
import { assetUrl } from '../api.js';

let promise = null;
export function loadKalshiResults() {
  if (promise) return promise;
  promise = fetch(assetUrl('kalshi-results.json'))
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return promise;
}

export function kalshiResultFor(data, districtId) {
  return (data && data.races && data.races[districtId]) || null;
}

export function kalshiStats(data) {
  if (!data || !data.races) return null;
  const rows = Object.values(data.races);
  let brier = 0;
  let favoredWins = 0;
  let favoredTotal = 0;
  for (const r of rows) {
    const p = r.pre_dem;
    const y = r.actual === 'D' ? 1 : 0;
    brier += (p - y) ** 2;
    if (p > 0.5) { favoredTotal++; if (r.actual === 'D') favoredWins++; }
    else if (p < 0.5) { favoredTotal++; if (r.actual === 'R') favoredWins++; }
  }
  return {
    n: rows.length,
    brier: brier / rows.length,
    favoredWins,
    favoredTotal,
  };
}