// Fetch live 2026 election prices from PredictIt's public API and write the
// normalized market drop consumed by:  node src/ingest/index.js markets
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const OUT = join(BACKEND, 'data', 'sources', 'markets.json');

// district_id -> PredictIt market id
const MARKETS = {
  'NC-01': 8184,
  'NC-11': 8909,
  'NC-SEN': 8160,
  'US-HOUSE': 8157,
  'US-SENATE': 8155,
};

function demRepPrices(contract) {
  const dem = (contract || []).find((c) => /^Democratic/.test(c.name || ''));
  const rep = (contract || []).find((c) => /^Republican/.test(c.name || ''));
  return {
    dem: dem && dem.lastTradePrice != null ? +dem.lastTradePrice.toFixed(2) : null,
    rep: rep && rep.lastTradePrice != null ? +rep.lastTradePrice.toFixed(2) : null,
  };
}

export async function fetchPredictIt() {
  const res = await fetch('https://www.predictit.org/api/marketdata/all/', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`predictit http ${res.status}`);
  const data = await res.json();
  const updated_at = data.timestamp || new Date().toISOString();

  const markets = [];
  for (const [districtId, marketId] of Object.entries(MARKETS)) {
    const m = (data.markets || []).find((x) => x.id === marketId);
    if (!m) continue;
    const demC = (m.contracts || []).find((c) => /^Democratic/.test(c.name || ''));
    const repC = (m.contracts || []).find((c) => /^Republican/.test(c.name || ''));
    markets.push({
      district_id: districtId,
      provider: 'PredictIt',
      dem_price: demC && demC.lastTradePrice != null ? +demC.lastTradePrice.toFixed(2) : null,
      rep_price: repC && repC.lastTradePrice != null ? +repC.lastTradePrice.toFixed(2) : null,
      updated_at,
      source_url: `https://www.predictit.org/markets/detail/${marketId}/`,
    });
  }

  return { source: 'PredictIt', updated_at, markets };
}

const result = await fetchPredictIt();
mkdirSync(join(BACKEND, 'data', 'sources'), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`Wrote ${OUT} (${result.markets.length} markets)`);
for (const m of result.markets) {
  console.log(`  ${m.district_id}: D ${m.dem_price} / R ${m.rep_price}`);
}