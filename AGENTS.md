# AGENTS.md

Instructions for coding agents working in this repository.

## Scope: the product reads an API, and that is the whole job

**This repository ships a WordPress plugin. The product's data comes from the
Supabase API. Work on the frontend, the plugin build, the migrations that define
the API's read functions, and the packaged artifact.**

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

Concretely: **do not treat the local SQLite database as a source of truth, and do
not go looking for a data source to fix a number.** If a figure looks wrong, the
answer is not "seed it locally" and not "write a fetcher." The answer is either
that the figure comes from Supabase and Supabase is missing data, or that the
widget correctly renders nothing because there is no data for that seat. A widget
with no data is a valid, intended state.

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
on screen, which is the one outcome the design exists to prevent. The widgets
(`PollBlock`, `MoneyBlock`, `VoterVelocity`, `Demographics`) each return null
themselves when their summary is unavailable, so a seat with no data renders no
box.

Every read function filters `not is_mock`. `is_mock` is a load-time guard, not a
label — nothing sets it, but a half-finished extract must be dropped rather than
published.

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
| `frontend/src/components/` | `RacePanel`, `NCMap`, `PollBlock`, `MoneyBlock`, `VoterVelocity`, `Demographics`, `CollapsibleMetric` |
| `backend/scripts/export-reference.mjs` | Plugin bundle export; owns `VOLATILE_RACE_KEYS` |
| `backend/scripts/export-static.mjs` | Pages demo export; strips the same keys |
| `backend/src/lib/races.js` | Payload builders for the SQLite/demo path. Supabase RPCs mirror these shapes exactly. |
| `supabase/migrations/` | Postgres schema, RLS, and the read functions the client calls |
| `backend/src/schema.sql` | SQLite schema (local/demo only) |
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
