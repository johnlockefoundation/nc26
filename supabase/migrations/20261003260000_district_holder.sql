-- Who holds each General Assembly seat, from the NCGA roster.
--
-- Added because `candidates.incumbent` cannot answer it. That flag marks a
-- candidate who is the sitting member, so a seat whose occupant is retiring, or
-- who was appointed mid-session and is not on the ballot, has no row that can
-- carry it -- the holder exists and neither candidate is them. That is 18 of the
-- 170 General Assembly seats today, which is why the hemicycle rendered them with
-- no holder at all rather than with a wrong one.
--
-- `holder_party` is D | R | U. The U is not a placeholder: two 2025-26 House
-- seats are held by unaffiliated members, Nasif Majeed in the 99th and Carla
-- Cunningham in the 106th. Neither party colour would be honest for them, so the
-- column carries the value through instead of coercing it to null or to the
-- nearest party.
--
-- NOTE ON ORDER. 20261003190000_ga_metrics_live_reads.sql also defines
-- map_payload, at an earlier revision. Re-running it after this file will revert
-- map_payload to that revision and drop the markets delta, which silently removes
-- every map arrow. Apply this file and 20261003240000 in version order, and if
-- arrows go missing after touching the read functions, check which map_payload is
-- actually deployed with pg_get_functiondef rather than trusting the file on disk.
--
-- This is reference data for the same reason `competitive` is: it comes from a
-- real published roster and is a fact about who holds the seat, not a live
-- reading. Like the designation it is bundled rather than overlaid, so the client
-- must not let a live read replace it -- see REFERENCE_ONLY_KEYS in
-- frontend/src/api.js.

alter table public.races
  add column if not exists holder_party text,
  add column if not exists holder_name text;

comment on column public.races.holder_party is
  'Party holding the seat per the NCGA roster: D, R or U (unaffiliated).';
comment on column public.races.holder_name is
  'Sitting member of the NCGA roster for the cycle, which may not be a candidate.';

grant execute on function public.map_payload(text, text) to anon, authenticated;