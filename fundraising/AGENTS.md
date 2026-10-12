# AGENTS.md — `fundraising/`

Instructions for agents working in this directory. It is a **standalone research
tool**, deliberately outside the product's data path. Read the root `AGENTS.md`
first; this file only adds the local boundary.

## What this is, and what it is not

This directory downloads, for each candidate the product already flags as
competitive, the **Detailed Summary** (form CRO-1100 — the section the portal's
report-sections page calls "Detailed Summary", served by the export as
`TP=SUM`) of that committee's most recent **Second Quarter** disclosure report.
It exists because the only other way to get those figures is to click through
`cf.ncsbe.gov` roughly sixty times.

It is **not** part of the plugin or the Pages demo. Nothing in the shipped
artifact reads anything here:

- It never connects to Supabase and defines no RPC. It can *emit* a
  `state_funds` upsert as SQL (`--sql`, see below), but a human runs that SQL;
  the tool holds no key and opens no socket to the database.
- It is not imported by any build, ingest, or CI step.
- It does not touch `frontend/`, `plugin/`, or `supabase/`.

The root `AGENTS.md` puts non-API data ingestion out of scope. That rule is
about the *product's* pipeline. This directory is the sanctioned exception for
North Carolina state money specifically, because state fundraising has no API:
the NCSBE portal is an ASP.NET/Kendo app whose only machine-readable surface is
the report-export endpoint the browser itself calls. Keep it a side tool. If a
change here would make the product depend on it, stop and raise it.

## The competitive list is not hard-coded

`ncsbe_summaries.py` reads the roster from the parent repo's generated
reference layer — the same invariant data the plugin bundles:

```
../frontend/public/data/reference/map/state_senate.json
../frontend/public/data/reference/map/state_house.json
```

It filters `competitive == true` and takes each race's candidates. As of the
2026 cycle that is 29 seats and 58 candidates (7 Senate, 22 House). Federal
races are absent on purpose: they file with the FEC, not the NCSBE, and their
money already loads through `supabase/migrations/` federal reads.

That reference tree is generated, not committed. Regenerate it from the repo
root before the first run (or after the Civitas competitiveness data changes):

```bash
npm run build:plugin -w frontend    # runs backend/scripts/export-reference.mjs
```

The tool exits with an instruction if the reference files are missing.

## Running it

```bash
python3 fundraising/ncsbe_summaries.py                 # all competitive candidates
python3 fundraising/ncsbe_summaries.py --dry-run        # resolve matches, download nothing
python3 fundraising/ncsbe_summaries.py --only SD-42_D_2026 --only SD-04_R_2026
```

Python 3 standard library only; no dependencies, no install.

| Flag | Meaning |
|---|---|
| `--repo PATH` | repo root holding `frontend/public/data` (default: parent of this dir) |
| `--cycle YYYY` | reporting cycle to pull (default: the reference cycle, 2026) |
| `--out DIR` | output directory (default: `fundraising/summaries/`) |
| `--delay SEC` | pause between HTTP requests (default: 0.3) |
| `--only ID` | restrict to one candidate_id (repeatable) |
| `--dry-run` | match and print, download nothing |
| `--sql PATH` | emit `state-funds-load.sql` from the downloads and exit (no network) |
| `--xlsx PATH` | emit `state-funds.xlsx` (review workbook) from the downloads and exit (no network) |

Be polite: the portal refreshes overnight on weeknights, so run it after that,
and leave `--delay` at its default or higher.

## Output

```
summaries/
  <candidate_id>/
    2026-06-30_second-quarter_<original|amendment>.csv
  manifest.csv         # one row per downloaded file, with its provenance
  review_needed.csv    # candidates with no downloadable Q2 summary, and why
```

One file per candidate: the most recent **Second Quarter** Detailed Summary.
A seat whose committee filed no Second Quarter report lands in
`review_needed.csv` rather than falling back to another period — an older year
is a different basis, not a substitute. As of the 2026 cycle that is 54 files
across 54 candidates; four have none (three paper filings with no `DataLink`,
one with only a First Quarter report).

Files are the portal's export **verbatim**. Each carries a `Period` and a
`Cycle` column; the product's chosen basis is **cycle-to-date** (the `Cycle`
column), which is what maps onto the `state_funds` schema.

`manifest.csv` records `sboeid`, `org_group_id`, `org_name`, `cand_name`,
`report`, `amend`, period bounds, `report_year`, and `rid` so any figure can be
traced back to a filing.

## How the portal is actually driven (reverse-engineered)

Nothing is documented, so this is the whole chain. It is deliberate and blunt;
do not "clean it up" into something that assumes a real API.

1. `GET /CFOrgLkup/` — grab the `__RequestVerificationToken` and session cookie.
2. `POST /CFOrgLkup/Index?handler=Search` — the search. It answers `302`, and
   `urllib` raises on the redirect before the body, so the `Location` header is
   read by hand.
