-- Load the 15 federal FEC fundraising totals that ship in backend/db/nc28.sqlite.
-- Run in the Supabase SQL editor AFTER the 20261003220000 migration, which adds
-- dem_source_url and rep_source_url. Idempotent: re-run to refresh.
--
-- These are real FEC figures through 2026-06-30, source_method total_receipts.
-- Receipts and cash-on-hand are not interchangeable; the column records which.
begin;

insert into public.fundraising
  (race_id, cycle, dem_amount, rep_amount, advantage, reporting_period,
   updated_at, source_url, dem_source_url, rep_source_url, source_method, is_seed) values
  ('NC-01', '2026', 4287386.0, 3793077.0, 494309.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H2NC02287/', 'https://www.fec.gov/data/candidate/H2NC02287/', 'https://www.fec.gov/data/candidate/H4NC01137/', 'total_receipts', false),
  ('NC-02', '2026', 1675978.0, 0.0, 1675978.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H0NC02125/', 'https://www.fec.gov/data/candidate/H0NC02125/', 'https://www.fec.gov/data/candidate/H4NC02135/', 'total_receipts', false),
  ('NC-03', '2026', 223119.0, 2357956.0, -2134837.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H6NC03229/', 'https://www.fec.gov/data/candidate/H6NC03229/', 'https://www.fec.gov/data/candidate/H0NC03172/', 'total_receipts', false),
  ('NC-04', '2026', 912011.0, 11917.0, 900094.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H2NC06114/', 'https://www.fec.gov/data/candidate/H2NC06114/', 'https://www.fec.gov/data/candidate/H4NC02150/', 'total_receipts', false),
  ('NC-05', '2026', 394695.0, 1662604.0, -1267909.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H4NC05294/', 'https://www.fec.gov/data/candidate/H4NC05294/', 'https://www.fec.gov/data/candidate/H4NC05146/', 'total_receipts', false),
  ('NC-06', '2026', 199881.0, 1226408.0, -1026527.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H6NC06164/', 'https://www.fec.gov/data/candidate/H6NC06164/', 'https://www.fec.gov/data/candidate/H4NC06177/', 'total_receipts', false),
  ('NC-07', '2026', 293818.0, 1990423.0, -1696605.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H6NC07196/', 'https://www.fec.gov/data/candidate/H6NC07196/', 'https://www.fec.gov/data/candidate/H2NC07096/', 'total_receipts', false),
  ('NC-08', '2026', 39569.0, 1019134.0, -979565.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H6NC08202/', 'https://www.fec.gov/data/candidate/H6NC08202/', 'https://www.fec.gov/data/candidate/H6NC09200/', 'total_receipts', false),
  ('NC-09', '2026', 2237508.0, 3215341.0, -977833.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H6NC09218/', 'https://www.fec.gov/data/candidate/H6NC09218/', 'https://www.fec.gov/data/candidate/H2NC08185/', 'total_receipts', false),
  ('NC-10', '2026', 84024.0, 1081821.0, -997797.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H6NC10174/', 'https://www.fec.gov/data/candidate/H6NC10174/', 'https://www.fec.gov/data/candidate/H2NC13243/', 'total_receipts', false),
  ('NC-11', '2026', 3052354.0, 0.0, 3052354.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H6NC11248/', 'https://www.fec.gov/data/candidate/H6NC11248/', 'https://www.fec.gov/data/candidate/H6NC11321/', 'total_receipts', false),
  ('NC-12', '2026', 370506.0, 28704.0, 341802.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H4NC12100/', 'https://www.fec.gov/data/candidate/H4NC12100/', 'https://www.fec.gov/data/candidate/H6NC12113/', 'total_receipts', false),
  ('NC-13', '2026', 1022610.0, 1339161.0, -316551.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H6NC13228/', 'https://www.fec.gov/data/candidate/H6NC13228/', 'https://www.fec.gov/data/candidate/H4NC13116/', 'total_receipts', false),
  ('NC-14', '2026', 24888.0, 1538952.0, -1514064.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/H6NC14069/', 'https://www.fec.gov/data/candidate/H6NC14069/', 'https://www.fec.gov/data/candidate/H4NC14015/', 'total_receipts', false),
  ('NC-SEN', '2026', 34975789.0, 11272504.0, 23703285.0, 'Through 2026-06-30', '2026-10-01T03:05:06.002Z', 'https://www.fec.gov/data/candidate/S6NC00407/', 'https://www.fec.gov/data/candidate/S6NC00407/', 'https://www.fec.gov/data/candidate/S6NC00415/', 'total_receipts', false)
on conflict (race_id, cycle) do update set
  dem_amount = excluded.dem_amount, rep_amount = excluded.rep_amount,
  advantage = excluded.advantage, reporting_period = excluded.reporting_period,
  updated_at = excluded.updated_at, source_url = excluded.source_url,
  dem_source_url = excluded.dem_source_url, rep_source_url = excluded.rep_source_url,
  source_method = excluded.source_method;

commit;