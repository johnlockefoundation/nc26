-- Reconstructed from the live project to make the local migration history
-- replayable. The original file for this version was never committed, so
-- `supabase db push` refused to run against a database carrying it. The
-- definitions below were read back out of the running database with
-- pg_get_functiondef and information_schema, not rewritten from memory: column
-- types, defaults, check constraints, index definitions and FK actions are all
-- copied as they exist live. The comments are the only new prose.
--
-- One seat has one row per cycle, and every per-race table hangs off races.id
-- with ON DELETE CASCADE. That is what makes a cycle switchable: dropping the
-- rows for a cycle cannot leave orphans, and no table re-states the race_type
-- that races already knows.

-- touch_updated_at() is defined here rather than in the functions migration
-- because the triggers below call it, and it is a trigger function rather than
-- a read path.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- A cycle exists only to be referenced: every table that describes 2026 carries
-- a cycle column, and the read functions take p_cycle rather than filtering on
-- a hardcoded year.
create table public.cycles (
  cycle      text primary key,
  label      text,
  created_at timestamptz not null default now()
);

-- district_number is a bare integer and is only meaningful with race_type, so
-- the natural key is all three columns with the cycle.
create table public.races (
  id                 text primary key,
  cycle              text not null references public.cycles(cycle),
  race_type          text not null
                       check (race_type in ('us_house','us_senate','state_senate','state_house')),
  district_number    integer not null,
  title              text,
  competitive        boolean not null default false,
  -- Why a seat is or is not competitive, and where that claim came from. Kept
  -- as data rather than inferred, because a seat is a judgment call and the
  -- site shows the reasoning.
  competitive_source text,
  competitive_reason text,
  cpi_value          text,
  partisan_lean      text
                       check (partisan_lean in ('Safe','Likely','Lean','Toss-up')),
  partisan_party     text check (partisan_party in ('D','R')),
  updated_at         timestamptz not null default now(),
  -- Named explicitly because the generated name would be
  -- races_cycle_race_type_district_number_key, and a constraint rename later
  -- (which is cheap) would then be a spurious diff against a replay.
  constraint races_cycle_type_number_key unique (cycle, race_type, district_number)
);

-- The map is grouped by cycle and filtered on competitive, and the state page
-- lists by type, so both are indexed.
create index races_cycle_type_idx   on public.races (cycle, race_type);
create index races_competitive_idx on public.races (cycle, competitive);

create table public.candidates (
  candidate_id text primary key,
  race_id      text not null references public.races(id) on delete cascade,
  cycle        text not null references public.cycles(cycle),
  name         text not null,
  party        text not null,
  incumbent    boolean not null default false,
  website      text,
  photo_url    text,
  photo_source text,
  updated_at   timestamptz not null default now()
);

create index candidates_race_idx on public.candidates (race_id, cycle);

-- is_seed marks rows that came from the committed seed rather than a fetch, and
-- every read path filters on it: a seed poll is a placeholder for layout, and
-- presenting one as a real number would be the exact failure this whole design
-- is trying to avoid.
create table public.polls (
  poll_id      text primary key,
  race_id      text not null references public.races(id) on delete cascade,
  cycle        text not null references public.cycles(cycle),
  pollster     text not null,
  start_date   date,
  end_date     date,
  sample_size  integer,
  population   text check (population in ('RV','LV','A')),
  dem_share    numeric not null,
  rep_share    numeric not null,
  margin       numeric not null,
  source_url   text,
  source       text,
  is_seed      boolean not null default false,
  ingested_at  timestamptz not null default now()
);

create index polls_race_idx on public.polls (race_id, cycle);

-- markets is the latest state per provider; market_snapshots is the history.
-- Splitting them means the map needs one row per seat while a price series is
-- still available for the detail view.
create table public.markets (
  race_id      text not null references public.races(id) on delete cascade,
  cycle        text not null references public.cycles(cycle),
  provider     text not null,
  dem_price    numeric,
  rep_price    numeric,
  advantage    numeric,
  updated_at   timestamptz,
  source_url   text,
  is_seed      boolean not null default false,
  primary key (race_id, cycle, provider)
);

create table public.market_snapshots (
  race_id        text not null references public.races(id) on delete cascade,
  cycle          text not null references public.cycles(cycle),
  provider       text not null,
  as_of          date not null,
  dem_price      numeric,
  rep_price      numeric,
  dem_bid_price  numeric,
  rep_bid_price  numeric,
  primary key (race_id, cycle, provider, as_of)
);

