-- Per-seat polling for the race panel, as a read function rather than a
-- bundled file.
--
-- Polling is hand-entered: someone reads a topline off a release and writes the
-- row. That is the same shape of problem news had, and it gets the same answer.
-- A bundled copy would freeze a hand-entered number into a versioned file with
-- no timestamp on it, so a poll from March would render exactly like one from
-- last week. So the polls live in Supabase, the reference layer omits them, and
-- the page renders what the database currently says or says nothing at all.
--
-- poll_summary() is the site's polling contract, defined once. Two figures and
-- not one:
--
--   * the average across every poll held for the seat, dated by the field dates
--     of the polls behind it, so a reader can see how old it is; and
--   * cj_poll, the most recent Carolina Journal poll, on its own, linked to the
--     release it came from.
--
-- The average is a cross-pollster mean and belongs to no single outlet, so it
-- carries no link. The CJ poll is one newsroom's number and is attributable, so
-- it does. Showing the CJ poll alone would present one house's topline as the
-- race; showing the average alone would bury the one poll the site can name.
--
-- poll_advantage() exists so the label is spelled the same way here as in
-- backend/src/lib/format.js. Map labels and panel figures are read by different
-- people at different times, and a "D +11" that means 11.0 in one place and 11
-- in another is a small lie in the one place a reader is checking the number.
create or replace function public.poll_advantage(p_margin numeric)
 returns jsonb
 language sql
 immutable
as $function$
  select case
    when p_margin is null then null
    when abs(p_margin) < 0.05 then
      jsonb_build_object('party', 'EVEN', 'label', 'EVEN', 'value', 0)
    else jsonb_build_object(
      'party', case when p_margin > 0 then 'D' else 'R' end,
      'label', (case when p_margin > 0 then 'D' else 'R' end)
               || ' +' || round(abs(p_margin), 1)::text,
      'value', abs(p_margin))
  end;
$function$;

-- Matches pollSummary() in backend/src/lib/races.js key for key. The plugin
-- reads this; the Pages demo reads the same shape out of the static export, so
-- the widget is written once against one contract.
--
-- A seat with no polling returns the full object with available false rather
-- than null. The frontend overlays field by field and skips nulls, so returning
-- null here would leave whatever the build happened to bundle on screen -- the
-- one outcome this whole design exists to prevent.
create or replace function public.poll_summary(p_race_id text, p_cycle text default '2026')
 returns jsonb
 language sql
 stable
as $function$
  with seat as (
    select * from public.polls
    where race_id = p_race_id and cycle = p_cycle and not is_seed
  ),
  -- Matched on the pollster string rather than a source column: the column
  -- names who published a story, and for a poll the attributable party is the
  -- house that fielded the questions -- "Carolina Journal / Harper Polling".
  cj as (
    select * from seat
    where lower(pollster) like '%carolina journal%'
    order by end_date desc, poll_id desc
    limit 1
  ),
  -- Counted and dated from the rows rather than stored, so n_polls and the span
  -- always describe the same set. The margin is derived from the two rounded
  -- averages, matching the ingest, so a seat reads identically whichever side
  -- answered.
  agg as (
    select round(avg(dem_share), 2) as dem,
           round(avg(rep_share), 2) as rep,
           count(*)                as n,
           min(start_date)         as span_start,
           max(end_date)           as span_end,
           max(ingested_at)        as updated_at
    from seat
  )
  select jsonb_build_object(
    'available',  a.dem is not null,
    'dem_share',  a.dem,
    'rep_share',  a.rep,
    'margin',     round(a.dem - a.rep, 2),
    'n_polls',    a.n,
    'span_start', a.span_start,
    'span_end',   a.span_end,
    'advantage',  public.poll_advantage(round(a.dem - a.rep, 2)),
    'updated_at', a.updated_at,
    'cj_poll', (select case when c.poll_id is null then null else jsonb_build_object(
                   'pollster',    c.pollster,
                   'start_date',  c.start_date,
                   'end_date',    c.end_date,
                   'sample_size', c.sample_size,
                   'population',  c.population,
                   'dem_share',   c.dem_share,
                   'rep_share',   c.rep_share,
                   'margin',      c.margin,
                   'advantage',   public.poll_advantage(c.margin),
                   'source_url',  nullif(c.source_url, '')
                 ) end
                 from cj c)
  )
  from agg a;
$function$;

-- map_payload() now takes its polling from poll_summary() instead of computing
-- its own aggregate inline.
--
-- It was already reading the same table and the same average; the inline copy
-- just could not know about cj_poll, and it had drifted on naming (n, and a
-- label built as 'D +' || abs(margin) with no decimal). Two spellings of one
-- number is how a map label and a panel figure end up disagreeing. Reproduced
-- in full because CREATE OR REPLACE takes the whole body.
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
           'website',      website,
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
