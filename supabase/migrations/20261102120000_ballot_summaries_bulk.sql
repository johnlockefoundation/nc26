-- Bulk read for the turnout tracker: one round trip per chamber instead of one
-- per race. ballot_summary() is unchanged; this just calls it for every race of
-- a type and aggregates the results into a single object keyed by race_id, so
-- the client does not have to fire N requests (which queued behind the browser's
-- per-domain connection limit and made chamber switches lag).
create or replace function public.ballot_summaries(p_race_type text, p_cycle text default '2026'::text)
 returns jsonb
 language sql
 stable
as $function$
  select coalesce(jsonb_object_agg(r.id, public.ballot_summary(r.id, p_cycle)), '{}'::jsonb)
  from public.races r
  where r.cycle = p_cycle and r.race_type = p_race_type;
$function$;

grant execute on function public.ballot_summaries(text, text) to anon, authenticated;