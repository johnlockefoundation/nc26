-- Prediction markets get a live read, so markets can stay out of the bundle.
--
-- Why this exists. markets has been in VOLATILE_RACE_KEYS for the plugin export
-- since the reference layer shipped (7230618), but no read function ever backed
-- it. c4c22e7 then added the same stripping to export-static.mjs, so the Pages
-- demo lost its Kalshi quotes too -- 15 real rows in SQLite stopped being
-- published -- and nothing on the page noticed. Markets also sit at the top of
-- primarySignal(), so district fill colours silently fell back to polls and
-- then to the Civitas lean. A key stripped from the bundle has to have a live
-- read on the same change that strips it. This migration is that read.
--
-- The shapes here match marketSummary() and marketList() in
-- backend/src/lib/races.js key for key, including `available: false` for a seat
-- with no quote rather than null. The panel is written against one contract and
-- does not know which target it is on.
--
-- public.markets is empty and public.market_snapshots with it, so every seat
-- returns available false until rows are loaded. That is the intended state: a
-- widget with no data renders no box.

-- Cent-scale advantage, matching formatMarketAdvantage() in
-- backend/src/lib/format.js. The 0.5-point threshold is the same one
-- poll_advantage() uses: below half a cent the market is not saying anything,
-- so it prints EVEN rather than picking a side.
create or replace function public.market_advantage(p_advantage numeric)
 returns jsonb
 language sql
 immutable
as $function$
  select case
    when p_advantage is null then null
    when abs(p_advantage) * 100 < 0.5 then
      jsonb_build_object('party', 'EVEN', 'label', 'EVEN', 'value', 0)
    else jsonb_build_object(
      'party', case when p_advantage > 0 then 'D' else 'R' end,
      'label', (case when p_advantage > 0 then 'D' else 'R' end)
               || ' +' || round(abs(p_advantage) * 100)::text,
      'value', round(abs(p_advantage) * 100))
  end;
$function$;

-- The weekly movement arrow. Mirrors marketWeeklyMove() in races.js:
--
--   * Needs two snapshots. One row has nothing to compare against, and
--     inventing a comparison from a single point is the same fiction the GA
--     mock figures were.
--   * Baseline is the newest snapshot at least 7 days before the latest, so a
--     quiet week does not compare a Tuesday against a Monday. If the series is
--     shorter than a week the oldest snapshot is used instead, which is what
--     races.js does, so the arrow still prints rather than going blank.
--   * A move can print from the traded price or from the live bid. A one-sided
--     sweep moves the last trade while the bid sits still; a wide book lets the
--     bid collapse while the last trade goes stale. Whichever side moved more
--     is the one shown.
create or replace function public.market_weekly_move(
  p_race_id text, p_cycle text, p_provider text default 'Kalshi')
 returns jsonb
 language sql
 stable
