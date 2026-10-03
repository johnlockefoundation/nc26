-- Load current Kalshi quotes into Supabase so the WordPress plugin has market data.
-- Run in the Supabase SQL editor. Idempotent: re-run whenever you want fresh prices.
--
-- Prices load for all 15 federal races. Snapshots load for three of them only
-- (NC-SEN, NC-01, NC-11), because the weekly-move arrow is wanted only there.
-- A snapshot for any other seat would grow an arrow nobody asked for.
-- Generated 2026-10-03 by backend/scripts/fetch-kalshi.mjs.
begin;

insert into public.markets (race_id, cycle, provider, dem_price, rep_price, advantage, updated_at, source_url, is_seed) values
  ('NC-SEN', '2026', 'Kalshi', 0.95, 0.05, 0.9, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/senatenc/north-carolina-senate-race/senatenc-26', false),
  ('NC-01', '2026', 'Kalshi', 0.61, 0.41, 0.2, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/housenc1/house-nc-1/housenc1-26', false),
  ('NC-02', '2026', 'Kalshi', 0.967, 0.021, 0.946, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc02-26', false),
  ('NC-03', '2026', 'Kalshi', 0.18, 0.88, -0.7, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc03-26', false),
  ('NC-04', '2026', 'Kalshi', 0.973, 0.055, 0.918, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc04-26', false),
  ('NC-05', '2026', 'Kalshi', 0.14, 0.85, -0.71, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc05-26', false),
  ('NC-06', '2026', 'Kalshi', 0.09, 0.908, -0.818, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc06-26', false),
  ('NC-07', '2026', 'Kalshi', 0.16, 0.83, -0.67, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc07-26', false),
  ('NC-08', '2026', 'Kalshi', 0.042, 0.917, -0.875, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc08-26', false),
  ('NC-09', '2026', 'Kalshi', 0.19, 0.76, -0.57, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc09-26', false),
  ('NC-10', '2026', 'Kalshi', 0.079, 0.946, -0.867, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc10-26', false),
  ('NC-11', '2026', 'Kalshi', 0.68, 0.31, 0.37, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhousenc11/house-nc-11/kxhousenc11-26', false),
  ('NC-12', '2026', 'Kalshi', 0.94, 0.041, 0.899, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc12-26', false),
  ('NC-13', '2026', 'Kalshi', 0.17, 0.83, -0.66, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc13-26', false),
  ('NC-14', '2026', 'Kalshi', 0.12, 0.89, -0.77, '2026-10-03T22:17:22.268Z', 'https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc14-26', false)
on conflict (race_id, cycle, provider) do update set
  dem_price = excluded.dem_price, rep_price = excluded.rep_price,
  advantage = excluded.advantage, updated_at = excluded.updated_at,
  source_url = excluded.source_url;

-- Today's snapshot, for the three seats that get an arrow. This is the baseline
-- the arrow measures from; it does not by itself produce a move.
insert into public.market_snapshots
  (race_id, cycle, provider, as_of, dem_price, rep_price, dem_bid_price, rep_bid_price) values
  ('NC-SEN', '2026', 'Kalshi', '2026-10-03', 0.95, 0.05, 0.949, 0.049),
  ('NC-01', '2026', 'Kalshi', '2026-10-03', 0.61, 0.41, 0.6, 0.4),
  ('NC-11', '2026', 'Kalshi', '2026-10-03', 0.68, 0.31, 0.68, 0.31)
on conflict (race_id, cycle, provider, as_of) do update set
  dem_price = excluded.dem_price, rep_price = excluded.rep_price,
  dem_bid_price = excluded.dem_bid_price, rep_bid_price = excluded.rep_bid_price;

commit;