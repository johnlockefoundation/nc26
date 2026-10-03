-- Let an anon client LIST the headshots bucket.
--
-- Marking the bucket public is enough to download an object -- the
-- /object/public/ path skips RLS -- but the list endpoint does not. A plugin
-- reading its portraits live has to enumerate the bucket to learn which
-- candidates have one, and anon gets `[]` without this policy even though the
-- same objects download fine.
--
-- This is what makes the plugin deployable while incomplete: a portrait added
-- to the bucket shows up on a site running an already-installed plugin, with no
-- re-upload of the zip. Bundled photo_url stays the floor, so a client that
-- cannot list anything still renders.
--
-- Read-only, one bucket, same grant the bucket's own public flag already implies
-- for anyone who knows an object path. It exposes no more than the download URL
-- does; it only makes the set of paths enumerable.

create policy "anon list headshots"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'headshots');
