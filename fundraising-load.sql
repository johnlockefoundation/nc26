-- Load FEC fundraising totals (Q3, through 2026-10-14) into Supabase.
-- Run in the Supabase SQL editor. Idempotent: re-run to refresh.
begin;

insert into public.fundraising
  (race_id, cycle, dem_amount, rep_amount, advantage, reporting_period,
   updated_at, source_url, dem_source_url, rep_source_url, source_method, is_seed) values
  ('NC-SEN', '2026', 49585341, 13668468, 35916873, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/S6NC00407/', 'https://www.fec.gov/data/candidate/S6NC00407/', 'https://www.fec.gov/data/candidate/S6NC00415/', 'total_receipts', false),
  ('NC-01', '2026', 5805482, 4787737, 1017745, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H2NC02287/', 'https://www.fec.gov/data/candidate/H2NC02287/', 'https://www.fec.gov/data/candidate/H4NC01137/', 'total_receipts', false),
  ('NC-02', '2026', 2039911, 0, 2039911, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H0NC02125/', 'https://www.fec.gov/data/candidate/H0NC02125/', 'https://www.fec.gov/data/candidate/H4NC02135/', 'total_receipts', false),
  ('NC-03', '2026', 366581, 2897749, -2531168, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H6NC03229/', 'https://www.fec.gov/data/candidate/H6NC03229/', 'https://www.fec.gov/data/candidate/H0NC03172/', 'total_receipts', false),
  ('NC-04', '2026', 1048543, 18568, 1029975, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H2NC06114/', 'https://www.fec.gov/data/candidate/H2NC06114/', 'https://www.fec.gov/data/candidate/H2NC06106/', 'total_receipts', false),
  ('NC-05', '2026', 863260, 2189052, -1325792, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H4NC05294/', 'https://www.fec.gov/data/candidate/H4NC05294/', 'https://www.fec.gov/data/candidate/H4NC05146/', 'total_receipts', false),
  ('NC-06', '2026', 232325, 1456167, -1223842, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H6NC06164/', 'https://www.fec.gov/data/candidate/H6NC06164/', 'https://www.fec.gov/data/candidate/H4NC06177/', 'total_receipts', false),
  ('NC-07', '2026', 390475, 2534038, -2143563, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H6NC07196/', 'https://www.fec.gov/data/candidate/H6NC07196/', 'https://www.fec.gov/data/candidate/H2NC07096/', 'total_receipts', false),
  ('NC-08', '2026', 57590, 1238724, -1181134, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H6NC08202/', 'https://www.fec.gov/data/candidate/H6NC08202/', 'https://www.fec.gov/data/candidate/H4NC08066/', 'total_receipts', false),
  ('NC-09', '2026', 2930069, 4173708, -1243639, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H6NC09218/', 'https://www.fec.gov/data/candidate/H6NC09218/', 'https://www.fec.gov/data/candidate/H2NC08185/', 'total_receipts', false),
  ('NC-10', '2026', 147720, 1318233, -1170513, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H6NC10174/', 'https://www.fec.gov/data/candidate/H6NC10174/', 'https://www.fec.gov/data/candidate/H2NC13243/', 'total_receipts', false),
  ('NC-11', '2026', 5869453, 399492, 5469961, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H6NC11248/', 'https://www.fec.gov/data/candidate/H6NC11248/', 'https://www.fec.gov/data/candidate/H6NC11321/', 'total_receipts', false),
  ('NC-12', '2026', 483375, 54620, 428755, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H4NC12100/', 'https://www.fec.gov/data/candidate/H4NC12100/', 'https://www.fec.gov/data/candidate/H6NC12113/', 'total_receipts', false),
  ('NC-13', '2026', 1215151, 1697075, -481924, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H6NC13228/', 'https://www.fec.gov/data/candidate/H6NC13228/', 'https://www.fec.gov/data/candidate/H4NC13116/', 'total_receipts', false),
  ('NC-14', '2026', 59183, 2091455, -2032272, 'Through 2026-10-14', '2026-11-14T04:01:44.765Z', 'https://www.fec.gov/data/candidate/H6NC14069/', 'https://www.fec.gov/data/candidate/H6NC14069/', 'https://www.fec.gov/data/candidate/H4NC14015/', 'total_receipts', false)
on conflict (race_id, cycle) do update set
  dem_amount = excluded.dem_amount, rep_amount = excluded.rep_amount,
  advantage = excluded.advantage, reporting_period = excluded.reporting_period,
  updated_at = excluded.updated_at, source_url = excluded.source_url,
  dem_source_url = excluded.dem_source_url, rep_source_url = excluded.rep_source_url,
  source_method = excluded.source_method;

commit;
