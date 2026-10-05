# AGENTS.md

Instructions for coding agents working in this repository.

## Scope: the product reads an API, and that is the whole job

**This repository ships a WordPress plugin. The product's data comes from the
Supabase API. Work on the frontend, the plugin build, the migrations that define
the API's read functions, and the packaged artifact.**

**The WordPress plugin lives in this repository, not beside it.** `plugin/` is
the WordPress half and `frontend/` the Pages half; the plugin consumes the
frontend's built output rather than reshaping it, so the two cannot drift in
shape. `bash plugin/tools/build.sh` writes the installable zip to `dist/` and
verifies the extracted artifact, not the source tree. A separate public repo and
release page existed briefly and was folded back in: the payload is the
frontend's own output, so the two halves in one repository is what keeps them
honest.

**Non-API data ingestion is explicitly out of scope.** Do not read, fix,
refactor, extend, debug, or comment on any of the following, and do not offer to:

- `backend/src/ingest/` — the ingest pipeline modules
- `backend/scripts/fetch-*.mjs` — external fetchers that write `data/sources/*.json`
- `backend/data/seed/` — committed seed files
- `backend/data/sources/` — fetched drop files
- `npm run ingest`, `npm run fetch`, `npm run seed`
- `backend/ingest/news/`, `backend/ingest/polls/` — empty reserved folders

This is a standing decision, not a temporary one. It was made explicitly. If a
task appears to require touching ingestion, that is a signal the task is
misframed — raise it rather than working around it.

Two loaders are exceptions, in scope only for reading and repair rather than for
being extended into a pipeline. Both exist to remove hand-seeding and both write
to Supabase, not SQLite:

- `backend/scripts/fetch-kalshi.mjs` — see the Kalshi note below.
- `backend/scripts/load-polls.mjs` — fills `public.polls` from PollResults.org,
  which carries NYT polling data under CC BY 4.0 and replaced RealClearPolitics,
  a source with neither a free API nor a licence permitting redistribution. Run
  with `--apply` to push through `supabase db query --linked`, so no
  `service_role` key and no cron are involved. Two rules exist to protect data
  quality: a hand-verified topline is never loaded a second time, and nothing
  older than a recency floor enters the table, because `poll_summary` averages
  unweighted and unwindowed — volume alone would move the figure.

Concretely: **do not treat the local SQLite database as a source of truth, and do
not go looking for a data source to fix a number.** If a figure looks wrong, the
answer is not "seed it locally" and not "write a fetcher." The answer is that the
figure comes from Supabase and Supabase is missing data — which the page then
reports as pending. See "Pending versus inapplicable" below.

**The exception is Kalshi, and it is narrow.** Kalshi's public API returns 403 to
any request carrying an `Origin` header, so a browser cannot call it and some
server-side hop is unavoidable. `backend/scripts/fetch-kalshi.mjs` is therefore in
scope for reading and repair, because it is the only thing standing between the
public API and `public.markets`. It has been run to produce the repo-root
`kalshi-load.sql` and `kalshi-backfill.sql`, which a human runs in the Supabase
SQL editor; that is deliberate, since it avoids a cron and a `service_role` key in
CI. Prices for 15 federal races load that way, and snapshots for three of them
(NC-SEN, NC-01, NC-11) so the weekly-move arrow appears only where wanted. None of
this extends to the other fetchers, which remain out of scope.

The market arrow needs two snapshots a week apart. `market_weekly_move` returns
null below that, which is why the backfill pulls real daily closes from
`/markets/candlesticks` rather than inventing a baseline. Most congressional
contracts sit near 2c/95c and print a bid but no trade, so several races have no
usable history at all and correctly show no arrow.

The one narrow exception, because it is packaging rather than ingestion: the
exporters (`backend/scripts/export-reference.mjs`, `backend/scripts/export-static.mjs`)
read the local SQLite database to produce the static JSON the plugin bundles and
the Pages demo serves. Those two files are in scope. The pipeline that populates
SQLite is not.

