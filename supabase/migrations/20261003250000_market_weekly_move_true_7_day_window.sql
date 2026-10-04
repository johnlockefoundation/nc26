-- Correct the weekly window in market_weekly_move().
--
-- The function has always described itself as comparing "the newest snapshot on
-- or before the 7-day cutoff" against the latest, and the product has always
-- drawn its arrows from a much older row than that. Nothing about the schema,
-- the RPC names or the frontend changed: the predicate was `order by as_of asc
-- limit 1` over a UNION ALL, which orders the union as a whole and therefore
-- picked the oldest qualifying snapshot. On the seats that carry snapshots the
-- arrow was a 13-to-15-day move presented as a week's.
--
-- This does not change any seat's party, only the magnitude, and it can remove
-- an arrow where a 7-day move is flat while the longer window was not.

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
  -- Newest snapshot on or before the 7-day cutoff, and when the series is
  -- shorter than a week, the oldest snapshot in it.
  --
  -- Each branch is a parenthesised subquery with its own ORDER BY and LIMIT,
  -- and that is load-bearing rather than stylistic. A trailing ORDER BY on a
  -- UNION ALL orders the union as a whole, so the previous single `asc` here
  -- took the OLDEST row of the cutoff branch: the comment above it claimed
  -- "newest ... on or before the 7-day cutoff" while the code did the
  -- opposite, and every arrow in the product was measuring 13 to 15 days and
  -- calling it a week. NC-SEN reported +5.5 for a fortnight's move when its
  -- true weekly move was +2.8.
  --
  -- Simply flipping that to `desc` fixes the common case and breaks the
  -- fallback, because the two branches want opposite orders: the cutoff branch
  -- wants the row nearest the cutoff, the fallback wants the oldest row it has.
  -- Under one `desc` the fallback returns the newest row -- the same row as
  -- `latest` -- so the move is computed against itself, comes out 0, and every
  -- short-series race silently reports EVEN instead of an arrow. Verified both
  -- ways against a Postgres 16 fixture before shipping this.
  (
    select * from days
    where as_of <= (select as_of::timestamp - interval '7 days' from latest)
    order by as_of desc limit 1
  )
  union all
  (
    select * from days
    where not exists (
      select 1 from days
      where as_of <= (select as_of::timestamp - interval '7 days' from latest))
    order by as_of asc limit 1
  )
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

grant execute on function public.market_weekly_move(text, text, text) to anon, authenticated;
