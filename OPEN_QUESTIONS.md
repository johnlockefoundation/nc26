# Open questions

Parked decisions and known-unknowns. Nothing here is committed to; it is what we
agreed to come back to.

## Does the map colour update when the data changes?

**Status: open, deliberately not started.**

The question worth asking is not "can we recolour the map" — it is *how
promptly a poll landing in Supabase should change what a reader is looking at.*

Today it does not update at all. The client fetches once on mount, so a poll
written to `polls` in Supabase is invisible until someone reloads. The plugin
adds a second layer: it reads the same read-only endpoints, so the WordPress
page behaves the same way, and the bundled snapshot only takes over when a read
fails.

Things that decide the answer, once we want one:

- **Interval or push.** Re-polling the endpoint every N seconds is trivial and
  needs no new infrastructure. Supabase Realtime would push a row change
  straight to open tabs, but it hands the anon key a live subscription to the
  elections tables, which is a wider door than a read-only REST call and needs a
  deliberate decision about who may subscribe to what.
- **What actually moves a colour.** A district's fill comes from
  `primarySignal()`, which ranks polls over markets over money over the Civitas
  partisan lean (`frontend/src/lib/colors.js`). So a poll landing can flip a
  district's party, not just its shade. If colours move live, a reader watching
  a map should be able to see *why* it moved, or it reads as an error.
- **Whether live movement is even wanted.** A map that repaints under the reader
  is harder to screenshot, cite and argue about. There is a real case for a
  timestamped snapshot instead — "as of 14:20" — and a real case for live.
  That is an editorial decision, not a technical one.

Related, and worth settling in the same conversation:

- **U.S. House has only one colour level.** All 14 districts are hardcoded
  competitive in `backend/src/ingest/config.js`, so the dull branch is
  unreachable and the map reads flat. The General Assembly maps get both levels
  (22/120 and 7/50). Applying the existing GA rule literally would mark *zero*
  House districts in-play, because the Civitas buckets for the congressional
  districts contain no Toss-up and no Lean.
- **On the House map the two levels come from different sources**, which is why
  it cannot simply be copied across. Bright is driven by polls or markets; dull
  is driven by the Civitas lean. Those disagree: NC-01 (index R+8) and NC-11
  (index R+15) currently render **blue**, because a single poll outranks the
  index. On the GA maps this cannot happen, because all 29 in-play races are
  partisan-only and both levels land on the same hue by construction.
- **A poll outranking the index is sometimes right and sometimes wrong.** For a
  genuinely close race the poll is the better read. For NC-11 at R+15 it is not,
  and no threshold currently distinguishes the two.

## The build cannot see a runtime throw

`d91f92d` fixed a blank page I shipped in `9674bdd`: `new URL(rel, BASE_URL)`
throws for every base value Pages supplies, and because it ran inside render
React unmounted the entire app. No partial page, no visible error.

The build was green the whole time. It is green for the *broken* version and for
the fixed one alike, because a bundler never executes the code it emits, and
nothing else in this repo does either. Three separate checks in the plugin build
all passed while the site was down.

So the honest state is that the only verification available here covers syntax,
data shape, artifact contents and rendered markup -- not behaviour. Anything that
runs in a browser is unverified, and that is a much larger surface than it
sounds: render paths, the Leaflet lifecycle, fetches, and anything touching
`window`.

What would actually close it, cheapest first:

- **A headless smoke test that renders `App` and asserts the header exists.**
  Catches this class outright. Needs jsdom and a few fetch stubs; there is no
  test runner in the repo yet, so this is also the thing that would justify one.
- **Load the built pages bundle in jsdom once and fail on any console error.**
  Broader, catches Leaflet and the data paths too, and does not need a runner.
- **A staging WordPress page.** The plugin's own `tools/build.sh` is thorough,
  but it verifies the *artifact*, never the rendered page. Nobody has yet put
  this in front of a browser.

Until at least the first of those exists, "the build is green" should be read as
"the artifact is well-formed", not as "the site works".
