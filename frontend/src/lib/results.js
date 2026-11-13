import { assetUrl } from '../api.js';

let promise = null;
export function loadResults() {
  if (promise) return promise;
  promise = fetch(assetUrl('results.json'))
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return promise;
}

export function resultFor(data, districtId) {
  return (data && data.races && data.races[districtId]) || null;
}