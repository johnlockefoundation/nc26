-- Candidate websites are out of product scope, so the field is removed from the
-- payload rather than left in it unread.
--
-- map_payload() is reproduced in full because CREATE OR REPLACE takes the whole
-- body, and the function is replaced *before* the column is dropped: a SQL
-- function body is parsed and its column references resolved when it is
-- created, so dropping first would leave the old definition failing to compile.
--
-- The clients are not the reason for this. Nothing read the key -- the race
-- panel rendered it, and it is being removed there in the same change -- but a
-- payload field that no consumer wants is still a field that has to be
-- explained to anyone reading the contract.
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
candidate_rows as (
  select race_id,
         jsonb_agg(jsonb_build_object(
           'candidate_id', candidate_id,
           'name',         name,
           'party',        party,
           'incumbent',    incumbent,
           'photo_url',    photo_url,
           'photo_source', photo_source
         ) order by party desc, name) as candidates
  from public.candidates where cycle = p_cycle group by race_id
),
news_rows as (
  -- Stories are not filtered by cycle: a story carries no cycle, and the
  -- table is small enough that a 2028 story showing on a 2026 card is a
  -- better failure than dropping it at write time.
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
vitals_rows as (
  select race_id,
         jsonb_agg(jsonb_build_object(
           'snapshot',      snapshot,
           'snapshot_date', snapshot_date,
           'is_mock',       is_mock,
           'registration', jsonb_build_object(
             'total', registered_total, 'dem', registered_dem,
             'rep', registered_rep, 'unaff', registered_unaff),
           'ballot', jsonb_build_object(
             'dem', ballots_req_dem, 'rep', ballots_req_rep, 'unaff', ballots_req_unaff)
         ) order by snapshot) as vitals
  from public.race_vitals where cycle = p_cycle group by race_id
),
funds_rows as (
  select race_id,
         jsonb_build_object(
           'is_mock', bool_or(is_mock),
           'dem_amount', sum(total_raised) filter (where party = 'D'),
           'rep_amount', sum(total_raised) filter (where party = 'R')
         ) as state_funds
  from public.state_funds where cycle = p_cycle group by race_id
),
built as (
  select
    r.id, r.race_type, r.district_number, r.title, r.competitive,
    r.competitive_source, r.competitive_reason,
    r.cpi_value, r.partisan_lean, r.partisan_party,
    -- A scalar subquery, not a join: poll_summary always returns exactly one
    -- row, so no seat can fall out of the map for want of an aggregate.
    (select public.poll_summary(r.id, p_cycle)) as polls,
    m.dem_price, m.rep_price, m.provider, m.updated_at as market_updated_at, m.source_url,
    f.dem_amount, f.rep_amount, f.reporting_period,
    c.candidates, n.news, v.vitals, sf.state_funds
  from race_rows r
  left join market_rows m  on m.race_id  = r.id
  left join money_rows  f  on f.race_id  = r.id
  left join candidate_rows c on c.race_id = r.id
  left join news_rows      n on n.race_id = r.id
  left join vitals_rows    v on v.race_id = r.id
  left join funds_rows    sf on sf.race_id = r.id
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
    'candidates',          coalesce(candidates, '[]'::jsonb),
    'news',                coalesce(news, '[]'::jsonb),
    'partisan', jsonb_build_object(
      'available', cpi_value is not null,
      'party', case when cpi_value ~ '^[DR]' then left(cpi_value, 1) end,
      'value', case when cpi_value ~ '^[DR]\+' then
                       substr(cpi_value, 3)::numeric else null end,
      'lean', partisan_lean,
      'competitive', competitive),
    -- The whole polling contract, verbatim. This is the same object the race
    -- panel fetches, so a seat coloured by polling and a seat opened on the
    -- panel are describing the same average.
    'polls', polls,
    'markets', jsonb_build_object(
      'available', dem_price is not null,
      'dem_price', dem_price, 'rep_price', rep_price,
      'provider', provider, 'updated_at', market_updated_at, 'source_url', source_url),
    'market_list', CASE WHEN dem_price IS NULL THEN '[]'::jsonb
                        ELSE jsonb_build_array(jsonb_build_object(
                          'provider', provider, 'dem_price', dem_price,
                          'rep_price', rep_price, 'updated_at', market_updated_at)) END,
    'money', jsonb_build_object(
      'available', dem_amount is not null,
      'dem_amount', dem_amount, 'rep_amount', rep_amount,
      'reporting_period', reporting_period),
    'state_funds', state_funds,
    'vitals', coalesce(vitals, '[]'::jsonb),
    'coverage', jsonb_build_object(
      'polls', (polls->>'available')::boolean,
      'markets', dem_price is not null,
      'money', dem_amount is not null)
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

-- Safe now that nothing selects it. The four populated rows were the four
-- federal nominees hand-entered in the seed; the rest of the column was empty
-- in every database, so this discards no information that was ever displayed.
alter table public.candidates drop column if exists website;
