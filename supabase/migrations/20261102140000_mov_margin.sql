-- Margin-of-victory market: a Kalshi threshold ladder (KXMIDTERMMOV-*) is reduced
-- to a single predicted margin per race and stored on the existing markets row,
-- so the turnout tracker can show a forecasted margin instead of a raw win
-- probability. The win-probability markets (and the map arrow) are untouched.
alter table public.markets
  add column if not exists mov_party text,
  add column if not exists mov_margin numeric,
  add column if not exists mov_updated_at timestamptz;

create or replace function public.mov_summary(p_race_id text, p_cycle text default '2026'::text)
 returns jsonb
 language sql
 stable
as $function$
  select coalesce(
    (select jsonb_build_object(
       'available', true,
       'party', m.mov_party,
       'margin', m.mov_margin,
       'updated_at', m.mov_updated_at)
     from public.markets m
     where m.race_id = p_race_id and m.cycle = p_cycle and m.mov_margin is not null
     order by m.updated_at desc nulls last limit 1),
    jsonb_build_object('available', false, 'party', null, 'margin', null, 'updated_at', null)
  );
$function$;

create or replace function public.mov_summaries(p_race_type text, p_cycle text default '2026'::text)
 returns jsonb
 language sql
 stable
as $function$
  select coalesce(jsonb_object_agg(r.id, public.mov_summary(r.id, p_cycle)), '{}'::jsonb)
  from public.races r
  where r.cycle = p_cycle and r.race_type = p_race_type;
$function$;

grant execute on function public.mov_summary(text, text) to anon, authenticated;
grant execute on function public.mov_summaries(text, text) to anon, authenticated;