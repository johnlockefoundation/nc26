-- Reconstructed from the live project; see the header of core_schema for how.
--
-- Every table gets RLS and an identical anon SELECT policy. No INSERT, UPDATE
-- or DELETE policy exists for anon, which is what makes the anon key safe to
-- ship in the frontend bundle: it can read, and it cannot write. Writes go
-- through service_role, which bypasses RLS.
--
-- The policy is written per table rather than reused via a role, because
-- postgres has no policy-inheritance: a table with RLS enabled and no policy is
-- invisible to everyone but the table owner, so forgetting one table silently
-- blanks it rather than leaking it.
--
-- ingest_runs is the exception: RLS is on but it gets no policy, so it is
-- unreadable to anon. meta() reads it through this function as the function
-- owner, which is why the feed-health panel works while the table stays shut.
-- Enabling RLS without a policy makes a table invisible to a role rather than
-- open, so nothing here leaks by being forgotten -- it only reads empty.
alter table public.candidates       enable row level security;
alter table public.cycles           enable row level security;
alter table public.fundraising      enable row level security;
alter table public.ingest_runs      enable row level security;
alter table public.market_snapshots enable row level security;
alter table public.markets          enable row level security;
alter table public.outlooks         enable row level security;
alter table public.polls            enable row level security;
alter table public.race_profiles    enable row level security;
alter table public.race_vitals      enable row level security;
alter table public.races            enable row level security;
alter table public.state_funds      enable row level security;

create policy "anon read published data" on public.candidates
  for select to anon using (true);
create policy "anon read published data" on public.cycles
  for select to anon using (true);
create policy "anon read published data" on public.fundraising
  for select to anon using (true);
create policy "anon read published data" on public.market_snapshots
  for select to anon using (true);
create policy "anon read published data" on public.markets
  for select to anon using (true);
create policy "anon read published data" on public.outlooks
  for select to anon using (true);
create policy "anon read published data" on public.polls
  for select to anon using (true);
create policy "anon read published data" on public.race_profiles
  for select to anon using (true);
create policy "anon read published data" on public.race_vitals
  for select to anon using (true);
create policy "anon read published data" on public.races
  for select to anon using (true);
create policy "anon read published data" on public.state_funds
  for select to anon using (true);
