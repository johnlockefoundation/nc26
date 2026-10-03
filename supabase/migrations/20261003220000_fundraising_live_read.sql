-- Federal fundraising gets a live read, so `money` can stay out of the bundle.
--
-- Same defect as markets (20261003210000), older by a week. `money` has been in
-- VOLATILE_RACE_KEYS since the reference layer shipped in 7230618, and nothing
-- ever read it back: getRace overlays polls, markets, market_list, state_funds
-- and vitals, and no federal money. So congressional MONEY rows have rendered
-- nothing on the plugin since it was first packaged, while the Pages demo kept
-- showing real FEC totals because export-static.mjs had no stripping until
-- c4c22e7. A key stripped from the bundle has to have a live read on the same
-- change that strips it.
--
-- The shape mirrors moneySummary() in backend/src/lib/races.js key for key,
-- including by_party, so MoneyBlock is written once across four chambers. The
-- GA equivalent already exists as state_funds_summary.
--
-- is_seed is filtered, matching state_funds_summary. map_payload's inline
-- money_rows filtered it too, but nothing filtered it on the panel path, so a
-- hand-entered placeholder would have printed as a real filing total.
--
-- public.fundraising is empty, so every seat returns available false until rows
-- are loaded. A seat with no money renders no box, which is the correct state.

-- Dollar formatting, matching formatMoney() in backend/src/lib/format.js. Kept
-- in step with money_advantage() in 20261003190000, which formats state_funds
-- with the same rules; change one, change both.
create or replace function public.fundraising_advantage(p_amount numeric)
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
        case when abs(p_amount) >= 1000000
                  then '$' || round((abs(p_amount) / 1000000)::numeric, 1)::text || 'M'
             when abs(p_amount) >= 1000
                  then '$' || round((abs(p_amount) / 1000)::numeric)::text || 'K'
             else '$' || round(abs(p_amount))::text end,
      'value', abs(p_amount))
  end;
$function$;

-- The per-candidate filing URLs, which money_summary reads for by_party.
--
-- SQLite has carried these since fetch-fec.mjs began writing them (see the
-- columns in backend/src/schema.sql and the alter in backend/src/db.js), but
-- public.fundraising was created without them, so the Supabase copy cannot hold
-- the one thing MoneyBlock exists to show: a link to each filer's own record.
-- Adding the columns here rather than dropping them from the payload, because
-- the alternative is a MONEY box that shows a margin and no way to check it --
-- which is the bug that made this block collapsible in the first place.
--
-- Nullable, so existing rows are untouched and a race filed without per-candidate
-- URLs still reads back with null links, which MoneyBlock renders as plain text.
alter table public.fundraising add column if not exists dem_source_url text;
alter table public.fundraising add column if not exists rep_source_url text;

-- Federal fundraising for one seat, mirroring moneySummary() in races.js.
-- The GA equivalent is state_funds_summary() in 20261003190000, and it returns
-- the same shape, so MoneyBlock renders either without knowing which it has.
create or replace function public.money_summary(p_race_id text, p_cycle text default '2026'::text)
 returns jsonb
 language sql
 stable
as $function$
-- Coalesced rather than selected from the row CTE, so a seat with no filing
-- still returns one row with the full shape. `select ... from <empty cte>`
-- returns zero rows, and a zero-row function returns SQL NULL -- which is what
-- this repo's read contract forbids, since overlayVolatile skips nulls and would
-- leave whatever the build bundled on screen.
with f as (
  select * from public.fundraising
  where race_id = p_race_id and cycle = p_cycle and not is_seed
  limit 1
),
one as (
  select coalesce(
    (select jsonb_build_object(
       'available',         true,
       'dem_amount',        f.dem_amount,
       'rep_amount',        f.rep_amount,
       'advantage',         public.fundraising_advantage(f.advantage),
       -- The per-candidate split, so the panel can attribute a total to a person
       -- and link that person to their own filing. A margin alone says D beat R
       -- by X; it says nothing about either total, which is the part a reader
       -- wants to check.
       'by_party',          jsonb_build_object(
         'D', jsonb_build_object('amount', f.dem_amount, 'source_url', f.dem_source_url),
         'R', jsonb_build_object('amount', f.rep_amount, 'source_url', f.rep_source_url)),
       'reporting_period',  f.reporting_period,
       'updated_at',        f.updated_at,
       'source_url',        f.source_url,
       'method',            f.source_method,
       'is_seed',           false)
     from f
     where f.dem_amount is not null or f.rep_amount is not null),
    jsonb_build_object(
      'available',         false,
      'dem_amount',        null,
      'rep_amount',        null,
      'advantage',         null,
      'by_party',          null,
      'reporting_period',  null,
      'updated_at',        null,
      'source_url',        null,
      'method',            null,
      'is_seed',           false)
  ) as payload
)
select payload from one;
$function$;