## What the product is

A single-page tracker for North Carolina's 2026 elections, shipped two ways from
one frontend:

- **WordPress plugin** — a bundled reference layer of invariant facts, with live
  Supabase reads overlaid on top. Uploading the zip once is enough; new data
  arrives without a redeploy.
- **GitHub Pages demo** — static JSON plus the same live Supabase overlay.

Invariant data (candidate names, party, the Civitas lean, competitiveness,
districts, geometry, the Census demographic profile) is bundled. Everything a
person or a fetch changes on a schedule is read live.

## The rule that decides most design questions

**Anything a human can edit must never be frozen into a bundled file.** Polls,
markets, money, news, voter registration and ballot requests, and portraits are
all read live. The reasoning, once: a poll written to Supabase in March and
bundled into a plugin file in April renders as a live reading for as long as that
plugin is installed, with no timestamp on it.

The reverse trap is worse and this repo has shipped it: a *fabricated* figure
bundled into a versioned JSON file is indistinguishable from a real one once it
reaches a site. Registration and ballot figures were invented from the partisan
index and shipped to sixty seats. That is why the deploy workflow now fails if
any live key or `is_mock` marker reappears in a bundled export.

## Architecture worth knowing before you change it

### The reference layer is an invariant floor, not a cache

`VOLATILE_RACE_KEYS` in `backend/scripts/export-reference.mjs` lists what is
deliberately *absent* from the plugin bundle. Adding a key to that list means
"this must be read from Supabase." The frontend overlays each of them per-seat in
`frontend/src/api.js`.

**A key on that list with no read behind it is a bug, and this repo shipped two.**
`markets` and `money` were listed from `7230618` onward with no RPC ever added, so
congressional MONEY and every Kalshi widget rendered nothing on the plugin since
it was first packaged. Stripping a key and adding its read are the same change.
Before you add a key, check the matching RPC exists; before you add an RPC, check
nothing is rendering a bundled copy instead.

`profile` is deliberately **not** in that list. It is a genuine Census ACS
extract, genuinely fixed for the cycle, and bundling it is what lets the
DEMOGRAPHICS block render with no network. The distinction is verified-against-a-
real-extract, not how volatile the number looks.

### Overlays are additive and per-key. Never replace a bundle.

`overlayVolatile()` merges field by field and skips nulls. `overlayMap()` merges
by `district_id`. The overlays that must never be replaced wholesale:

- **candidates** — bundled names are the product's spine. An early live read that
  returned an empty candidates array blanked all 120 state House map labels. The
  Supabase `candidates` table is intentionally empty for this reason.
- **districts and features** — matched by id, never by array position, so a seat
  added on one side cannot shift every later row onto the wrong race.

A live read that returns nothing must leave the bundled record exactly as it
found it.

### Reads return a shape with `available: false`, never null

Every RPC in `supabase/migrations/` returns the full object with `available`
false when a seat has no data. Returning null leaves whatever the build bundled
on screen, which is the one outcome the design exists to prevent. This is a hard
constraint on the SQL: `select ... from <empty CTE>` yields zero rows and a
zero-row function returns SQL NULL, so the reads coalesce to the full
`available: false` object rather than selecting from the row CTE. Two of the
earliest functions got this wrong — `markets_summary` and `money_summary` both
returned null until they were rewritten.

Every read function filters `not is_mock` (`not is_seed` on markets and
fundraising, which use that older column name). `is_mock` is a load-time guard,
not a label — nothing sets it, but a half-finished extract must be dropped rather
than published.

### Pending versus inapplicable

A missing figure and an inapplicable widget are different facts, and rendering
them the same way was the bug. `RacePanel.jsx` now separates them per dataset:

- **Inapplicable — render nothing at all.** Markets and polls are federal-only.
  Kalshi lists no North Carolina state-legislature market and no state poll
  exists, so a "we are processing this" notice on a state seat would assert a
  pipeline that does not exist. `Demographics` is federal-only too: a Census
  profile is keyed to congressional boundaries, so only 15 seats have one.