-- The detail view reads the newest snapshot per provider, so as_of is sorted
-- descending in the index rather than ascending in the key.
create index market_snapshots_lookup_idx
  on public.market_snapshots (race_id, cycle, provider, as_of desc);

-- One row per seat, holding the cycle's totals rather than per-candidate rows.
create table public.fundraising (
  race_id           text not null references public.races(id) on delete cascade,
  cycle             text not null references public.cycles(cycle),
  dem_amount        numeric,
  rep_amount        numeric,
  advantage         numeric,
  reporting_period  text,
  updated_at        timestamptz,
  source_url        text,
  -- Receipts and cash-on-hand are not interchangeable, and mixing them would
  -- make an advantage figure meaningless.
  source_method     text check (source_method in ('total_receipts','cash_on_hand')),
  is_seed           boolean not null default false,
  primary key (race_id, cycle)
);

-- Per-candidate, unlike fundraising, because the panel lists each filer's
-- total raised and cash on hand separately.
create table public.state_funds (
  candidate_id      text primary key,
  race_id           text not null references public.races(id) on delete cascade,
  cycle             text not null references public.cycles(cycle),
  candidate_name    text not null,
  party             text not null,
  total_raised      numeric,
  total_spent       numeric,
  cash_on_hand      numeric,
  contributions     integer,
  small_donors      integer,
  reporting_period  text,
  source_url        text,
  is_mock           boolean not null default false,
  updated_at        timestamptz not null default now()
);

create index state_funds_race_idx on public.state_funds (race_id, cycle);

-- Several snapshots per seat over time, keyed by a label the panel can show
-- ("2026-06-01", "2024-11-05").
create table public.race_vitals (
  race_id             text not null references public.races(id) on delete cascade,
  cycle               text not null references public.cycles(cycle),
  snapshot            text not null,
  snapshot_date       date not null,
  registered_total    integer,
  registered_dem      integer,
  registered_rep      integer,
  registered_unaff    integer,
  ballots_req_dem     integer,
  ballots_req_rep     integer,
  ballots_req_unaff   integer,
  is_mock             boolean not null default false,
  source              text,
  updated_at          timestamptz not null default now(),
  primary key (race_id, cycle, snapshot)
);

-- Demographic profile per seat, and the only place pres_margin and ci are
-- duplicated onto a per-race table rather than read from races.
create table public.race_profiles (
  race_id         text primary key,
  cycle           text not null references public.cycles(cycle),
  median_age      numeric,
  median_income   integer,
  bachelors_plus  numeric,
  race_white      numeric,
  race_black      numeric,
  race_hispanic   numeric,
  pres_margin     text,
  cpi             text,
  source          text,
  updated_at      timestamptz
);

-- race_profiles has a primary key on race_id alone, so this FK is what stops a
-- profile outliving its seat when a cycle is rebuilt. Not a unique constraint,
-- so a second profile for the same seat is permitted here even though the key
-- would reject it.
alter table public.race_profiles
  add constraint race_profiles_race_id_fkey
  foreign key (race_id) references public.races(id) on delete cascade;

-- One row per gauge, keyed by the chamber names the read function returns
-- (us_house, us_senate, nc_house, nc_senate). today_* is a separate from dem
-- and rep so a "since yesterday" movement can be shown without recomputing it
-- per render.
create table public.outlooks (
  key         text primary key,
  label       text not null,
  dem         integer not null,
  rep         integer not null,
  tossup      integer not null default 0,
  threshold   integer not null,
  total       integer not null,
  today_dem   integer,
  today_rep   integer,
  source      text,
  updated_at  timestamptz
);

-- Feed health, so the panel can say which sources are live instead of implying
-- everything is current. status is a text enum rather than a postgres enum
-- because the values are read and written by ingest scripts, not by a
-- migration.
create table public.ingest_runs (
  source        text primary key,
  last_fetched  timestamptz,
  last_success  timestamptz,
  last_error    text,
  status        text default 'never',
  notes         text
);

-- updated_at is maintained by trigger rather than by the ingest scripts, so a
-- row written by a script that forgets the column is still dated correctly.
create trigger candidates_touch before update on public.candidates
  for each row execute function public.touch_updated_at();
create trigger state_funds_touch before update on public.state_funds
  for each row execute function public.touch_updated_at();
create trigger race_vitals_touch before update on public.race_vitals
  for each row execute function public.touch_updated_at();
