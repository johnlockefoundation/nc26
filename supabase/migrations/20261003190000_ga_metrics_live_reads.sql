-- General Assembly money and voter velocity as live read functions.
--
-- Both of these were previously bundled into the shipped plugin file, and both
-- were being bundled as PLACEHOLDER FIGURES -- backend/scripts/generate-mock-ga.mjs
-- invented every row, scaled off the Civitas partisan index and district
-- number, and wrote them with is_mock = 1. Sixty seats rendered invented
-- registration counts, invented ballot requests and invented fundraising.
-- Bundling them made it worse than a placeholder: a mock baked into a
-- versioned JSON file is indistinguishable from a real figure once it ships,
-- and it reached every site that had ever installed the plugin.
--
-- So they move to the same treatment as polls, news and portraits. The rows live
-- in Supabase, an extract loads them, and the panel renders what the database
-- currently says. A seat with no extract renders no block at all, which is the
-- honest outcome and the one the widgets already implement by returning null.
--
-- Every function here filters `not is_mock`. The column is kept even though
-- nothing sets it any more, as a load-time guard: if a placeholder or a
-- half-finished extract is ever loaded by mistake, the read path drops those
-- rows rather than publishing them. A widget that is missing is recoverable; a
-- fabricated registration count on a live site is not.
--
-- Shape rule, same as poll_summary: a seat with no data gets the full object
-- with available false, never null. Returning null would leave whatever the
-- build happened to bundle on screen -- the exact outcome this design exists to
-- prevent.

-- Fundraising difference in dollars, spelled identically to formatMoney() in
-- backend/src/lib/format.js. This exists for the same reason poll_advantage()
-- does: the map label and the panel figure are read by different people at
-- different times, and a "D +$3.0M" that means 3.04 in one place and 3.0 in the
-- other is a small lie in the one place a reader is checking the number.
create or replace function public.money_advantage(p_amount numeric)
 returns jsonb
 language sql
 immutable
as $function$
  select case
    when p_amount is null then null
    when abs(p_amount) < 0.5 then
      jsonb_build_object('party', 'EVEN', 'label', 'EVEN', 'value', 0)
    else jsonb_build_object(
      'party', case when p_amount > 0 then 'D' else 'R' end,
      'label', (case when p_amount > 0 then 'D' else 'R' end) || ' +' ||
               case
                 when abs(p_amount) >= 1000000
                   then '$' || round(abs(p_amount) / 1000000, 1)::text || 'M'
                 when abs(p_amount) >= 1000
                   then '$' || round(abs(p_amount) / 1000, 0)::text || 'K'
                 else '$' || abs(round(p_amount))::text
               end,
      'value', abs(p_amount))
  end;
$function$;

-- state_funds_summary() returns the federal moneySummary() shape rather than a
-- GA-specific one, so MoneyBlock is written once against a single contract
-- across all four chambers. by_party carries the amounts so a reader can check
-- either total, but deliberately carries no source_url: these rows point at the
-- NCSBE portal rather than at a per-candidate filing, and linking a reader to a
-- portal is worse than showing no link. Filling those in is a data change.
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
  )
  select case when a.n = 0 then jsonb_build_object('available', false)
              else jsonb_build_object(
                'available',         true,
                'dem_amount',        round(a.dem),
                'rep_amount',        round(a.rep),
                'advantage',         public.money_advantage(a.dem - a.rep),
                'by_party',          jsonb_build_object(
                  'D', jsonb_build_object('amount', round(a.dem), 'source_url', null),
                  'R', jsonb_build_object('amount', round(a.rep), 'source_url', null)),
                'reporting_period',  a.period,
                'updated_at',        a.updated_at)
         end
  from agg a;
$function$;

-- Delta between two dated snapshots, null if either end is missing. Mirrors the
-- `delta` helper in backend/src/lib/races.js, which returns null rather than
-- treating an absent column as zero: a snapshot that never recorded one party's
-- ballots has not recorded zero ballots.
create or replace function public.vitals_delta(p_new integer, p_old integer)
 returns integer
 language sql
 immutable
as $function$
  select case when p_new is null or p_old is null then null else p_new - p_old end;
$function$;

-- vitals_summary() compares the earliest and latest snapshot held for the seat.
-- Velocity rather than level is the point of both blocks: the raw count is a
-- fact about the district, the change since the same point in the prior cycle is
-- a fact about the race. So the two blocks lead with the net and carry the party
-- split of that net underneath.
--
-- Two snapshots minimum. A single snapshot has nothing to difference against, and
-- inventing a comparison from one row would be exactly the fiction this
-- migration exists to remove.
create or replace function public.vitals_summary(p_race_id text, p_cycle text default '2026')
 returns jsonb
 language sql
 stable
