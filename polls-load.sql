-- Load the real 2026 polls that ship in backend/db/nc28.sqlite.
-- Run in the Supabase SQL editor. Idempotent: re-run to refresh.
--
-- 10 polls across 4 federal races (NC-01 x4, NC-SEN x4, NC-07, NC-11), all
-- is_seed = 0. poll_summary() averages these per seat; without them every
-- federal seat reads available false and the POLLS block does not render.
--
-- source_url is the pollster's own release, which is what poll_summary returns
-- as cj_poll.source_url for the Carolina Journal row. The AVERAGE row is not
-- attributable to any one outlet, so it is linked separately in the frontend.
begin;

insert into public.polls
  (poll_id, race_id, cycle, pollster, start_date, end_date, sample_size,
   population, dem_share, rep_share, margin, source_url, source, is_seed) values
  ('NC-01_2026_gqr-d_2026-02-02', 'NC-01', '2026', 'GQR (D)', '2026-01-29', '2026-02-02', 500, 'LV', 42.0, 39.0, 3.0, 'https://votes.decisiondeskhq.com/races/2026-11-03/north-carolina-us-house-1-general-election/forecast', 'Curated real polls (verified release + topline; URLs to primary sources)', false),
  ('NC-01_2026_co-efficient-r-for-nrcc_2026-04-29', 'NC-01', '2026', 'co/efficient (R) for NRCC', '2026-04-25', '2026-04-29', 842, 'LV', 41.0, 41.0, 0.0, 'https://www.carolinajournal.com/exclusive-nrcc-polling-puts-buckhout-davis-in-dead-heat/', 'Curated real polls (verified release + topline; URLs to primary sources)', false),
  ('NC-01_2026_gqr-d_2026-06-28', 'NC-01', '2026', 'GQR (D)', '2026-06-22', '2026-06-28', 500, 'LV', 45.0, 41.0, 4.0, 'https://dailyhaymaker.com/new-poll-don-davis-on-top-in-three-way-race-for-nc-01/', 'Curated real polls (verified release + topline; URLs to primary sources)', false),
  ('NC-01_2026_gbao-d-for-house-majority-pac_2026-09-11', 'NC-01', '2026', 'GBAO (D) for House Majority PAC', '2026-09-09', '2026-09-11', 500, 'LV', 50.0, 43.0, 7.0, 'https://www.witn.com/2026/09/15/poll-don-davis-leading-laurie-buckhout-by-7-points-first-district-race/', 'Curated real polls (verified release + topline; URLs to primary sources)', false),
  ('NC-07_2026_public-policy-polling_2026-08-20', 'NC-07', '2026', 'Public Policy Polling', '2026-08-19', '2026-08-20', 517, 'LV', 43.0, 49.0, -6.0, 'https://data.ddhq.io/polls/2026/08/28/Public-Policy-Polling-North-Carolina--7', 'Curated real polls (verified release + topline; URLs to primary sources)', false),
  ('NC-11_2026_public-policy-polling_2026-09-11', 'NC-11', '2026', 'Public Policy Polling', '2026-09-10', '2026-09-11', 531, 'LV', 47.0, 44.0, 3.0, 'https://www.ellisinsight.com/senate/carolinas-critical-campaigns/', 'Curated real polls (verified release + topline; URLs to primary sources)', false),
  ('NC-SEN_2026_elon-university-poll-yougov_2026-07-31', 'NC-SEN', '2026', 'Elon University Poll / YouGov', '2026-07-23', '2026-07-31', 800, 'RV', 53.0, 42.0, 11.0, 'https://www.newsweek.com/cooper-vs-whatleywhat-north-carolina-polls-show-under-2-months-to-midterm-12427356', 'Curated real polls (verified release + topline; URLs to primary sources)', false),
  ('NC-SEN_2026_elon-university-poll-yougov_2026-08-31', 'NC-SEN', '2026', 'Elon University Poll / YouGov', '2026-08-21', '2026-08-31', 565, 'LV', 49.0, 38.0, 11.0, 'https://www.elon.edu/u/news/2026/09/10/elon-university-poll-cooper-maintains-double-digit-lead-in-north-carolina-u-s-senate-race/', 'Curated real polls (verified release + topline; URLs to primary sources)', false),
  ('NC-SEN_2026_ecu-center-for-survey-research_2026-09-03', 'NC-SEN', '2026', 'ECU Center for Survey Research', '2026-08-31', '2026-09-03', 675, 'LV', 46.0, 39.0, 7.0, 'https://surveyresearch-ecu.reportablenews.com/pr/ecu-poll-cooper-leads-whatley-by-7-points', 'Curated real polls (verified release + topline; URLs to primary sources)', false),
  ('NC-SEN_2026_carolina-journal-harper-polling_2026-09-15', 'NC-SEN', '2026', 'Carolina Journal / Harper Polling', '2026-09-13', '2026-09-15', 608, 'LV', 49.0, 34.0, 15.0, 'https://www.carolinajournal.com/cj-poll-cooper-leads-whatley-by-15-as-republican-voters-drift-to-undecided/', 'Curated real polls (verified release + topline; URLs to primary sources)', false)
on conflict (poll_id) do update set
  race_id = excluded.race_id, pollster = excluded.pollster,
  start_date = excluded.start_date, end_date = excluded.end_date,
  sample_size = excluded.sample_size, population = excluded.population,
  dem_share = excluded.dem_share, rep_share = excluded.rep_share,
  margin = excluded.margin, source_url = excluded.source_url, source = excluded.source;

commit;