3. `GET /CFOrgLkup/DocumentGeneralResult?sid=<SBoEID>&ogid=<OrgGroupID>` — the
   filing list. **`ogid` is required**; `sid` alone returns zero rows, which is
   why step 2 must run first. Each row's `DataLink` is the report id (`RID`).
4. `GET /CFOrgLkup/ReportDetail?handler=Export&RID=<RID>&TP=SUM&sid=&cn=` —
   the Detailed Summary CSV (the section the portal's report-sections page
   labels "Detailed Summary"; `TP=SUM` is what the export handler calls it).

Both results pages are HTML with flat JSON objects embedded in them;
`embedded_objects()` pulls them out by brace-bounded match rather than trusting
whatever JS variable wraps them.

### Gotchas that cost real debugging time

- **`STA-` prefix means state.** County and municipal committees use other
  prefixes (`DUR-`, `WAK-`, `NEW-`, …), and several candidates share a name with
  one (`Michael Lee` vs `COMMITTEE TO ELECT MIKE MCIVER`, whose legal name is
  literally "MICHAEL LEE MCIVER"). The state prefix is the decisive tie-breaker,
  ranked above the name score.
- **Name search matches ordered token runs.** The roster says "Amy Taylor
  North"; the portal stores "NORTH, AMY RENEE TAYLOR" and returns nothing for
  the full name but hits on "Taylor North". The resolver tries progressively
  shorter token suffixes; on those fallbacks it also requires a second name
  token, because a surname alone ("North") matches hundreds of committees.
- **Roster and portal disagree on name forms.** "Timothy" vs "TIM", "Samuel" vs
  "SAM". The fallback's token test accepts a shared three-character prefix.
- **Original vs. amendment.** A Quarter can have both an `amend=N` and an
  `amend=Y` filing with different ids. The amendment is the corrected record, so
  the tool keeps the single most recent Second Quarter filing and names it
  `<period>_second-quarter_<original|amendment>.csv` — an amended period yields
  the `_amendment` file and the original is not retained. `RID` breaks a tie
  between two amendments of the same period.
- **Some filings have no data.** A report can exist with `DataType` empty and a
  null `DataLink` (paper filing, or not yet processed). Those cannot be
  downloaded; the candidate lands in `review_needed.csv`. That is the correct
  outcome, not a bug — do not substitute an older year to "fill the gap".

## Getting the figures onto the site

The site reads state money live from `public.state_funds` through the
`state_funds_summary()` RPC, and `map_payload()` folds the same rows into the
map's money label. So "integrate" here means one thing: get rows into
`public.state_funds`.

`--sql` does that without the tool ever touching the database. It parses the
downloaded summaries and writes an idempotent upsert — `state-funds-load.sql`
at the repo root by default, mirroring the federal `fundraising-load.sql` — for
a human to run in the Supabase SQL editor:

```bash
python3 fundraising/ncsbe_summaries.py --sql     # writes ../state-funds-load.sql
```

`--sql` also writes a review workbook, `state-funds.xlsx`, beside it — the same
54 rows as a one-per-candidate sheet plus a `review_needed` sheet, for the
human-readable pass. It is a second view of one records list, so the two cannot
drift; `--xlsx` on its own emits just the workbook. The workbook is written with
the standard library (`zipfile` + XML), keeping the tool dependency-free.

Rules the emitter applies, and why:

- **Cycle-to-date is the basis.** Each summary carries a `Period` and a `Cycle`
  column; the `Cycle` column is the running total and is what the schema wants.
  Only `Total Receipts`, `Total Expenditures` and `Cash on Hand at End` are read.
- **Amendments supersede.** For the Second Quarter an `amend=Y` filing beats the
  `amend=N` one. `RID` breaks ties deterministically. This is why the SD-42
  figure here is `441657.04` and not the `441559.80` in the older hand-built
  `state_funds.csv`.
- **No fabricated fields.** `contributions` and `small_donors` are counts the
  summary does not carry, so they stay null rather than being back-filled from a
  dollar amount.
- **`source_url` is the filing, not the export.** It is the portal's
  report-sections page for that report id
  (`cf.ncsbe.gov/CFOrgLkup/ReportSection?rid=<RID>`, the page listing the
  Detailed Summary, Detailed Receipts and Detailed Expenditures), so a reader can
  open the exact filing a figure came from. `rid` alone resolves it. The
  `state_funds_summary()` read passes each party's `source_url` through to the
  MONEY block; without a row the block shows the pending notice rather than a
  dead link.

`state_funds.csv` was a staging file from the first manual pass. It is
superseded by `state-funds-load.sql` and kept only as the historical record of
those columns. Do not extend it.

Do not invent values for a seat with no downloadable filing. The seat renders
as pending, and an empty row is that state; a guessed number is not.

