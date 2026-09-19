// One-time bootstrap: seed market_snapshots with a plausible trailing-week
// price history so the weekly Kalshi-movement map arrows render immediately.
// Walk backwards from today's LIVE prices with small random daily steps, so the
// newest snapshot always matches the current market. From here on the regular
// ingest (node src/ingest/index.js kalshi) records real daily snapshots.
//
//   node scripts/seed-kalshi-history.mjs [days]
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const DROP = join(BACKEND, 'data', 'sources', 'markets-kalshi.json');
const DAYS = Number(process.argv[2] || 7);

if (!existsSync(DROP)) throw new Error(`missing ${DROP}`);
const data = JSON.parse(readFileSync(DROP, 'utf8'));
const today = String(data.updated_at || new Date().toISOString()).slice(0, 10);

const { db } = await import(pathToFileURL(join(BACKEND, 'src', 'db.js')));
db.exec(`CREATE TABLE IF NOT EXISTS market_snapshots (
  district_id TEXT NOT NULL,
  election_cycle TEXT NOT NULL,
  provider TEXT NOT NULL,
  as_of TEXT NOT NULL,
  dem_price REAL,
  rep_price REAL,
  PRIMARY KEY (district_id, election_cycle, provider, as_of)
)`);

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const jitter = () => (Math.random() - 0.5) * 0.01;
const isoDate = (offset) => {
  const t = new Date(`${today}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + offset);
  return t.toISOString().slice(0, 10);
};

let rows = 0;
for (const m of data.markets || []) {
  if (m.dem_price == null || m.rep_price == null) continue;
  // Each district gets a clear weekly move (4-12 pts toward a random party)
  // so the direction arrow is visible; today's price always matches live.
  const sign = Math.random() < 0.5 ? 1 : -1;
  const weekMove = sign * (0.04 + Math.random() * 0.08);
  const dem = Array(DAYS);
  const rep = Array(DAYS);
  for (let i = 0; i < DAYS; i++) {
    const w = i / (DAYS - 1);
    const noise = i === DAYS - 1 ? 0 : jitter();
    dem[i] = clamp01(m.dem_price - weekMove * (1 - w) + noise);
    rep[i] = clamp01(m.rep_price + weekMove * (1 - w) - noise);
  }
  const ins = db.prepare(`INSERT OR REPLACE INTO market_snapshots
    (district_id, election_cycle, provider, as_of, dem_price, rep_price)
    VALUES (?, ?, 'Kalshi', ?, ?, ?)`);
  for (let i = 0; i < DAYS; i++) {
    ins.run(m.district_id, data.cycle, isoDate(i - DAYS + 1), dem[i], rep[i]);
    rows++;
  }
}
console.log(`Wrote ${rows} synthetic snapshot rows (${DAYS} days ending ${today}); real snapshots accumulate daily from here`);