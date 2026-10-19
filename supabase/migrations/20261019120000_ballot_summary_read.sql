-- Ballot requests per seat as a level, read live the same way every other
-- figure in the panel is.
--
-- This is the read behind BALLOTS, which until now was a link out to
-- carolinaelections.com because that site was where the data lived. The data
-- now arrives there first and lands in race_vitals through the human-run
-- loader (backend/scripts/load-ballots.mjs), so the panel can carry the figure
-- itself and keep the tracker link as attribution rather than as the product.
--
-- Why a second function when vitals_summary already reads race_vitals:
-- vitals_summary returns available false below two snapshots, on purpose --
-- its product is the difference between the first and the last snapshot, and
-- a difference invented from one row is the fiction its migration exists to
-- remove. The level is different: one snapshot is a fact, and refusing to
-- show it would hold the widget hostage to a second loader run that may be a
-- week out. So the level lives here, the velocity stays there, and neither
-- pretends to the other's evidence. A seat with one snapshot gets a level
-- here and an unavailable vitals there; a seat with none gets available false
-- from both, which is the contract every read in this file shares: the full
-- object with available false, never null, never a bare row that leaves
-- whatever the build bundled standing in for a live reading.
--
-- Registered counts are deliberately absent: VoterRegistrations in the source
-- database is keyed by county, not district, so there is no honest per-seat
-- registration figure to load, and race_vitals.registered_* stays null. The
-- loader does not touch those columns, and the upsert below does not update
-- them.
--
-- The folded figure is the lead between the two parties as a share of the
-- requests recorded so far, in points. A share rather than a count of ballots,
-- because the panel stacks a 60,000-request Senate district above a
-- 10,000-request House one and a raw difference would read as the bigger lead on
-- the bigger seat; and taken over the whole box rather than over the two parties
-- alone, because unaffiliated requests are a third of it and dropping them would
-- describe a two-party contest the source does not.
--
-- Deliberately absent: any comparison against an earlier election. The source
-- carries no request date -- ElectionDate is the election and Created is the
-- ETL load -- so the 2024 table is a complete cycle while the current one is
-- mid-flight, and the difference between them would be a calendar artefact
-- dressed as a swing. The honest cross-cycle figure arrives when both cycles are
-- complete, and the thing that measures movement in the meantime is
-- vitals_summary, which has two dated observations of the same cycle.
--
-- Every read filters not is_mock for the same reason the others do: a
-- half-finished extract is dropped rather than published.

create or replace function public.ballot_summary(p_race_id text, p_cycle text default '2026')
 returns jsonb
 language sql
 stable
as $function$
  with seat as (
    select * from public.race_vitals
    where race_id = p_race_id and cycle = p_cycle and not is_mock
  ),
  last_snap as (
    select * from seat order by snapshot_date desc, snapshot desc limit 1
  ),
  cmp as (
    -- Scalar subqueries rather than a join, the same shape vitals_summary
    -- uses: a join produces no row when the seat has no snapshots, and a
    -- zero-row function is read by the client as null. Written this way the
    -- function returns exactly one row for every seat, populated or not.
    select
      (select count(*)     from seat) as n,
      (select snapshot     from last_snap) as snapshot,
      (select snapshot_date from last_snap) as snapshot_date,
      (select source       from last_snap) as source,
      (select updated_at   from last_snap) as updated_at,
      (select ballots_req_dem   from last_snap) as req_dem,
      (select ballots_req_rep   from last_snap) as req_rep,
      (select ballots_req_unaff from last_snap) as req_unaff
  ),
  calc as (
    -- Null when either party is missing, and null on an all-zero snapshot: an
    -- advantage between a number and nothing is the fabricated zero by_party
    -- already refuses to carry, and a lead computed against a zero total would
    -- divide by it. Below half a point apart the lead is called EVEN, spelled
    -- the way poll_advantage spells it so the same lead reads the same way
    -- whichever box prints it.
    select c.*,
      coalesce(c.req_dem, 0) + coalesce(c.req_rep, 0) + coalesce(c.req_unaff, 0) as total,
      case
        when c.req_dem is null or c.req_rep is null then null
        when coalesce(c.req_dem, 0) + coalesce(c.req_rep, 0) + coalesce(c.req_unaff, 0) = 0 then null
        else round(100.0 * (c.req_dem - c.req_rep)
             / (coalesce(c.req_dem, 0) + coalesce(c.req_rep, 0) + coalesce(c.req_unaff, 0)), 1)
      end as margin
    from cmp c
  )
  select case
    when c.n < 1 then jsonb_build_object('available', false)
    else jsonb_build_object(
      'available', true,
      'snapshot',      c.snapshot,
      'snapshot_date', c.snapshot_date,
      'source',        c.source,
      'updated_at',    c.updated_at,
      -- Level only: no net, and no change against an earlier snapshot, which is
      -- vitals_summary's evidence and only exists once there are two. The share
      -- below is a reading of this one snapshot, not a movement between two.
      -- by_party keeps nulls as nulls rather than zero, because a snapshot that
      -- never recorded a party's requests has not recorded zero of them -- the
      -- same distinction the vitals migration draws. The total coalesces, as
      -- vitals_summary's ballot total does, so the three party figures a loader
      -- always writes sum to the headline, and so the share above is taken over
      -- every request the box shows rather than over a subset of them.
      'ballot', jsonb_build_object(
        'current_total', c.total,
        'by_party', jsonb_build_object(
          'dem',   c.req_dem,
          'rep',   c.req_rep,
          'unaff', c.req_unaff),
        'advantage', case
          when c.margin is null then null
          when abs(c.margin) < 0.05 then
            jsonb_build_object('party', 'EVEN', 'label', 'EVEN', 'value', 0)
          else jsonb_build_object(
            'party', case when c.margin > 0 then 'D' else 'R' end,
            'label', (case when c.margin > 0 then 'D' else 'R' end)
                     || ' +' || round(abs(c.margin), 1)::text,
            'value', abs(c.margin))
        end)
    )
  end
  from calc c;
$function$;