as $function$
with days as (
  select as_of, dem_price, rep_price, dem_bid_price, rep_bid_price,
         row_number() over (order by as_of desc) as rn
  from public.market_snapshots
  where race_id = p_race_id and cycle = p_cycle and provider = p_provider
),
latest as (
  select * from days where rn = 1
),
prev as (
  -- Newest snapshot on or before the 7-day cutoff. When the series is shorter
  -- than a week that set is empty, so fall back to the oldest row in it. The
  -- fallback is what the comment below claims: without it prev returns no rows,
  -- the cross join below produces nothing, and the whole function returns null
  -- rather than a short-window arrow.
  select * from days
  where as_of <= (select as_of::timestamp - interval '7 days' from latest)
  union all
  select * from days
  where not exists (
    select 1 from days
    where as_of <= (select as_of::timestamp - interval '7 days' from latest))
  order by as_of asc limit 1
),
-- The change in the spread, which is current-minus-previous, not the current
-- spread. Both rows of the cross join are referenced: dropping the `p.` side
-- silently computes the level instead of the move, which reports a market at
-- D+85 as having moved "D +84.7".
-- A side only counts when all four of its prices are present on both days; a
-- null on either end makes that side unmeasurable rather than zero.
spread as (
  select ((l.dem_price - l.rep_price) - (p.dem_price - p.rep_price)) * 100 as trade_move
  from latest l, prev p
  where l.dem_price is not null and l.rep_price is not null
    and p.dem_price is not null and p.rep_price is not null
  union all
  select ((l.dem_bid_price - l.rep_bid_price) - (p.dem_bid_price - p.rep_bid_price)) * 100
  from latest l, prev p
  where l.dem_bid_price is not null and l.rep_bid_price is not null
    and p.dem_bid_price is not null and p.rep_bid_price is not null
),
moves as (
  select trade_move from spread where trade_move is not null
),
best as (
  select trade_move from moves order by abs(trade_move) desc limit 1
)
select case
  when (select count(*) from days) < 2 then null
  when best.trade_move is null then null
  when abs(best.trade_move) < 0.05 then
    jsonb_build_object('party', 'EVEN', 'points', 0)
  else jsonb_build_object(
    'party', case when best.trade_move > 0 then 'D' else 'R' end,
    'points', round(abs(best.trade_move)::numeric, 1))
end
from best;
$function$;

-- Every quoted venue for a race, mirroring marketList() in races.js. Kalshi is
-- currently the only venue, but returning the list rather than a single venue
-- means adding a second source shows both instead of silently dropping one.
create or replace function public.market_list(p_race_id text, p_cycle text default '2026'::text)
 returns jsonb
 language sql
 stable
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'available',   true,
    'provider',    m.provider,
    'dem_price',   m.dem_price,
    'rep_price',   m.rep_price,
    'advantage',   public.market_advantage(m.advantage),
    'delta',       public.market_weekly_move(m.race_id, p_cycle, m.provider),
    'updated_at',  m.updated_at,
    'source_url',  m.source_url,
    'is_seed',     m.is_seed
  ) order by m.provider), '[]'::jsonb)
  from public.markets m
  where m.race_id = p_race_id and m.cycle = p_cycle
    and m.dem_price is not null and m.rep_price is not null;
$function$;

-- The single most recent quote for the seat, mirroring marketSummary().
--
-- is_seed rows are excluded here and were not before: map_payload's inline
-- market_rows already filtered them, but nothing filtered them on the panel
-- path, so a hand-entered placeholder quote would have printed as a live price.
-- is_mock is the column other reads use; markets has always called it is_seed.
create or replace function public.markets_summary(p_race_id text, p_cycle text default '2026'::text)
 returns jsonb
 language sql
 stable
as $function$
-- The CTE is left-joined rather than aggregated, because `select ... from m` on
-- an empty CTE returns zero rows and a zero-row function returns NULL, not an
-- object. NULL is exactly what this repo's read contract forbids: the frontend
-- skips nulls when overlaying, so a null here would leave whatever the build
-- bundled on screen. Always one row, always the full shape.
with m as (
  select * from public.markets
  where race_id = p_race_id and cycle = p_cycle and not is_seed
  order by updated_at desc nulls last
  limit 1
),
one as (
  select coalesce(
    (select jsonb_build_object(
       'available',  true,
       'provider',   m.provider,
       'dem_price',  m.dem_price,
       'rep_price',   m.rep_price,
       'advantage',  public.market_advantage(m.advantage),
       'delta',      public.market_weekly_move(m.race_id, p_cycle, m.provider),
       'updated_at', m.updated_at,
       'source_url', m.source_url,
       'is_seed',    false)
     from m
     where m.dem_price is not null and m.rep_price is not null),
    jsonb_build_object(
      'available',  false,
      'provider',   null,
      'dem_price',  null,
      'rep_price',   null,
      'advantage',  null,
      'delta',      null,
      'updated_at', null,
      'source_url', null,
      'is_seed',    false)
  ) as payload
)
select payload from one;
$function$;
