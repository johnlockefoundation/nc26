-- One table for news, in the shape the site actually needs: a headline, a
-- link, where it came from, whether it belongs in the ticker, and optionally
-- which race it is about.
--
-- This replaces two tables that split one job in two. `news` carried a cycle
-- foreign key, a `topic`/`relevance_score` pair nothing read, and an
-- `in_funnel` flag that `ticker()` ignored entirely, so a story flagged
-- in_funnel never reached the ticker. `ticker_stories` was the table the
-- ticker actually read, which meant "put this in the ticker" was answered by
-- writing to a different table than "show this on a race card". One row is now
-- both, and `ticker` is a yes/no column on it.
create table public.stories (
  id           uuid primary key default gen_random_uuid(),
  url          text        not null,
  headline     text        not null,
  source       text        not null check (source in ('John Locke Foundation', 'Carolina Journal')),
  -- yes/no. Unset stories render on a race card when race_id is set and are
  -- never in the ticker; this is the only thing that decides ticker membership.
  ticker       boolean     not null default false,
  -- Optional. Null means the story is not about one seat, so it can only be a
  -- ticker story. Deliberately not a foreign key: the pipeline should be able
  -- to record a story before anyone has decided which seat it belongs to, and
  -- a bad id here should cost one story's placement, not the write.
  race_id      text,
  published_at timestamptz not null,
  created_at   timestamptz not null default now(),
  -- The link is the natural key, so a re-run of the pipeline updates a story
  -- rather than accumulating duplicate rows for the same article.
  unique (url)
);

create index stories_ticker_idx  on public.stories (published_at desc) where ticker;
create index stories_race_idx    on public.stories (race_id, published_at desc) where race_id is not null;

alter table public.stories enable row level security;

-- Read-only for the site. The pipeline authenticates with the service role,
-- which bypasses RLS, so this policy is the only thing the public sees and it
-- cannot write.
create policy "anon read stories" on public.stories for select to anon using (true);

-- Ticker membership is the `ticker` column and nothing else. Ordered by date
-- because a ticker shows the most recent thing that happened.
create or replace function public.ticker(p_limit integer default 12)
 returns jsonb
 language sql
 stable
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'article_id',   id::text,
    'district_id',  race_id,
    'headline',     headline,
    'outlet',       source,
    'url',          url,
    'published_at', published_at
  ) order by published_at desc), '[]'::jsonb)
  from (select * from public.stories where ticker order by published_at desc limit greatest(p_limit, 0)) s;
$function$;

-- Reference rows only: which seats exist, and what kind each is. Nothing
-- about competitiveness or lean is asserted here -- those are editorial calls,
-- and a seeding job has no business making them.
insert into public.cycles (cycle, label) values ('2026','2026')
on conflict (cycle) do nothing;

