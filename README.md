# Carolina Elections

> **Read [`AGENTS.md`](./AGENTS.md) before working in this repo.** It states the
> scope: this is a WordPress plugin that reads the Supabase API, and non-API data
> ingestion (`backend/src/ingest/`, `backend/data/seed/`, the `fetch-*.mjs`
> scripts, `npm run ingest`) is explicitly out of scope. Do not treat the local
> SQLite database as a source of truth or go looking for a data source to fix a
> figure.

A single-repo app for tracking North Carolina's 2026 elections (U.S. House, U.S. Senate, NC Senate, NC House). It runs as:
1. A static **Pages** site (GitHub Pages) that reads from local/demo data and can read live data from Supabase
2. A **WordPress plugin** that ships a bundled reference layer and overlays live Supabase data

The tracker is designed to show only what is verifiable: names and the Civitas lean are bundled; live signals (polls, markets, money, news) come from Supabase when available and are never frozen into the plugin build.

## What it shows
- Map of NC with districts colored by the strongest available signal (markets > polls > money > Civitas partisan lean) with an in-play threshold
- Per-race panels with candidates, competitive reason, polling (when present), prediction markets, fundraising, demographics, voter velocity, and district news
- Live ticker for news from the allowed outlets

## Repo layout
| Path | Purpose |
|---|---|
| `backend/` | API server (Express), schema, config |
| `backend/scripts/export-*.mjs` | The two exporters. In scope: they produce the JSON the plugin bundles and Pages serves. |
| `backend/scripts/fetch-*.mjs`, `backend/src/ingest/`, `backend/data/seed/` | Out of scope. See `AGENTS.md`. |
| `frontend/` | Vite React app (map + panels) |
| `frontend/src/components/` | React components (NCMap, RacePanel, PollBlock, MetricBlock, MoneyBlock, NewsList, etc.) |
| `frontend/src/lib/` | Data helpers (races, colors, map, format, candidateName) |
| `frontend/public/data/` | Bundled data: `reference/` (plugin static floor), `geo/` (district boundaries), `demo-data/` (Pages/demo) |
| `supabase/migrations/` | PostgreSQL schema + RPCs (read-only functions the client calls) |
| `.github/workflows/` | Deploys Pages to `johnlockefoundation.github.io/nc26` |

## Core policies
- **News coverage is restricted to in-house outlets only:** `backend/src/ingest/config.js` defines `NEWS_OUTLETS = ["John Locke Foundation", "Carolina Journal"]` and `ALLOWED_NEWS_OUTLETS` enforces this in both fetch and ingest. Other outlets are dropped.
- **Polling sources:** Average-only view across multiple pollsters. Carolina Journal poll appears individually only when present. When a CJ poll exists the UI renders an elongated `POLLING` block (average row + linked CJ figure); when no CJ poll exists it renders a single `POLLS` row via `MetricBlock`. Provenance/small-print lines are not shown under figures.
- **Signal priority (coloring and primary signal):** `markets > polls > money > partisan` (see `frontend/src/lib/colors.js::primarySignal`). A seat is in-play via the configured competitive rules per chamber.
- **Reference vs volatile split (plugin):** The plugin's reference export (`backend/scripts/export-reference.mjs`) bundles invariant facts (candidates, Civitas lean/rating, in-play designation, demographics/vitals fixed for cycle, plus geometry) and deliberately **does not** freeze polls/markets/money/news/coverage/last_updated. The frontend overlays volatile fields from Supabase when available.
- **Polling contract (live read):** `supabase/migrations/20261001170000_poll_summary_read.sql` defines `poll_summary()` (returns average fields, `span_start`, `span_end`, and `cj_poll`) and `poll_advantage()`. `backend/src/lib/races.js::pollSummary()` produces the same shape for SQLite/demo paths. `frontend/src/api.js::getRace` overlays it for every target that has a Supabase endpoint, which is now both the plugin and the Pages demo (`.env.pages` carries the endpoint too, so the public demo exercises the same live path).

## Environment & API
- Backend runs on Express (`backend/src/index.js`). Routes: `/api/health`, `/api/meta`, `/api/sources`, `/api/map`, `/api/races`, `/api/races/:districtId`, `/api/ticker`, `/api/outline`. Cycle: `2026`.
- Supabase project: `https://xbpimnerxjpwqnicwpec.supabase.co` (read-only RPCs via anon key). Migrations are applied with `supabase db push --linked`.
- Live read functions: `poll_summary`, `poll_advantage`, `state_funds_summary`, `money_advantage`, `vitals_summary`, `vitals_delta`, `map_payload`, `meta`, `ticker`. Each returns `available: false` for a seat with no data, never null.
- Portraits: the public `headshots` Storage bucket is the live source. Uploading `<candidate_id>.jpg` puts a face on that seat for every installed plugin with no redeploy. Bundled `photo_url` is the fallback. See `CREDITS.md`.

## Getting started
```bash
# Install deps (workspaces: backend, frontend)
npm ci

# Run backend API + frontend dev (concurrently)
npm run dev
# backend: http://localhost:3001
# frontend: http://localhost:5173

# Populating the local database is ingestion and is out of scope (see AGENTS.md).
# To export the static JSON, the database must already exist locally.
```

To write to Supabase, add a migration in `supabase/migrations/` and run
`supabase db push --linked`. Do not edit rows through any other path.

## Build targets
```bash
# Pages build (uses demo/static + VITE_BASE=/nc26/)
npm run build:pages -w frontend

# Plugin build (exports reference layer + Vite plugin mode)
npm run build:plugin -w frontend

# Generic frontend build
npm run build -w frontend
```

Pages deployment: `.github/workflows/deploy.yml` runs `npm run ingest`, then `build:pages`, and publishes `frontend/dist` to GitHub Pages. (The `ingest` step is what makes SQLite exist on a clean CI checkout; that is a packaging dependency on the exporters, not an invitation to work on the pipeline.)

## Data contracts (key)
- `pollSummary()` (`backend/src/lib/races.js`) → `{ available, dem_share, rep_share, margin, n_polls, span_start, span_end, advantage, updated_at, cj_poll }`. No `delta`, no average `source_url`. The individual `cj_poll` is the matching object from `pollDetail()` — `{ pollster, start_date, end_date, sample_size, population, dem_share, rep_share, margin, advantage, source_url }` — or `null`. `supabase/migrations/20261001170000_poll_summary_read.sql` returns the identical shape.
- `primarySignal()` (`frontend/src/lib/colors.js`) returns the strongest available signal: checks `markets.available` first, else `polls.available`, else `money.available`, else `partisan.available`.
- Candidate names use `frontend/src/lib/candidateName.js` (`nameParts`, `initials`, `surname`) for consistent rendering.
- Volatile keys stripped from both exports: `polls`, `poll_detail` (no longer produced), `markets`, `market_list`, `money`, `state_funds`, `vitals`, `news`, `coverage`, `last_updated`. All are read live per-seat from Supabase. `profile` alone remains bundled, because it is a genuine Census ACS extract rather than a placeholder.
- `.github/workflows/deploy.yml` fails the Pages deploy if any of those keys, or any `is_mock` marker, reappears in the bundled export. That guard replaced an older one which asserted the mock figures were *still present*, which had inverted the check into a requirement to keep them.

## Known untracked artifacts (deliberate to leave out)
The repo may contain untracked files like `instructions.md`, `backend/scripts/tmp-test-ticker.mjs`, or a screenshot PNG. They are not part of the build and should remain untracked unless needed.
