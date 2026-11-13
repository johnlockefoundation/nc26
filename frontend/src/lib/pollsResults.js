let promise = null;
export function loadPollsResults() {
  if (promise) return promise;
  promise = fetch('/polls-results.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return promise;
}

export function pollsStats(data) {
  if (!data || !data.races) return null;
  const rows = Object.values(data.races);
  let brier = 0, favoredWins = 0, favoredTotal = 0;
  for (const r of rows) {
    const p = r.poll_dem / 100;
    const y = r.actual === 'D' ? 1 : 0;
    brier += (p - y) ** 2;
    if (p > 0.5) { favoredTotal++; if (r.actual === 'D') favoredWins++; }
    else if (p < 0.5) { favoredTotal++; if (r.actual === 'R') favoredWins++; }
  }
  return { n: rows.length, brier: brier / rows.length, favoredWins, favoredTotal };
}