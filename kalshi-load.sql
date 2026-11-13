-- Load current Kalshi quotes into Supabase so the WordPress plugin has market data.
-- Run in the Supabase SQL editor. Idempotent: re-run whenever you want fresh prices.
--
-- Prices load for all 15 federal races (resolved 2026-11-03 general election).
-- Generated 2026-11-13 by backend/scripts/fetch-kalshi.mjs.
begin;

insert into public.markets (race_id, cycle, provider, dem_price, rep_price, advantage, updated_at, source_url, is_seed) values
  ('NC-SEN', '2026', 'Kalshi', 0.998, 0.002, 0.996, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/senatenc/north-carolina-senate-race/senatenc-26', false),
  ('NC-01', '2026', 'Kalshi', 0.999, 0.002, 0.997, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/housenc1/house-nc-1/housenc1-26', false),
  ('NC-02', '2026', 'Kalshi', 0.998, 0.03, 0.968, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc02-26', false),
  ('NC-03', '2026', 'Kalshi', 0.999, 0.001, 0.998, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc03-26', false),
  ('NC-04', '2026', 'Kalshi', 0.998, 0.049, 0.949, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc04-26', false),
  ('NC-05', '2026', 'Kalshi', 0.993, 0.007, 0.986, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc05-26', false),
  ('NC-06', '2026', 'Kalshi', 0.998, 0.002, 0.996, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc06-26', false),
  ('NC-07', '2026', 'Kalshi', 0.002, 0.995, -0.993, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc07-26', false),
  ('NC-08', '2026', 'Kalshi', 0.01, 0.99, -0.98, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc08-26', false),
  ('NC-09', '2026', 'Kalshi', 0.995, 0.004, 0.991, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc09-26', false),
  ('NC-10', '2026', 'Kalshi', 0.003, 0.981, -0.978, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc10-26', false),
  ('NC-11', '2026', 'Kalshi', 0.998, 0.001, 0.997, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhousenc11/house-nc-11/kxhousenc11-26', false),
  ('NC-12', '2026', 'Kalshi', 0.971, 0.034, 0.937, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc12-26', false),
  ('NC-13', '2026', 'Kalshi', 0.999, 0.003, 0.996, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc13-26', false),
  ('NC-14', '2026', 'Kalshi', 0.981, 0.02, 0.961, '2026-11-13T21:00:28.491Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc14-26', false)
on conflict (race_id, cycle, provider) do update set
  dem_price = excluded.dem_price, rep_price = excluded.rep_price,
  advantage = excluded.advantage, updated_at = excluded.updated_at,
  source_url = excluded.source_url;

insert into public.market_snapshots
  (race_id, cycle, provider, as_of, dem_price, rep_price, dem_bid_price, rep_bid_price) values
  ('NC-SEN', '2026', 'Kalshi', '2026-11-13', 0.998, 0.002, 0, 0),
  ('NC-01', '2026', 'Kalshi', '2026-11-13', 0.999, 0.002, 0, 0),
  ('NC-07', '2026', 'Kalshi', '2026-11-13', 0.002, 0.995, 0.002, 0.994),
  ('NC-09', '2026', 'Kalshi', '2026-11-13', 0.995, 0.004, 0, 0),
  ('NC-11', '2026', 'Kalshi', '2026-11-13', 0.998, 0.001, 0, 0)
on conflict (race_id, cycle, provider, as_of) do update set
  dem_price = excluded.dem_price, rep_price = excluded.rep_price,
  dem_bid_price = excluded.dem_bid_price, rep_bid_price = excluded.rep_bid_price;

commit;
