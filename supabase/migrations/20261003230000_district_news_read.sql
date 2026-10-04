-- Per-seat news gets a live read, so `news` can stay out of the bundle.
--
-- Same defect as markets (20261003210000) and money (20261003220000), and older
-- than either: `news` has been in VOLATILE_RACE_KEYS since the reference layer
-- shipped in 7230618. map_payload has read stories for the map card since
-- 20261001160000, but getRace never did, so race.news was always undefined and
-- DistrictNews -- which returns null on an empty list -- has never rendered.
-- The ticker was unaffected: ticker() does not filter on race_id.
--
-- Field names alias id -> article_id and source -> outlet, exactly as the
-- news_rows CTE in map_payload already does, so the component reads the same
-- shape from both and needs no changes.
--
-- Two rules the payload builder already applies, kept here because dropping
-- either would make the panel lie:
--
--   * Only stories tagged to this exact seat. A district never borrows statewide
--     coverage, and an untagged story is a ticker story only. Both are deliberate
--     -- most stories are statewide and are not about one district, so attaching
--     them to seats would be an editorial claim the data does not support. Two of
--     the seven published stories are tagged, and the other five are correct to
--     appear on the ticker alone.
--
--   * Not filtered by cycle. A story carries no cycle column, and the table is
--     small enough that a 2028 story on a 2026 card is a better failure than
--     dropping it at write time. Same reasoning as the CTE above.
--
-- An empty array, not null: DistrictNews already treats an empty list as "render
-- nothing", which is the correct outcome for the untagged seats.
create or replace function public.district_news(
  p_race_id text, p_cycle text default '2026'::text, p_limit integer default 6)
 returns jsonb
 language sql
 stable
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'article_id',   s.id::text,
    'headline',     s.headline,
    'outlet',       s.source,
    'published_at', s.published_at,
    'url',          s.url
  ) order by s.published_at desc), '[]'::jsonb)
  from (
    select * from public.stories
    where race_id = p_race_id and race_id is not null and url <> ''
    order by published_at desc
    limit greatest(coalesce(p_limit, 6), 1)
  ) s;
$function$;