as $function$
  with seat as (
    select * from public.race_vitals
    where race_id = p_race_id and cycle = p_cycle and not is_mock
  ),
  first_snap as (
    select * from seat order by snapshot_date asc, snapshot asc limit 1
  ),
  last_snap as (
    select * from seat order by snapshot_date desc, snapshot desc limit 1
  ),
  cmp as (
    -- Scalar subqueries rather than a join of first_snap and last_snap. A join
    -- produces no row at all when the seat has no snapshots, and a function
    -- returning zero rows is read by the client as null, which is the one
    -- outcome this contract exists to rule out. Written this way the function
    -- returns exactly one row for every seat, populated or not.
    select
      (select count(*) from seat) as n,
      (select snapshot          from first_snap) as from_snapshot,
      (select snapshot_date     from first_snap) as from_date,
      (select registered_total  from first_snap) as from_total,
      (select snapshot          from last_snap)  as to_snapshot,
      (select snapshot_date     from last_snap)  as to_date,
      (select registered_total  from last_snap)  as to_total,
      (select source            from last_snap)  as source,
      (select updated_at        from last_snap)  as updated_at,
      public.vitals_delta((select registered_dem   from last_snap), (select registered_dem   from first_snap)) as reg_dem,
      public.vitals_delta((select registered_rep   from last_snap), (select registered_rep   from first_snap)) as reg_rep,
      public.vitals_delta((select registered_unaff from last_snap), (select registered_unaff from first_snap)) as reg_unaff,
      public.vitals_delta((select ballots_req_dem   from last_snap), (select ballots_req_dem   from first_snap)) as req_dem,
      public.vitals_delta((select ballots_req_rep   from last_snap), (select ballots_req_rep   from first_snap)) as req_rep,
      public.vitals_delta((select ballots_req_unaff from last_snap), (select ballots_req_unaff from first_snap)) as req_unaff,
      (select ballots_req_dem   from last_snap) as now_req_dem,
      (select ballots_req_rep   from last_snap) as now_req_rep,
      (select ballots_req_unaff from last_snap) as now_req_unaff
  )
  select case
    when c.n < 2 then jsonb_build_object('available', false)
    else jsonb_build_object(
      'available', true,
      'source',     c.source,
      'from',       c.from_snapshot,
      'to',         c.to_snapshot,
      'from_date',  c.from_date,
      'to_date',    c.to_date,
      'registration', jsonb_build_object(
        'baseline', c.from_total,
        'current',  c.to_total,
        'net',      public.vitals_delta(c.to_total, c.from_total),
        -- null, not zero, when there is no baseline to divide by: the block
        -- shows an em dash for a null rate rather than a confident 0.0%.
        'net_pct',  case
                      when c.from_total is null or c.from_total = 0 then null
                      else round(public.vitals_delta(c.to_total, c.from_total)::numeric
                                 * 100 / c.from_total, 2)
                    end,
        'change', jsonb_build_object(
          'total', public.vitals_delta(c.to_total, c.from_total),
          'dem',   c.reg_dem,
          'rep',   c.reg_rep,
          'unaff', c.reg_unaff)),
      -- Deliberately no return rate: how many mailed ballots came back is a
      -- turnout mechanic, not a measure of which way a seat is moving.
      'ballot', jsonb_build_object(
        'net',           coalesce(c.req_dem, 0) + coalesce(c.req_rep, 0) + coalesce(c.req_unaff, 0),
        'current_total', coalesce(c.now_req_dem, 0) + coalesce(c.now_req_rep, 0) + coalesce(c.now_req_unaff, 0),
        'change', jsonb_build_object(
          'total', coalesce(c.req_dem, 0) + coalesce(c.req_rep, 0) + coalesce(c.req_unaff, 0),
          'dem',   c.req_dem,
          'rep',   c.req_rep,
          'unaff', c.req_unaff),
        'by_party', jsonb_build_object(
          'dem',   c.now_req_dem,
          'rep',   c.now_req_rep,
          'unaff', c.now_req_unaff))
    )
  end
  from cmp c;
$function$;

-- map_payload() read both of these tables and shipped their contents to the map
-- anyway. It now takes them from the two functions above, so there is exactly
-- one definition of what a seat's money and velocity are -- the same reasoning
-- that moved map_payload's polling onto poll_summary(). Reproduced in full
-- because CREATE OR REPLACE takes the whole body.
--
-- The change is not only the call. The old inline version aggregated every row
-- for the seat including any is_mock row, and it had no is_mock filter at all,
-- so a placeholder would have been read straight into a published payload. It
-- also emitted `vitals` as a raw array of snapshot rows, which is a different
-- shape from the panel's -- the panel wants the computed delta object. Both now
-- come from one function each, so the map and the panel cannot disagree.
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
--
-- This migration replaces map_payload wholesale, so it had to carry that removal
-- across or applying it would have quietly reintroduced the bug. Candidate names
-- stay bundled; portraits reach the panel through the headshots bucket instead.
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
    r.cpi_value, r.partisan_lean, r.partisan_party, r.holder_party, r.holder_name,
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
      'competitive', competitive,
      -- Who holds the seat, which the candidate rows cannot express when the
      -- sitting member is retiring or was appointed and is not a candidate.
      'holder_party', holder_party,
      'holder_name', holder_name),
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
    'metrics', CASE WHEN competitive THEN jsonb_build_object(
      'polls',   case when (polls->>'available')::boolean then polls->'advantage' end,
      'markets', case when dem_price is not null then jsonb_build_object(
                   'party', case when dem_price > rep_price then 'D' else 'R' end,
                   'value', dem_price - rep_price,
                   'label', (case when dem_price > rep_price then 'D +' else 'R +' end) || abs(dem_price - rep_price)::text) end,
      'money',   case
                   -- Federal first, General Assembly second: a seat has one
                   -- money figure and the source table decides which. Reading
                   -- the GA figure for a congressional seat would report
                   -- statehouse spending on a US House race.
                   when dem_amount is not null then jsonb_build_object(
                     'party', case when dem_amount > rep_amount then 'D' else 'R' end,
                     'value', dem_amount - rep_amount,
                     'label', (case when dem_amount > rep_amount then 'D +' else 'R +' end)
                              || '$' || trim(to_char(abs(dem_amount - rep_amount), 'FM999,999,999,990'))
                   )
                   when (state_funds->>'available')::boolean then jsonb_build_object(
                     'party', state_funds->'advantage'->>'party',
                     'value', state_funds->'advantage'->>'value',
'label', state_funds->'advantage'->>'label')
                  end,
      'coverage', jsonb_build_object(
        'polls', (polls->>'available')::boolean,
        'markets', dem_price is not null,
        'money', dem_amount is not null or (state_funds->>'available')::boolean)
    )
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
