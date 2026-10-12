-- state_funds_summary() now carries each party's source_url, so the MONEY block
-- can link a reader to the filing a state figure came from.
--
-- 20261003190000 hardcoded source_url to null on the reasoning that these rows
-- pointed at the NCSBE portal rather than a per-candidate filing, and a link to
-- a bare portal is worse than no link. That premise no longer holds: the
-- fundraising/ tool records each row's report id and the portal resolves a
-- specific filing's report-sections page from it alone
-- (https://cf.ncsbe.gov/CFOrgLkup/ReportSection?rid=<RID>, the page listing the
-- Detailed Summary, Detailed Receipts and Detailed Expenditures). So each row's
-- source_url is a link to that exact filing, and per party is the right grain:
-- by_party is already keyed by party, and a race's two rows are the two filings.
--
-- Defining the same function here rather than editing 20261003190000 keeps the
-- one-definition rule: migrations apply in order, and rewriting an applied file
-- is how a stale revision silently reverts a newer one.
create or replace function public.state_funds_summary(p_race_id text, p_cycle text default '2026')
 returns jsonb
 language sql
 stable
as $function$
  with seat as (
    select * from public.state_funds
    where race_id = p_race_id and cycle = p_cycle and not is_mock
  ),
  agg as (
    select coalesce(sum(total_raised) filter (where party = 'D'), 0) as dem,
           coalesce(sum(total_raised) filter (where party = 'R'), 0) as rep,
           count(*)                                                as n,
           max(reporting_period)                                   as period,
           max(updated_at)                                         as updated_at,
           max(source_url) filter (where party = 'D')              as dem_url,
           max(source_url) filter (where party = 'R')              as rep_url
    from seat
  )
  select case when a.n = 0 then jsonb_build_object('available', false)
              else jsonb_build_object(
                'available',         true,
                'dem_amount',        round(a.dem),
                'rep_amount',        round(a.rep),
                'advantage',         public.money_advantage(a.dem - a.rep),
                'by_party',          jsonb_build_object(
                  'D', jsonb_build_object('amount', round(a.dem), 'source_url', a.dem_url),
                  'R', jsonb_build_object('amount', round(a.rep), 'source_url', a.rep_url)),
                'reporting_period',  a.period,
                'updated_at',        a.updated_at)
         end
  from agg a;
$function$;
