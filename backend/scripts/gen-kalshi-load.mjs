#!/usr/bin/env node
// Regenerate kalshi-load.sql from backend/data/sources/markets-kalshi.json.
// Usage: node backend/scripts/gen-kalshi-load.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const data = JSON.parse(readFileSync(resolve(REPO, 'backend/data/sources/markets-kalshi.json'), 'utf8'));
const updated = data.markets[0].updated_at;
const rows = data.markets.map((m) => {
  const adv = +(m.dem_price - m.rep_price).toFixed(3);
  return `  ('${m.district_id}', '2026', 'Kalshi', ${m.dem_price}, ${m.rep_price}, ${adv}, '${updated}', '${m.source_url}', false)`;
}).join(',\n');
const snapDistricts = ['NC-SEN', 'NC-01', 'NC-07', 'NC-09', 'NC-11'];
const snaps = snapDistricts.map((id) => {
  const m = data.markets.find((x) => x.district_id === id);
  return `  ('${id}', '2026', 'Kalshi', '${updated.slice(0,10)}', ${m.dem_price}, ${m.rep_price}, ${m.dem_bid_price || 0}, ${m.rep_bid_price || 0})`;
}).join(',\n');
const sql = `-- Load current Kalshi quotes into Supabase so the WordPress plugin has market data.
-- Run in the Supabase SQL editor. Idempotent: re-run whenever you want fresh prices.
--
-- Prices load for all 15 federal races (resolved 2026-11-03 general election).
-- Generated ${new Date().toISOString().slice(0,10)} by backend/scripts/fetch-kalshi.mjs.
begin;

insert into public.markets (race_id, cycle, provider, dem_price, rep_price, advantage, updated_at, source_url, is_seed) values
${rows}
on conflict (race_id, cycle, provider) do update set
  dem_price = excluded.dem_price, rep_price = excluded.rep_price,
  advantage = excluded.advantage, updated_at = excluded.updated_at,
  source_url = excluded.source_url;

insert into public.market_snapshots
  (race_id, cycle, provider, as_of, dem_price, rep_price, dem_bid_price, rep_bid_price) values
${snaps}
on conflict (race_id, cycle, provider, as_of) do update set
  dem_price = excluded.dem_price, rep_price = excluded.rep_price,
  dem_bid_price = excluded.dem_bid_price, rep_bid_price = excluded.rep_bid_price;

commit;
`;
writeFileSync(resolve(REPO, 'kalshi-load.sql'), sql);
console.log('Wrote kalshi-load.sql');