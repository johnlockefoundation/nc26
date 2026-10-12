#!/usr/bin/env python3
"""Standalone NCSBE campaign-finance summary downloader.

Downloads the Detailed Summary (CRO-1100, the export's `TP=SUM` section) of the
most recent Second Quarter disclosure report for every North Carolina General
Assembly candidate, so the figures can be reviewed without clicking through the
portal by hand.

This is a research tool that sits *outside* the product's data path. It does
not write to Supabase, it is not wired into any build or ingest script, and
nothing in the shipped plugin or Pages demo depends on it. See AGENTS.md in
this directory for why that boundary matters.

The roster is not hard-coded here: it is read from the parent repository's
generated reference layer (frontend/public/data/reference/map/), which is the
same invariant data the plugin bundles. Every General Assembly district is
covered -- all 50 Senate and 120 House seats, competitive or not. Regenerate the
reference layer with `npm run build:plugin -w frontend` from the repo root if it
is missing.

Nothing about the portal is documented, so every step below was reverse
engineered and is deliberately blunt: plain HTTP, a session cookie, an
antiforgery token, and JSON that the portal happens to embed in its HTML.
"""

from __future__ import annotations

import argparse
import csv
import html
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://cf.ncsbe.gov"

# Which map files hold the state legislative races. Every district is pulled,
# competitive or not. Federal races file with the FEC, not the NCSBE, so they
# are deliberately absent.
REFERENCE_MAPS = ("state_senate.json", "state_house.json")

# The product wants one figure per candidate: the Detailed Summary (CRO-1100,
# the `SUMMARY` section the export calls TP=SUM) of the most recent Second
# Quarter disclosure report. Quarterly reports -- not the semi-annual or
# organizational forms -- are the ones that carry the cycle-to-date totals.
TARGET_REPORT = "Second Quarter"


