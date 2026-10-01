-- Reconstructed from the live project; see the header of core_schema for how.
--
-- Three read functions, and the shape of the payload is the contract the
-- frontend depends on: each returns jsonb built with explicit key names, so
-- PostgREST hands the components the fields they destructure rather than a
-- table's column list. That is why these exist at all instead of the site
-- selecting from the tables -- a column rename here is invisible to the site
-- only if the site is not reading columns, and map_payload aggregates across
-- eight tables anyway.
--
-- All are STABLE, not VOLATILE: they read tables and nothing else, and marking
-- them stable is what lets postgres fold a call into a larger query.
--
-- Only meta() lives here. The original file also defined map_payload() and
-- ticker(), but both read news tables that no longer exist, and reproducing
-- those bodies would mean inventing column definitions for a table that has
-- been dropped -- guessing at names the replay would then fail on. They are
-- created instead after the tables they read: ticker() in the stories
-- migration, map_payload() in the later map_payload_reads_stories migration.
-- The end state is identical, and nothing in between calls them.

-- meta() is the page-level payload: the cycle, the gauge figures, per-chamber
-- seat counts, and which feeds are alive.
create or replace function public.meta(p_cycle text default '2026')
returns jsonb
language sql
stable
as $function$
  -- Postgres will not nest an aggregate inside jsonb_agg's argument, so the
  -- per-race-type counts are rolled up in their own CTE first.
  with race_type_counts as (
    select race_type,
           count(*)                             as total,
           count(*) filter (where competitive) as competitive
    from public.races
    where cycle = p_cycle
    group by race_type
  )
  select jsonb_build_object(
    'cycle', p_cycle,
    'outlooks', coalesce((
      select jsonb_object_agg(key, jsonb_build_object(
        'key', key, 'label', label, 'dem', dem, 'rep', rep, 'tossup', tossup,
        'threshold', threshold, 'total', total,
        'today', jsonb_build_object('dem', today_dem, 'rep', today_rep),
        'source', source, 'updated_at', updated_at))
      from public.outlooks), '{}'::jsonb),
    'race_types', coalesce((
      select jsonb_agg(jsonb_build_object(
        'race_type',   race_type,
        'total',       total,
        'competitive', competitive) order by race_type)
      from race_type_counts), '[]'::jsonb),
    -- Feed health, so the panel can say which sources are live rather than
    -- implying everything is current.
    'sources', coalesce((
      select jsonb_agg(to_jsonb(i) order by source)
      from (select source, last_fetched, last_success, last_error, status, notes
            from public.ingest_runs) i), '[]'::jsonb)
  );
$function$;
