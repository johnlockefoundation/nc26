-- map_payload() finally reports the movement the map draws.
--
-- NCMap.jsx draws the weekly-move arrow from race.markets.delta, and every seat
-- came back without one: map_payload built its markets object from the latest
-- quote only, so `delta` was absent on every race and the arrow branch never
-- fired. The panel has always had one, because the panel reads markets_summary
-- rather than this function -- which is why it looked like the feature worked.
-- It was working in exactly one of the two places that render it.
--
-- The fix delegates to market_weekly_move() rather than recomputing the move, so
-- the map and the panel cannot disagree about what a seat did this week. That is
-- the same one-definition rule state_funds_summary and vitals_summary follow.
--
-- Kept null rather than defaulted: a seat with no quote, or with too few
-- snapshots to measure a move, gets null, and the map renders no arrow rather
-- than an arrow claiming no change.
--
-- market_rows is `distinct on (race_id)` ordered by updated_at desc, so exactly
-- one row per seat reaches the aggregate and its provider is the one to measure.
create or replace function public.map_payload(p_race_type text, p_cycle text default '2026'::text)
 returns jsonb
 language sql
 stable
as $function$
with race_rows as (
  select * from public.races where cycle = p_cycle and race_type = p_race_type
),
market_rows as (
  select distinct on (race_id) *
  from public.markets
  where cycle = p_cycle and not is_seed
  order by race_id, updated_at desc nulls last
),
money_rows as (
  select * from public.fundraising where cycle = p_cycle and not is_seed
),
-- candidate_rows is deliberately absent, and that is inherited rather than
-- forgotten. 20261003140000_map_payload_drops_candidates.sql removed it for a
-- reason: public.candidates is intentionally never populated, so every seat came
-- back with candidates: [], overlayVolatile() copies every key Supabase returns
-- and skips only null, so that empty array counted as a real value and overwrote
-- the bundled candidate list -- blanking all 120 state House matchup labels.
news_rows as (
  select race_id,
         coalesce(jsonb_agg(jsonb_build_object(
           'article_id',   id::text,
           'headline',     headline,
           'outlet',       source,
           'published_at', published_at,
           'url',          url
         ) order by published_at desc), '[]'::jsonb) as news
  from public.stories
  where race_id is not null
  group by race_id
),
built as (
  select
    r.id, r.race_type, r.district_number, r.title, r.competitive,
    r.competitive_source, r.competitive_reason,
    r.cpi_value, r.partisan_lean, r.partisan_party,
    (select public.poll_summary(r.id, p_cycle)) as polls,
    (select public.state_funds_summary(r.id, p_cycle)) as state_funds,
    (select public.vitals_summary(r.id, p_cycle)) as vitals,
    m.dem_price, m.rep_price, m.provider, m.updated_at as market_updated_at, m.source_url,
    f.dem_amount, f.rep_amount, f.reporting_period,
    n.news
  from race_rows r
  left join market_rows m  on m.race_id  = r.id
  left join money_rows  f  on f.race_id  = r.id
  left join news_rows      n on n.race_id = r.id
),
races_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'district_id',         id,
    'race_type',           race_type,
    'district_number',     district_number,
    'election_cycle',      p_cycle,
    'title',               title,
    'competitive',         competitive,
    'competitive_source',  competitive_source,
    'competitive_reason',  competitive_reason,
    -- No 'candidates' key at all. Absent, not empty: see the note on
    -- candidate_rows above. An empty array is a value, and it would overwrite
    -- the bundled list.
    'news',                coalesce(news, '[]'::jsonb),
    'partisan', jsonb_build_object(
      'available', cpi_value is not null,
      'party', case when cpi_value ~ '^[DR]' then left(cpi_value, 1) end,
      'value', case when cpi_value ~ '^[DR]\+' then
                       substr(cpi_value, 3)::numeric else null end,
      'lean', partisan_lean,
      'competitive', competitive),
    'polls', polls,
    'markets', jsonb_build_object(
      'available', dem_price is not null,
      'dem_price', dem_price, 'rep_price', rep_price,
      'provider', provider, 'updated_at', market_updated_at, 'source_url', source_url,
      -- The arrow. Delegated, never recomputed, so the map and the panel report
      -- the same move for the same seat.
      'delta', public.market_weekly_move(id, p_cycle, provider)),
    'market_list', CASE WHEN dem_price IS NULL THEN '[]'::jsonb
                        ELSE jsonb_build_array(jsonb_build_object(
                          'provider', provider, 'dem_price', dem_price,
                          'rep_price', rep_price, 'updated_at', market_updated_at)) END,
    'money', jsonb_build_object(
      'available', dem_amount is not null,
      'dem_amount', dem_amount, 'rep_amount', rep_amount,
      'reporting_period', reporting_period),
    'state_funds', state_funds,
    'vitals', vitals,
    'coverage', jsonb_build_object(
      'polls', (polls->>'available')::boolean,
      'markets', dem_price is not null,
      'money', dem_amount is not null,
      'state_funds', (state_funds->>'available')::boolean,
      'vitals', (vitals->>'available')::boolean)
  )), '[]'::jsonb) as races
  from built
),
features_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'district_id',      id,
    'district_number',  district_number,
    'competitive',      competitive,
    'cpi',              cpi_value,
    'partisan_lean',    partisan_lean,
    'partisan_party',   partisan_party,
    -- Geometry is deliberately absent: boundaries ship inside the plugin and
    -- are keyed by this same district_id, so they never cross the network.
    'metrics', CASE WHEN competitive THEN jsonb_build_object(
      'polls',   case when (polls->>'available')::boolean then polls->'advantage' end,
      'markets', case when dem_price is not null then jsonb_build_object(
                   'party', case when dem_price > rep_price then 'D' else 'R' end,
                   'value', dem_price - rep_price,
                   'label', (case when dem_price > rep_price then 'D +' else 'R +' end) || abs(dem_price - rep_price)::text) end,
      'money',   case when dem_amount is not null then jsonb_build_object(
                   'party', case when dem_amount > rep_amount then 'D' else 'R' end,
                   'value', dem_amount - rep_amount,
                   'label', (case when dem_amount > rep_amount then 'D +' else 'R +' end)
                            || '$' || trim(to_char(abs(dem_amount - rep_amount), 'FM999,999,999,990'))
                 )
                 end,
      'coverage', jsonb_build_object(
        'polls', (polls->>'available')::boolean,
        'markets', dem_price is not null,
        'money', dem_amount is not null))
    ELSE NULL END
  )), '[]'::jsonb) as features
  from built
)
select jsonb_build_object(
  'cycle',     p_cycle,
  'race_type', p_race_type,
  'races',     (select races     from races_json),
  'features',  (select features  from features_json)
);
$function$;