insert into public.races (id, cycle, race_type, district_number, competitive, updated_at) values
  ('HD-1','2026','state_house',1,false,now()),
  ('HD-2','2026','state_house',2,false,now()),
  ('HD-3','2026','state_house',3,false,now()),
  ('HD-4','2026','state_house',4,false,now()),
  ('HD-5','2026','state_house',5,false,now()),
  ('HD-6','2026','state_house',6,false,now()),
  ('HD-7','2026','state_house',7,false,now()),
  ('HD-8','2026','state_house',8,false,now()),
  ('HD-9','2026','state_house',9,false,now()),
  ('HD-10','2026','state_house',10,false,now()),
  ('HD-11','2026','state_house',11,false,now()),
  ('HD-12','2026','state_house',12,false,now()),
  ('HD-13','2026','state_house',13,false,now()),
  ('HD-14','2026','state_house',14,false,now()),
  ('HD-15','2026','state_house',15,false,now()),
  ('HD-16','2026','state_house',16,false,now()),
  ('HD-17','2026','state_house',17,false,now()),
  ('HD-18','2026','state_house',18,false,now()),
  ('HD-19','2026','state_house',19,false,now()),
  ('HD-20','2026','state_house',20,false,now()),
  ('HD-21','2026','state_house',21,false,now()),
  ('HD-22','2026','state_house',22,false,now()),
  ('HD-23','2026','state_house',23,false,now()),
  ('HD-24','2026','state_house',24,false,now()),
  ('HD-25','2026','state_house',25,false,now()),
  ('HD-26','2026','state_house',26,false,now()),
  ('HD-27','2026','state_house',27,false,now()),
  ('HD-28','2026','state_house',28,false,now()),
  ('HD-29','2026','state_house',29,false,now()),
  ('HD-30','2026','state_house',30,false,now()),
  ('HD-31','2026','state_house',31,false,now()),
  ('HD-32','2026','state_house',32,false,now()),
  ('HD-33','2026','state_house',33,false,now()),
  ('HD-34','2026','state_house',34,false,now()),
  ('HD-35','2026','state_house',35,false,now()),
  ('HD-36','2026','state_house',36,false,now()),
  ('HD-37','2026','state_house',37,false,now()),
  ('HD-38','2026','state_house',38,false,now()),
  ('HD-39','2026','state_house',39,false,now()),
  ('HD-40','2026','state_house',40,false,now()),
  ('HD-41','2026','state_house',41,false,now()),
  ('HD-42','2026','state_house',42,false,now()),
  ('HD-43','2026','state_house',43,false,now()),
  ('HD-44','2026','state_house',44,false,now()),
  ('HD-45','2026','state_house',45,false,now()),
  ('HD-46','2026','state_house',46,false,now()),
  ('HD-47','2026','state_house',47,false,now()),
  ('HD-48','2026','state_house',48,false,now()),
  ('HD-49','2026','state_house',49,false,now()),
  ('HD-50','2026','state_house',50,false,now()),
  ('HD-51','2026','state_house',51,false,now()),
  ('HD-52','2026','state_house',52,false,now()),
  ('HD-53','2026','state_house',53,false,now()),
  ('HD-54','2026','state_house',54,false,now()),
  ('HD-55','2026','state_house',55,false,now()),
  ('HD-56','2026','state_house',56,false,now()),
  ('HD-57','2026','state_house',57,false,now()),
  ('HD-58','2026','state_house',58,false,now()),
  ('HD-59','2026','state_house',59,false,now()),
  ('HD-60','2026','state_house',60,false,now()),
  ('HD-61','2026','state_house',61,false,now()),
  ('HD-62','2026','state_house',62,false,now()),
  ('HD-63','2026','state_house',63,false,now()),
  ('HD-64','2026','state_house',64,false,now()),
  ('HD-65','2026','state_house',65,false,now()),
  ('HD-66','2026','state_house',66,false,now()),
  ('HD-67','2026','state_house',67,false,now()),
  ('HD-68','2026','state_house',68,false,now()),
  ('HD-69','2026','state_house',69,false,now()),
  ('HD-70','2026','state_house',70,false,now()),
  ('HD-71','2026','state_house',71,false,now()),
  ('HD-72','2026','state_house',72,false,now()),
  ('HD-73','2026','state_house',73,false,now()),
  ('HD-74','2026','state_house',74,false,now()),
  ('HD-75','2026','state_house',75,false,now()),
  ('HD-76','2026','state_house',76,false,now()),
  ('HD-77','2026','state_house',77,false,now()),
  ('HD-78','2026','state_house',78,false,now()),
  ('HD-79','2026','state_house',79,false,now()),
  ('HD-80','2026','state_house',80,false,now()),
  ('HD-81','2026','state_house',81,false,now()),
  ('HD-82','2026','state_house',82,false,now()),
  ('HD-83','2026','state_house',83,false,now()),
  ('HD-84','2026','state_house',84,false,now()),
  ('HD-85','2026','state_house',85,false,now()),
  ('HD-86','2026','state_house',86,false,now()),
  ('HD-87','2026','state_house',87,false,now()),
  ('HD-88','2026','state_house',88,false,now()),
  ('HD-89','2026','state_house',89,false,now()),
  ('HD-90','2026','state_house',90,false,now()),
  ('HD-91','2026','state_house',91,false,now()),
  ('HD-92','2026','state_house',92,false,now()),
  ('HD-93','2026','state_house',93,false,now()),
  ('HD-94','2026','state_house',94,false,now()),
  ('HD-95','2026','state_house',95,false,now()),
  ('HD-96','2026','state_house',96,false,now()),
  ('HD-97','2026','state_house',97,false,now()),
  ('HD-98','2026','state_house',98,false,now()),
  ('HD-99','2026','state_house',99,false,now()),
  ('HD-100','2026','state_house',100,false,now()),
  ('HD-101','2026','state_house',101,false,now()),
  ('HD-102','2026','state_house',102,false,now()),
  ('HD-103','2026','state_house',103,false,now()),
  ('HD-104','2026','state_house',104,false,now()),
  ('HD-105','2026','state_house',105,false,now()),
  ('HD-106','2026','state_house',106,false,now()),
  ('HD-107','2026','state_house',107,false,now()),
  ('HD-108','2026','state_house',108,false,now()),
  ('HD-109','2026','state_house',109,false,now()),
  ('HD-110','2026','state_house',110,false,now()),
  ('HD-111','2026','state_house',111,false,now()),
  ('HD-112','2026','state_house',112,false,now()),
  ('HD-113','2026','state_house',113,false,now()),
  ('HD-114','2026','state_house',114,false,now()),
  ('HD-115','2026','state_house',115,false,now()),
  ('HD-116','2026','state_house',116,false,now()),
  ('HD-117','2026','state_house',117,false,now()),
  ('HD-118','2026','state_house',118,false,now()),
  ('HD-119','2026','state_house',119,false,now()),
  ('HD-120','2026','state_house',120,false,now()),
  ('SD-01','2026','state_senate',1,false,now()),
  ('SD-02','2026','state_senate',2,false,now()),
  ('SD-03','2026','state_senate',3,false,now()),
  ('SD-04','2026','state_senate',4,false,now()),
  ('SD-05','2026','state_senate',5,false,now()),
  ('SD-06','2026','state_senate',6,false,now()),
  ('SD-07','2026','state_senate',7,false,now()),
  ('SD-08','2026','state_senate',8,false,now()),
  ('SD-09','2026','state_senate',9,false,now()),
  ('SD-10','2026','state_senate',10,false,now()),
  ('SD-11','2026','state_senate',11,false,now()),
  ('SD-12','2026','state_senate',12,false,now()),
  ('SD-13','2026','state_senate',13,false,now()),
  ('SD-14','2026','state_senate',14,false,now()),
  ('SD-15','2026','state_senate',15,false,now()),
  ('SD-16','2026','state_senate',16,false,now()),
  ('SD-17','2026','state_senate',17,false,now()),
  ('SD-18','2026','state_senate',18,false,now()),
  ('SD-19','2026','state_senate',19,false,now()),
  ('SD-20','2026','state_senate',20,false,now()),
  ('SD-21','2026','state_senate',21,false,now()),
  ('SD-22','2026','state_senate',22,false,now()),
  ('SD-23','2026','state_senate',23,false,now()),
  ('SD-24','2026','state_senate',24,false,now()),
  ('SD-25','2026','state_senate',25,false,now()),
  ('SD-26','2026','state_senate',26,false,now()),
  ('SD-27','2026','state_senate',27,false,now()),
  ('SD-28','2026','state_senate',28,false,now()),
  ('SD-29','2026','state_senate',29,false,now()),
  ('SD-30','2026','state_senate',30,false,now()),
  ('SD-31','2026','state_senate',31,false,now()),
  ('SD-32','2026','state_senate',32,false,now()),
  ('SD-33','2026','state_senate',33,false,now()),
  ('SD-34','2026','state_senate',34,false,now()),
  ('SD-35','2026','state_senate',35,false,now()),
  ('SD-36','2026','state_senate',36,false,now()),
  ('SD-37','2026','state_senate',37,false,now()),
  ('SD-38','2026','state_senate',38,false,now()),
  ('SD-39','2026','state_senate',39,false,now()),
  ('SD-40','2026','state_senate',40,false,now()),
  ('SD-41','2026','state_senate',41,false,now()),
  ('SD-42','2026','state_senate',42,false,now()),
  ('SD-43','2026','state_senate',43,false,now()),
  ('SD-44','2026','state_senate',44,false,now()),
  ('SD-45','2026','state_senate',45,false,now()),
  ('SD-46','2026','state_senate',46,false,now()),
  ('SD-47','2026','state_senate',47,false,now()),
  ('SD-48','2026','state_senate',48,false,now()),
  ('SD-49','2026','state_senate',49,false,now()),
  ('SD-50','2026','state_senate',50,false,now()),
  ('NC-01','2026','us_house',1,false,now()),
  ('NC-02','2026','us_house',2,false,now()),
  ('NC-03','2026','us_house',3,false,now()),
  ('NC-04','2026','us_house',4,false,now()),
  ('NC-05','2026','us_house',5,false,now()),
  ('NC-06','2026','us_house',6,false,now()),
  ('NC-07','2026','us_house',7,false,now()),
  ('NC-08','2026','us_house',8,false,now()),
  ('NC-09','2026','us_house',9,false,now()),
  ('NC-10','2026','us_house',10,false,now()),
  ('NC-11','2026','us_house',11,false,now()),
  ('NC-12','2026','us_house',12,false,now()),
  ('NC-13','2026','us_house',13,false,now()),
  ('NC-14','2026','us_house',14,false,now()),
  ('NC-SEN','2026','us_senate',0,false,now())
on conflict (id) do update set race_type=excluded.race_type, district_number=excluded.district_number, cycle=excluded.cycle;
