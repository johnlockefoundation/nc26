-- Load the four header gauges into Supabase so they are table-driven rather than
-- bundled. Run in the Supabase SQL editor. Idempotent.
--
-- public.outlooks already exists and meta() already reads it; the table was simply
-- empty, so getMeta fell back to the bundled meta.json on every load. Values here
-- are the bundled figures verbatim, so the gauges render identically -- they are now
-- editable in one place and reach every installed plugin without a rebuild.
--
-- `key` must match what getMeta looks up: us_house, us_senate, nc_senate, nc_house.
-- today_dem / today_rep are today's count, which the gauge compares against the
-- projection to draw the shift arrow.
begin;

insert into public.outlooks
  (key, label, dem, rep, tossup, threshold, total, today_dem, today_rep, source, updated_at) values
  ('us_house', 'U.S. House', 205, 212, 18, 218, 435, 215, 220, 'Cook Political Report', '2026-09-16T12:00:00Z'),
  ('us_senate', 'U.S. Senate', 51, 49, 0, 50, 100, 47, 53, 'Decision Desk HQ', '2026-09-16T12:00:00Z'),
  ('nc_senate', 'NC Senate', 20, 30, 0, 26, 50, 20, 30, 'JLF Civitas', '2026-09-16T12:00:00Z'),
  ('nc_house', 'NC House', 48, 72, 0, 61, 120, 49, 71, 'JLF Civitas', '2026-09-16T12:00:00Z')
on conflict (key) do update set
  label = excluded.label, dem = excluded.dem, rep = excluded.rep,
  tossup = excluded.tossup, threshold = excluded.threshold, total = excluded.total,
  today_dem = excluded.today_dem, today_rep = excluded.today_rep,
  source = excluded.source, updated_at = excluded.updated_at;

commit;