- **Pending — render `PendingMetric`.** MONEY on every seat, and REGISTRATIONS
  and BALLOTS on General Assembly seats. These will exist for that seat; the
  rows are simply not loaded.

`PendingMetric` typesets the notice as an aside and deliberately does not take
`--metric-row`, so a pending line is shorter than a real figure and cannot be
mistaken for one. The wording is one fixed sentence for the same reason: five
variants of "coming soon" would each be read once and understood never.

**Do not convert a pending dataset into an inapplicable one.** Moving a widget
behind a chamber gate silences it, which reads as "nothing to report" rather than
"not yet". If a dataset is genuinely coming for a seat, it gets the notice.

### Portraits are a bucket, not a build

Uploading `<candidate_id>.jpg` into the `headshots` Supabase Storage bucket puts a
face on that seat for every site already running the plugin. No re-upload, no
redeploy. The filename stem must be exactly the `candidate_id`; the client matches
it against the candidate list it already holds rather than parsing it, so a
mis-named upload is a console warning instead of a portrait that silently never
appears. Bundled `photo_url` is the fallback when the bucket cannot be listed.
Attribution is recorded in `CREDITS.md`; anything added to the bucket belongs
there in the same change.

### Verifying: the build is not a test

`npm run build` passing means the artifact is well-formed. It does not mean the
site works — a bundler never executes the code it emits, and this repo has shipped
a blank page through three green checks. `OPEN_QUESTIONS.md` has the details and
the cheapest fix.

Data-shape and artifact claims can be verified here. Anything that runs in a
browser cannot. Say which one you did.

## Repo layout

| Path | Purpose |
|---|---|
| `frontend/src/api.js` | All data access. Bundled reads, live overlays, the portrait bucket. |
| `frontend/src/components/` | `RacePanel`, `NCMap`, `PollBlock`, `MoneyBlock`, `VoterVelocity`, `Demographics`, `CollapsibleMetric`, `PendingMetric` |
| `backend/scripts/export-reference.mjs` | Plugin bundle export; owns `VOLATILE_RACE_KEYS` |
| `backend/scripts/export-static.mjs` | Pages demo export; strips the same keys |
| `backend/src/lib/races.js` | Payload builders for the SQLite/demo path. Supabase RPCs mirror these shapes exactly. |
| `supabase/migrations/` | Postgres schema, RLS, and the read functions the client calls |
| `backend/src/schema.sql` | SQLite schema (local/demo only) |
| `plugin/` | The WordPress half: PHP wrapper, templates, tests, and `tools/build.sh` |
| `dist/carolina-election-map.zip` | The installable plugin, built by `bash plugin/tools/build.sh` |
| `.github/workflows/deploy.yml` | Pages deploy, including the no-bundled-live-data guard |

## Build and verify

```bash
npm run build          -w frontend   # generic
npm run build:pages    -w frontend   # Pages demo (exports demo-data first)
npm run build:plugin   -w frontend   # plugin bundle (exports reference first)
```

A Postgres 16 is available locally via Homebrew and is worth using to test a
migration before shipping it — including the empty-seat and mock-only cases. A
migration that is only ever applied to a live project is a migration that has
never been tested.

## Conventions

- Comments explain *why*, especially why something that looks wrong is
  deliberate. Match the surrounding density rather than adding noise.
- Comment blocks and data contracts are load-bearing in this repo: several
  encode a decision that would otherwise be silently reverted by the next
  person. When you change behaviour, update the comment that describes it.
- Never commit secrets. The Supabase anon key is intentionally committed — it is
  a publishable identifier, RLS is SELECT-only, and it grants nothing alone.
- Do not reset, overwrite, or commit unrelated working-tree changes. There is
  almost always uncommitted work in progress here; stage only what you touched.
