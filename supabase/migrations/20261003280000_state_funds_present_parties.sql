-- state_funds_summary() keys by_party only by the parties that actually filed.
--
-- 20261003270000 built by_party as jsonb_build_object('D', ..., 'R', ...), so a
-- seat carried a row for each party whether or not one existed. That was
-- invisible while the loader only covered competitive races -- both sides always
-- had a row. Expanding to every General Assembly seat exposed it: 42 districts
-- list a single candidate, and any contested race where one committee has no
-- readable Second Quarter report has only one row. In both cases the absent
-- party rendered as "$0, no filing on file" -- a fabricated zero standing in for
-- a candidate who does not exist, which is the one thing the state-money path is
-- meant never to do.
--
-- So by_party is aggregated from the seat's own rows. A one-sided race shows the
-- one filing; a seat with no rows at all still returns `{available: false}`,
-- which the MONEY block already renders as pending. dem_amount/rep_amount keep
-- the federal money_summary shape and stay zero-coalesced; nothing reads them.
--
-- Defined here rather than editing 20261003270000 to keep the one-definition
-- rule: migrations apply in order, and rewriting an applied file is how a stale
-- revision silently reverts a newer one.
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
           max(updated_at)                                         as updated_at
    from seat
  ),
  parties as (
    select coalesce(
             jsonb_object_agg(party,
               jsonb_build_object('amount', round(total), 'source_url', url)),
             '{}'::jsonb) as obj
    from (
      select party, sum(total_raised) as total, max(source_url) as url
      from seat
      group by party
    ) g
  )
  select case when a.n = 0 then jsonb_build_object('available', false)
              else jsonb_build_object(
                'available',         true,
                'dem_amount',        round(a.dem),
                'rep_amount',        round(a.rep),
                'advantage',         public.money_advantage(a.dem - a.rep),
                'by_party',          p.obj,
                'reporting_period',  a.period,
                'updated_at',        a.updated_at)
         end
  from agg a, parties p;
$function$;
