-- `news` and `ticker_stories` split one job in two and neither was right.
--
-- `news` required a cycle and a race_id, carried topic/relevance_score that
-- nothing read, and had an in_funnel flag that ticker() ignored -- so a story
-- flagged in_funnel never reached the ticker, and the only symptom was a
-- ticker that was mysteriously short. `ticker_stories` was the table ticker()
-- actually read, so "put this in the ticker" and "show this on a race card"
-- meant writing to two different tables for one story.
--
-- public.stories replaces both. ticker() and map_payload() already read it;
-- these tables are unreferenced apart from the function below, and both were
-- empty, so nothing is lost.
--
-- Ordered deliberately: the function goes first, because it is the only thing
-- in the database that still names ticker_stories.
drop function if exists public.deactivate_ticker_story(uuid);

-- The updated_at trigger on ticker_stories goes with the table; stories has no
-- updated_at column and needs none, since a story's own published_at is the
-- timestamp the site sorts on.
drop table if exists public.ticker_stories;
drop table if exists public.news;
