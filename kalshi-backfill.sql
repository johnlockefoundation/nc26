-- Backfill: real daily Kalshi closes for the seats that show an arrow.
-- Run in the Supabase SQL editor, after kalshi-load.sql. Idempotent.
--
-- Scope: NC-SEN, NC-01, NC-07, NC-09, NC-11. Prices for the other twelve federal races
-- load from kalshi-load.sql; the ones not listed here get no snapshot history,
-- so no arrow.
-- No state-level race is represented: Kalshi lists no market for one.
--
-- Every row is an actual daily close from
--   /markets/candlesticks?market_tickers=<ticker>&period_interval=1440
-- Days on which one side did not trade are absent rather than filled in.
-- Generated 2026-10-03.
begin;

insert into public.market_snapshots
  (race_id, cycle, provider, as_of, dem_price, rep_price, dem_bid_price, rep_bid_price) values
  ('NC-01', '2026', 'Kalshi', '2026-09-20', 0.6, 0.4, 0.6, 0.39),
  ('NC-01', '2026', 'Kalshi', '2026-09-21', 0.61, 0.39, 0.6, 0.39),
  ('NC-01', '2026', 'Kalshi', '2026-09-24', 0.61, 0.39, 0.6, 0.39),
  ('NC-01', '2026', 'Kalshi', '2026-09-25', 0.64, 0.36, 0.6, 0.36),
  ('NC-01', '2026', 'Kalshi', '2026-09-26', 0.62, 0.37, 0.6, 0.36),
  ('NC-01', '2026', 'Kalshi', '2026-09-27', 0.6, 0.42, 0.57, 0.4),
  ('NC-01', '2026', 'Kalshi', '2026-09-28', 0.59, 0.4, 0.58, 0.4),
  ('NC-01', '2026', 'Kalshi', '2026-09-29', 0.6, 0.4, 0.59, 0.38),
  ('NC-01', '2026', 'Kalshi', '2026-09-30', 0.61, 0.41, 0.6, 0.38),
  ('NC-01', '2026', 'Kalshi', '2026-10-01', 0.61, 0.41, 0.6, 0.39),
  ('NC-11', '2026', 'Kalshi', '2026-09-20', 0.65, 0.37, 0.62, 0.37),
  ('NC-11', '2026', 'Kalshi', '2026-09-22', 0.65, 0.38, 0.62, 0.37),
  ('NC-11', '2026', 'Kalshi', '2026-09-23', 0.65, 0.37, 0.62, 0.37),
  ('NC-11', '2026', 'Kalshi', '2026-09-25', 0.65, 0.39, 0.62, 0.37),
  ('NC-11', '2026', 'Kalshi', '2026-09-26', 0.65, 0.37, 0.62, 0.37),
  ('NC-11', '2026', 'Kalshi', '2026-09-27', 0.65, 0.37, 0.61, 0.37),
  ('NC-11', '2026', 'Kalshi', '2026-09-29', 0.65, 0.39, 0.63, 0.37),
  ('NC-11', '2026', 'Kalshi', '2026-09-30', 0.64, 0.38, 0.62, 0.35),
  ('NC-11', '2026', 'Kalshi', '2026-10-01', 0.67, 0.34, 0.65, 0.33),
  ('NC-11', '2026', 'Kalshi', '2026-10-02', 0.66, 0.34, 0.65, 0.33),
  ('NC-11', '2026', 'Kalshi', '2026-10-03', 0.68, 0.33, 0.66, 0.32),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-20', 0.927, 0.08, 0.922, 0.079),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-21', 0.921, 0.08, 0.921, 0.079),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-22', 0.927, 0.079, 0.921, 0.074),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-23', 0.93, 0.07, 0.93, 0.064),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-24', 0.935, 0.065, 0.933, 0.066),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-25', 0.933, 0.069, 0.933, 0.065),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-26', 0.936, 0.062, 0.937, 0.064),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-27', 0.936, 0.065, 0.936, 0.064),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-28', 0.936, 0.067, 0.935, 0.064),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-29', 0.943, 0.058, 0.942, 0.058),
  ('NC-SEN', '2026', 'Kalshi', '2026-09-30', 0.946, 0.06, 0.942, 0.054),
  ('NC-SEN', '2026', 'Kalshi', '2026-10-01', 0.941, 0.065, 0.941, 0.057),
  ('NC-SEN', '2026', 'Kalshi', '2026-10-02', 0.941, 0.063, 0.941, 0.058),
  ('NC-SEN', '2026', 'Kalshi', '2026-10-03', 0.95, 0.048, 0.949, 0.048),
  ('NC-07', '2026', 'Kalshi', '2026-09-30', 0.16, 0.85, 0.15, 0.83),
  ('NC-07', '2026', 'Kalshi', '2026-10-03', 0.16, 0.83, 0.15, 0.81),
  ('NC-09', '2026', 'Kalshi', '2026-09-18', 0.26, 0.75, 0.24, 0.75),
  ('NC-09', '2026', 'Kalshi', '2026-09-19', 0.25, 0.76, 0.24, 0.75),
  ('NC-09', '2026', 'Kalshi', '2026-09-20', 0.23, 0.76, 0.23, 0.76),
  ('NC-09', '2026', 'Kalshi', '2026-09-24', 0.24, 0.78, 0.22, 0.77),
  ('NC-09', '2026', 'Kalshi', '2026-09-28', 0.21, 0.79, 0.2, 0.78)
on conflict (race_id, cycle, provider, as_of) do update set
  dem_price = excluded.dem_price, rep_price = excluded.rep_price,
  dem_bid_price = excluded.dem_bid_price, rep_bid_price = excluded.rep_bid_price;

commit;