class Session:
    def __init__(self, delay: float = 0.3) -> None:
        self.delay = delay
        self._last = 0.0
        cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        self.op.addheaders = [
            ("User-Agent", "Mozilla/5.0 (compatible; ncsbe-summaries/1.0)"),
            ("Referer", BASE + "/CFOrgLkup/"),
        ]

    def _pace(self) -> None:
        wait = self.delay - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()

    def get(self, url: str, retries: int = 2) -> str:
        for attempt in range(retries + 1):
            self._pace()
            try:
                with self.op.open(url, timeout=60) as r:
                    return r.read().decode("utf-8", "replace")
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                if attempt == retries:
                    raise
                time.sleep(2 * (attempt + 1))

    def post(self, url: str, data: dict) -> str:
        self._pace()
        req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode())
        try:
            with self.op.open(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            # The search handler answers 302, and urllib raises before reading
            # the body. The redirect Location is the result page we want.
            loc = e.headers.get("Location")
            if not loc:
                raise
            return self.get(BASE + loc if loc.startswith("/") else loc)


def embedded_objects(page: str, marker: str) -> list[dict]:
    """Pull the JSON objects the portal embeds in its rendered HTML.

    The objects are flat (only string/number/null values), so a brace-bounded
    match is enough and avoids depending on whatever JS variable wraps them.
    """
    out = []
    for m in re.finditer(r"\{[^{}]*" + re.escape(marker) + r"[^{}]*\}", page):
        try:
            out.append(json.loads(html.unescape(m.group(0))))
        except json.JSONDecodeError:
            continue
    return out


def org_search(sess: Session, name: str) -> list[dict]:
    page = sess.get(BASE + "/CFOrgLkup/")
    tok = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', page)
    if not tok:
        raise RuntimeError("antiforgery token not found on /CFOrgLkup/")
    body = sess.post(
        BASE + "/CFOrgLkup/Index?handler=Search",
        {
            "__RequestVerificationToken": tok.group(1),
            "Filter.UseOrgName": "true",
            "Filter.UseCandName": "true",
            "Filter.UseInHouseName": "true",
            "Filter.UseAcronym": "false",
            "Filter.Name": name,
        },
    )
    return embedded_objects(body, '"OrgGroupID"')


def committee_filings(sess: Session, sboeid: str, ogid: str) -> list[dict]:
    """Every filing row for one committee.

    ogid is required: the same endpoint with sid alone returns zero rows, so
    the committee lookup above is what makes this call possible at all.
    """
    page = sess.get(
        BASE
        + "/CFOrgLkup/DocumentGeneralResult?sid="
        + urllib.parse.quote(sboeid)
        + "&ogid="
        + urllib.parse.quote(str(ogid))
    )
    rows = []
    for o in embedded_objects(page, '"DataLink"'):
        rows.append(
            {
                "doc": o.get("DocumentType", ""),
                "report": o.get("ReportType", ""),
                "amend": o.get("IsAmendment", ""),
                "year": o.get("ReportYear"),
                "period_start": o.get("PeriodStartDate", ""),
                "period_end": o.get("PeriodEndDate", ""),
                "dtype": o.get("DataType", ""),
                "rid": o.get("DataLink", ""),
            }
        )
    return rows


def export_summary(sess: Session, rid: str) -> str:
    return sess.get(
        BASE + f"/CFOrgLkup/ReportDetail?handler=Export&RID={urllib.parse.quote(str(rid))}&TP=SUM&sid=&cn="
    )


def tokens(name: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", name.lower()) if t]


def surname(name: str) -> str:
    parts = tokens(name)
    return parts[-1] if parts else ""


def _shared_prefix(a: str, b: str) -> int:
    k = 0
    for x, y in zip(a, b):
        if x != y:
            break
        k += 1
    return k


def name_token_match(a: set[str], b: set[str]) -> bool:
    """True when any token from each set shares a >=3-char prefix.

    The roster and the portal disagree on name forms ("Timothy" vs "TIM",
    "Samuel" vs "SAM"), so exact token equality is too strict for the
    fallback filter. A three-character prefix is enough to tie "tim" to
    "timothy" without linking unrelated names.
    """
    return any(_shared_prefix(x, y) >= 3 for x in a for y in b)


def load_roster(repo: str) -> tuple[int, list[dict]]:
    """Every North Carolina General Assembly candidate in the reference layer.

    Both chambers, competitive or not: all 50 Senate and 120 House districts.
    The list is read from the parent repository's generated reference layer, the
    same invariant data the plugin bundles, rather than hard-coded here.
    """
    mapdir = os.path.join(repo, "frontend", "public", "data", "reference", "map")
    cycle, candidates = None, []
    for fname in REFERENCE_MAPS:
        path = os.path.join(mapdir, fname)
        if not os.path.exists(path):
            sys.exit(
                f"missing {path}\n"
                "run `npm run build:plugin -w frontend` from the repo root first"
            )
        with open(path) as fh:
            data = json.load(fh)
        cycle = cycle or data.get("cycle")
        for race in data.get("races", []):
            for c in race.get("candidates", []):
                candidates.append(
                    {
                        "candidate_id": c["candidate_id"],
                        "name": c["name"],
                        "party": c.get("party", ""),
                        "district_id": race["district_id"],
                        "race_type": race["race_type"],
                    }
                )
    return int(cycle), candidates


def score_match(cand_name: str, org: str, cand: str) -> float:
    """Fraction of the roster name's tokens that appear in the portal record.

    Roster names are sometimes shorter than the legal name ("Donna McDowell
    White" vs "DONNA WHITE") and sometimes shorter than the ballot name
    ("Buck Newton" vs "E S \"BUCK\" NEWTON"), so we require the surname and
    then reward matching first/middle tokens rather than demanding equality.
    """
    wanted = set(tokens(cand_name))
    have = set(tokens(org)) | set(tokens(cand))
    if not wanted:
        return 0.0
    return len(wanted & have) / len(wanted)


def rank_key(cand: dict, com: dict, filings: list[dict]) -> tuple:
    """Sort key for choosing between committees that all carry the surname.

    A candidate's name alone is not unique enough: the portal returns legal
    names ("MICHAEL LEE MCIVER" matches a search for "Michael Lee"), municipal
    committees, and legal-expense funds. The strongest signal is the SBoEID
    prefix -- state campaign committees are "STA-" while county and municipal
    ones are not -- so it ranks above the token score. Smaller tuples win.
    """
    org = com.get("OrgName") or ""
    orgtokens = set(tokens(org))
    district_num = re.sub(r"\D", "", cand.get("district_id", ""))
    latest = max((iso_date(f["period_end"]) for f in filings), default="")
    latest_num = int(latest.replace("-", "")) if latest else 0
    return (
        0 if str(com.get("SBoEID", "")).startswith("STA-") else 1,
        -score_match(cand["name"], org, com.get("CandName") or ""),
        1 if "LEGAL" in org.upper() else 0,
        0 if district_num and district_num in orgtokens else 1,
        -len(filings),
        -latest_num,
    )


def resolve(sess: Session, cand: dict, cycle: int) -> dict:
    """Match one roster candidate to one committee with cycle filings.

    The portal matches the search string as an ordered run of tokens against
    its own ordering of the legal name, so a roster name carrying a middle
    name the portal stores elsewhere ("Amy Taylor North") can return nothing
    while its trailing tokens ("Taylor North") hit. Try progressively shorter
    token suffixes. For those fallbacks the surname alone over-matches (there
    are hundreds of "North Carolina" committees), so require a second name
    token too; the full-name term keeps the looser surname-only filter.
    """
    toks = tokens(cand["name"])
    sur = surname(cand["name"])
    other = set(toks) - {sur} if sur else set(toks)
    terms = [" ".join(toks[i:]) for i in range(len(toks))] or [cand["name"]]

    scored = []
    for idx, term in enumerate(terms):
        results = org_search(sess, term)
        strict = idx > 0
        for com in results:
            sboeid = com.get("SBoEID")
            # Some embedded objects are not committees and carry a null SBoEID.
            if not isinstance(sboeid, str) or not sboeid:
                continue
            org = com.get("OrgName") or ""
            legal = com.get("CandName") or ""
            nametokens = set(tokens(org)) | set(tokens(legal))
            if sur and sur not in nametokens:
                continue
            if strict and not name_token_match(other, nametokens):
                continue
            filings = committee_filings(sess, sboeid, com["OrgGroupID"])
            disclosures = [
                f
                for f in filings
                if f["doc"] == "Disclosure Report"
                and f["report"] == TARGET_REPORT
                and f["dtype"] == "DATA"
                and f["year"] == cycle
                and f["rid"]
            ]
            if not disclosures:
                continue
            scored.append(
                {
                    "com": com,
                    "filings": disclosures,
                    "key": rank_key(cand, com, disclosures),
                }
            )
        if scored:
            break

    if not scored:
        return {
            "candidate": cand,
            "status": "unmatched",
            "reason": "no committee with a downloadable " + TARGET_REPORT + " summary",
        }

    scored.sort(key=lambda x: x["key"])
    if len(scored) > 1 and scored[0]["key"] == scored[1]["key"]:
        return {
            "candidate": cand,
            "status": "ambiguous",
            "reason": "committees tie on every signal: "
            + "; ".join(
                s["com"].get("OrgName", "")
                for s in scored
                if s["key"] == scored[0]["key"]
            ),
        }
    best = scored[0]
    return {"candidate": cand, "status": "ok", "com": best["com"], "filings": best["filings"]}


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def iso_date(mm_dd_yyyy: str) -> str:
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", mm_dd_yyyy or "")
    return f"{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else "undated"


# Sequence numbers in the portal's summary CSV whose Cycle column (the
# cycle-to-date basis the product uses) becomes the state_funds figure.
# Contributions and small_donors are counts the summary does not carry, so they
# stay null rather than being back-filled from a dollar amount.
SUMMARY_FIELDS = {"60": "total_raised", "90": "total_spent", "95": "cash_on_hand"}


def parse_summary(path: str) -> dict:
    """Pull the cycle-to-date totals out of one downloaded summary CSV.

    The export is a sectioned CSV: a `"SUMMARY"` line, a
    `Sequence,Section,Period,Cycle` header, then numbered rows. The `Cycle`
    column is the running cycle total; `Period` is just that reporting period.
    """
    out = {}
    with open(path, newline="") as fh:
        lines = fh.read().splitlines()
    for line in lines[2:]:
        if not line.strip():
            continue
        parts = next(csv.reader([line]))
        if len(parts) < 4:
            continue
        field = SUMMARY_FIELDS.get(parts[0].strip())
        if field:
            out[field] = parts[3].strip()
    return out


def headline_filing(rows: list[dict]) -> dict:
    """The filing whose figures get published for a candidate.

    Newest period wins; within a period an amendment supersedes the original
    (it is the corrected record). RID is the final tiebreak, so two amendments
    of the same period resolve deterministically instead of by dict order.
    """
    return max(
        rows,
        key=lambda r: (
            iso_date(r["period_end"]),
            1 if r["amend"] == "Y" else 0,
            int(r["rid"] or 0),
        ),
    )


def sql_literal(text: str) -> str:
    return "'" + str(text).replace("'", "''") + "'"


# The human-facing page for a filing: the portal's "Report Sections" view, which
# lists the Detailed Summary, Detailed Receipts and Detailed Expenditures for the
# report id. `rid` alone resolves it (verified: sid and cn are optional). This is
# the link a reader follows to check a figure, so state_funds.source_url carries
# it rather than the CSV export the tool downloaded from, which is machine-only.
SOURCE_URL = "https://cf.ncsbe.gov/CFOrgLkup/ReportSection?rid={rid}"


def build_records(manifest_path: str, cycle) -> tuple[list[dict], list[str]]:
    """One row per candidate from the downloads, with provenance.

    Both the SQL loader and the review workbook are views of this one list, so
    they cannot drift. A candidate whose summary cannot be parsed is returned in
    the second value rather than silently dropped.
    """
    with open(manifest_path, newline="") as fh:
        rows = list(csv.DictReader(fh))
    if cycle is None:
        cycle = max((int(r["report_year"]) for r in rows if r.get("report_year")), default=2026)

    by_candidate: dict[str, list[dict]] = {}
    for r in rows:
        by_candidate.setdefault(r["candidate_id"], []).append(r)

    records, missing = [], []
    for cid, group in sorted(by_candidate.items()):
        head = headline_filing(group)
        figures = parse_summary(os.path.join(os.path.dirname(manifest_path), head["file"]))
        if not figures:
            missing.append(cid)
            continue
        records.append(
            {
                "candidate_id": cid,
                "race_id": head["race_id"],
                "cycle": str(cycle),
                "candidate_name": head["candidate_name"],
                "party": head["party"],
                "total_raised": figures.get("total_raised", "null"),
                "total_spent": figures.get("total_spent", "null"),
                "cash_on_hand": figures.get("cash_on_hand", "null"),
                "contributions": None,
                "small_donors": None,
                "reporting_period": "Through " + iso_date(head["period_end"]),
                "source_url": SOURCE_URL.format(rid=head["rid"]),
                "sboeid": head["sboeid"],
                "org_name": head["org_name"],
                "report": head["report"],
                "amend": head["amend"],
                "rid": head["rid"],
            }
        )
    return records, missing


def write_load_sql(records: list[dict], out_path: str) -> None:
    """Write an idempotent upsert for public.state_funds from the downloads.

    This is the whole reason the tool stops at a file: it never connects to
    Supabase. A human runs the SQL in the SQL editor, the same path the federal
    money uses in fundraising-load.sql.
    """
    lines = [
        "-- Load real NCSBE campaign-finance totals for the North Carolina",
        "-- General Assembly races into public.state_funds.",
        "--",
        "-- Generated by fundraising/ncsbe_summaries.py --sql from the summaries it",
        "-- downloaded; do not hand-edit. Re-run the tool and regenerate this file",
        "-- when the portal refreshes. Run in the Supabase SQL editor. Idempotent:",
        "-- re-run to refresh. Basis is cycle-to-date (the summary's Cycle column),",
        "-- and where a period has both an original and an amendment the amendment",
        "-- supersedes it.",
        "--",
        "-- contributions and small_donors are left null: the summary reports",
        "-- dollars, not donation counts, and a guess would be a fabricated figure.",
        "begin;",
        "",
        "insert into public.state_funds",
        "  (candidate_id, race_id, cycle, candidate_name, party, total_raised,",
        "   total_spent, cash_on_hand, reporting_period, source_url, is_mock) values",
    ]
    for i, r in enumerate(records):
        comma = "," if i < len(records) - 1 else ""
        lines.append(
            "  ("
            + ", ".join(
                [
                    sql_literal(r["candidate_id"]),
                    sql_literal(r["race_id"]),
                    sql_literal(r["cycle"]),
                    sql_literal(r["candidate_name"]),
                    sql_literal(r["party"]),
                    r["total_raised"],
                    r["total_spent"],
                    r["cash_on_hand"],
                    sql_literal(r["reporting_period"]),
                    sql_literal(r["source_url"]),
                    "false",
                ]
            )
            + ")" + comma
        )
    lines += [
        "on conflict (candidate_id) do update set",
        "  race_id = excluded.race_id, cycle = excluded.cycle,",
        "  candidate_name = excluded.candidate_name, party = excluded.party,",
        "  total_raised = excluded.total_raised, total_spent = excluded.total_spent,",
        "  cash_on_hand = excluded.cash_on_hand,",
        "  reporting_period = excluded.reporting_period,",
        "  source_url = excluded.source_url, is_mock = excluded.is_mock,",
        "  updated_at = now();",
        "",
        "commit;",
    ]

    with open(out_path, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"wrote {out_path} ({len(records)} candidates)")


# --- xlsx writer -----------------------------------------------------------
# A reviewable workbook in the same shape as public.state_funds, emitted from
# the same records as the SQL. Written with the standard library (zipfile + XML)
# so the tool keeps its no-dependency property; do not reach for openpyxl here.

_XLSX_HEADER = [
    "candidate_id", "race_id", "cycle", "candidate_name", "party",
    "total_raised", "total_spent", "cash_on_hand", "contributions",
    "small_donors", "reporting_period", "source_url", "is_mock",
    "sboeid", "org_name", "report", "amend", "rid",
]
_XLSX_KINDS = ["s", "s", "s", "s", "s", "n", "n", "n", "n", "n",
               "s", "s", "s", "s", "s", "s", "s", "s"]


def _col_letter(i: int) -> str:
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def _sheet_xml(header: list[str], rows: list[list], kinds: list[str] | None) -> str:
    out = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        "<sheetData>",
    ]
    head = "".join(
        f'<c r="{_col_letter(j)}1" t="inlineStr" s="1"><is><t>'
        f"{html.escape(str(h), quote=True)}</t></is></c>"
        for j, h in enumerate(header)
    )
    out.append(f'<row r="1">{head}</row>')
    for i, row in enumerate(rows, start=2):
        cells = []
        for j, v in enumerate(row):
            if v is None or v == "" or str(v).lower() == "null":
                continue
            ref = f"{_col_letter(j)}{i}"
            kind = kinds[j] if kinds else None
            if kind != "s":
                try:
                    float(str(v))
                    cells.append(f'<c r="{ref}"><v>{html.escape(str(v), quote=True)}</v></c>')
                    continue
                except ValueError:
                    pass
            cells.append(
                f'<c r="{ref}" t="inlineStr"><is><t>'
                f"{html.escape(str(v), quote=True)}</t></is></c>"
            )
        out.append(f'<row r="{i}">' + "".join(cells) + "</row>")
    out += ["</sheetData>", "</worksheet>"]
    return "".join(out)


def write_workbook(records: list[dict], out_dir: str, out_path: str) -> None:
    """A two-sheet review workbook: the loaded figures, and the pending seats."""
    import zipfile

    rows = [
        [r["candidate_id"], r["race_id"], r["cycle"], r["candidate_name"], r["party"],
         r["total_raised"], r["total_spent"], r["cash_on_hand"], r["contributions"],
         r["small_donors"], r["reporting_period"], r["source_url"], "false",
         r["sboeid"], r["org_name"], r["report"], r["amend"], r["rid"]]
        for r in records
    ]
    r_header = ["candidate_id", "race_id", "party", "candidate_name", "status", "reason"]
    r_rows, r_kinds = [], None
    review_path = os.path.join(out_dir, "review_needed.csv")
    if os.path.exists(review_path):
        with open(review_path, newline="") as fh:
            for x in csv.DictReader(fh):
                r_rows.append([
                    x.get("candidate_id"), x.get("district_id"), x.get("party"),
                    x.get("name"), x.get("status"), x.get("reason"),
                ])
        r_kinds = ["s"] * len(r_header)

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        "</Types>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        "<sheets>"
        '<sheet name="state_funds" sheetId="1" r:id="rId1"/>'
        '<sheet name="review_needed" sheetId="2" r:id="rId2"/>'
        "</sheets></workbook>"
    )
    wb_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="2"><fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill></fills>'
        '<borders count="1"><border/></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
        "</styleSheet>"
    )

    parts = {
        "[Content_Types].xml": content_types,
        "_rels/.rels": root_rels,
        "xl/workbook.xml": workbook,
        "xl/_rels/workbook.xml.rels": wb_rels,
        "xl/styles.xml": styles,
        "xl/worksheets/sheet1.xml": _sheet_xml(_XLSX_HEADER, rows, _XLSX_KINDS),
        "xl/worksheets/sheet2.xml": _sheet_xml(r_header, r_rows, r_kinds),
    }
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts.items():
            z.writestr(name, data)
    print(f"wrote {out_path} ({len(rows)} candidates, {len(r_rows)} pending)")


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", default=os.path.dirname(here), help="repo root holding frontend/public/data")
    ap.add_argument("--cycle", type=int, help="reporting cycle; defaults to the reference cycle")
    ap.add_argument("--out", default=os.path.join(here, "summaries"), help="output directory")
    ap.add_argument("--delay", type=float, default=0.3, help="seconds between HTTP requests")
    ap.add_argument("--only", action="append", default=[], help="candidate_id to run (repeatable)")
    ap.add_argument("--dry-run", action="store_true", help="resolve matches but download nothing")
    ap.add_argument(
        "--sql",
        nargs="?",
        const=os.path.join(os.path.dirname(here), "state-funds-load.sql"),
        help="emit a state_funds upsert SQL from the downloads and exit",
    )
    ap.add_argument(
        "--xlsx",
        nargs="?",
        const=os.path.join(os.path.dirname(here), "state-funds.xlsx"),
        help="emit a review workbook (.xlsx) from the downloads and exit",
    )
    args = ap.parse_args()

    if args.sql is not None or args.xlsx is not None:
        records, missing = build_records(os.path.join(args.out, "manifest.csv"), args.cycle)
        if args.sql is not None:
            write_load_sql(records, args.sql)
        # The workbook travels with the SQL: passing --sql alone still writes it,
        # next to the loader, so the two are never regenerated out of step.
        xlsx_out = args.xlsx
        if xlsx_out is None:
            xlsx_out = os.path.join(os.path.dirname(os.path.abspath(args.sql)), "state-funds.xlsx")
        write_workbook(records, args.out, xlsx_out)
        if missing:
            print(f"  skipped {len(missing)} with no parsable summary: {', '.join(missing)}")
        return

    cycle, candidates = load_roster(args.repo)
    cycle = args.cycle or cycle
    if args.only:
        candidates = [c for c in candidates if c["candidate_id"] in args.only]
    if not candidates:
        sys.exit("no candidates selected")

    os.makedirs(args.out, exist_ok=True)
    sess = Session(delay=args.delay)
    manifest, review = [], []

    for i, cand in enumerate(candidates, 1):
        print(f"[{i}/{len(candidates)}] {cand['candidate_id']:<16} {cand['name']}", flush=True)
        try:
            res = resolve(sess, cand, cycle)
        except Exception as e:  # network/parse hiccup: record, keep going
            review.append({**cand, "status": "error", "reason": str(e)})
            print(f"    error: {e}", flush=True)
            continue

        if res["status"] != "ok":
            review.append({**cand, "status": res["status"], "reason": res["reason"]})
            print(f"    {res['status']}: {res['reason']}", flush=True)
            continue

        com = res["com"]
        print(f"    -> {com.get('OrgName','')} [{com['SBoEID']}]", flush=True)
        if args.dry_run:
            for f in res["filings"]:
                print(f"       {f['period_end']} {f['report']} amend={f['amend']} rid={f['rid']}", flush=True)
            continue

        cdir = os.path.join(args.out, cand["candidate_id"])
        os.makedirs(cdir, exist_ok=True)
        # One file per candidate: the most recent Second Quarter report. A later
        # amendment to that period supersedes the original (headline_filing).
        for f in [headline_filing(res["filings"])]:
            draft = f"{iso_date(f['period_end'])}_{slug(f['report']) or 'report'}_{'amendment' if f['amend']=='Y' else 'original'}.csv"
            path = os.path.join(cdir, draft)
            if os.path.exists(path):
                path = os.path.join(cdir, f"{f['rid']}_{draft}")
            with open(path, "w") as fh:
                fh.write(export_summary(sess, f["rid"]))
            manifest.append(
                {
                    "candidate_id": cand["candidate_id"],
                    "race_id": cand["district_id"],
                    "party": cand["party"],
                    "candidate_name": cand["name"],
                    "sboeid": com["SBoEID"],
                    "org_group_id": com["OrgGroupID"],
                    "org_name": com.get("OrgName", ""),
                    "cand_name": com.get("CandName", ""),
                    "report": f["report"],
                    "amend": f["amend"],
                    "period_start": f["period_start"],
                    "period_end": f["period_end"],
                    "report_year": f["year"],
                    "rid": f["rid"],
                    "file": os.path.relpath(path, args.out),
                }
            )
            print(f"       {os.path.relpath(path, args.out)}", flush=True)

    if manifest:
        write_csv(os.path.join(args.out, "manifest.csv"), manifest)
        print(f"\nmanifest: {len(manifest)} files across {len({m['candidate_id'] for m in manifest})} candidates")
    if review:
        write_csv(os.path.join(args.out, "review_needed.csv"), review)
        print(f"review_needed: {len(review)} candidates")
        for r in review:
            print(f"    {r['candidate_id']:<16} {r['name']:<24} {r['reason']}")


def write_csv(path: str, rows: list[dict]) -> None:
    import csv

    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    main()
