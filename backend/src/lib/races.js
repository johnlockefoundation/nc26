import { db } from '../db.js';
import { CYCLE } from '../ingest/config.js';
import { CIVITAS_SOURCE_URL, SENATE_RACES_BY_ID } from '../ingest/config.js';
import { formatPollAdvantage, formatMarketAdvantage, formatMoney } from './format.js';

const RACE_TYPE_META = {
  us_house: { short: 'U.S. HOUSE', slug: 'us_house' },
  us_senate: { short: 'U.S. SENATE', slug: 'us_senate' },
  state_senate: { short: 'NC SENATE', slug: 'state_senate' },
  state_house: { short: 'NC HOUSE', slug: 'state_house' },
};

// Senate district ids are <STATE>-SEN, and the configured name is preferred;
// the suffix-stripped id is the fallback for a seat with no config entry yet.
export function senateStateName(districtId) {
  return SENATE_RACES_BY_ID.get(districtId)?.name || districtId.replace(/-SEN$/, '');
}

export function raceTitle(raceType, districtNumber, districtId) {
  if (raceType === 'us_senate') return `U.S. SENATE — ${senateStateName(districtId)}`;
  return `${RACE_TYPE_META[raceType]?.short || raceType} — DISTRICT ${districtNumber}`;
}

function candidateList(districtId, cycle) {
  return db.prepare(`SELECT candidate_id, name, party, incumbent, website, photo_url
    FROM candidates WHERE district_id = ? AND election_cycle = ?
    ORDER BY CASE party WHEN 'D' THEN 0 WHEN 'R' THEN 1 ELSE 2 END`).all(districtId, cycle);
}

function marginDelta(latestMargin, prevMargin) {
  if (latestMargin == null || prevMargin == null) return null;
  const d = latestMargin - prevMargin;
  if (Math.abs(d) < 0.05) return { party: 'EVEN', points: 0 };
  const party = d > 0 ? 'D' : 'R';
  return { party, points: +Math.abs(d).toFixed(1) };
}

function pollSummary(districtId, cycle) {
  const avg = db.prepare(`SELECT dem_average, rep_average, margin, n_polls, updated_at
    FROM polling_averages WHERE district_id = ? AND election_cycle = ?`).get(districtId, cycle);
  const latest = db.prepare(`SELECT source_url FROM polls
    WHERE district_id = ? AND election_cycle = ?
    ORDER BY end_date DESC LIMIT 1`).get(districtId, cycle);
  const recent = db.prepare(`SELECT margin FROM polls
    WHERE district_id = ? AND election_cycle = ?
    ORDER BY end_date DESC, poll_id DESC LIMIT 2`).all(districtId, cycle);
  const hasPolls = avg && avg.dem_average != null && avg.rep_average != null;
  return {
    available: Boolean(hasPolls),
    dem_average: hasPolls ? avg.dem_average : null,
    rep_average: hasPolls ? avg.rep_average : null,
    margin: hasPolls ? avg.margin : null,
    n_polls: avg ? avg.n_polls : 0,
    advantage: hasPolls ? formatPollAdvantage(avg.margin) : null,
    delta: recent.length >= 2 ? marginDelta(recent[0].margin, recent[1].margin) : null,
    updated_at: avg ? avg.updated_at : null,
    source_url: latest ? latest.source_url : null,
  };
}

// Signed change in a party spread (Dem - Rep, in cents) between two snapshots,
// or null if either side lacks a value for that quote series.
function spreadMove(curDem, curRep, prevDem, prevRep) {
  if (curDem == null || curRep == null || prevDem == null || prevRep == null) return null;
  return (curDem - curRep) * 100 - (prevDem - prevRep) * 100;
}

function marketWeeklyMove(districtId, cycle, provider = 'Kalshi') {
  const days = db.prepare(`SELECT as_of, dem_price, rep_price, dem_bid_price, rep_bid_price
    FROM market_snapshots
    WHERE district_id = ? AND election_cycle = ? AND provider = ?
    ORDER BY as_of DESC`).all(districtId, cycle, provider);
  if (days.length < 2) return null;
  const latest = days[0];
  const cutoff = new Date(`${latest.as_of}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const prev = days.find((r) => r.as_of <= cutoff.toISOString().slice(0, 10)) || days[days.length - 1];
  // A move can print in either the traded price or the live bid (a one-sided
  // sweep moves the last trade while the bid sits; a wide book lets the bid
  // collapse while the last trade goes stale). Use whichever side moved more.
  const moves = [
    spreadMove(latest.dem_price, latest.rep_price, prev.dem_price, prev.rep_price),
    spreadMove(latest.dem_bid_price, latest.rep_bid_price, prev.dem_bid_price, prev.rep_bid_price),
  ].filter((m) => m != null);
  if (!moves.length) return null;
  const move = moves.sort((a, b) => Math.abs(b) - Math.abs(a))[0];
  if (Math.abs(move) < 0.05) return { party: 'EVEN', points: 0 };
  return { party: move > 0 ? 'D' : 'R', points: +Math.abs(move).toFixed(1) };
}

// Kalshi is the only market venue, so there is nothing to disambiguate: the
// single most recent quote for the seat is the one to show.
function marketSummary(districtId, cycle) {
  const rows = db.prepare(`SELECT provider, dem_price, rep_price, advantage, updated_at, source_url, is_seed
    FROM markets WHERE district_id = ? AND election_cycle = ?
    ORDER BY updated_at DESC`).all(districtId, cycle);
  const m = rows[0];
  const has = m && m.dem_price != null && m.rep_price != null;
  return {
    available: Boolean(has),
    provider: m ? m.provider : null,
    dem_price: has ? m.dem_price : null,
    rep_price: has ? m.rep_price : null,
    advantage: has ? formatMarketAdvantage(m.advantage) : null,
    delta: marketWeeklyMove(districtId, cycle),
    updated_at: m ? m.updated_at : null,
    source_url: m ? m.source_url : null,
    is_seed: m ? Boolean(m.is_seed) : false,
  };
}

// Every quoted venue for a race. Kalshi is currently the only one, but
// rendering the list rather than a single venue means adding a second source
// later shows both instead of silently dropping one.
function marketList(districtId, cycle) {
  const rows = db.prepare(`SELECT provider, dem_price, rep_price, advantage, updated_at, source_url, is_seed
    FROM markets WHERE district_id = ? AND election_cycle = ?
      AND dem_price IS NOT NULL AND rep_price IS NOT NULL
    ORDER BY provider`).all(districtId, cycle);
  return rows.map((m) => ({
    available: true,
    provider: m.provider,
    dem_price: m.dem_price,
    rep_price: m.rep_price,
    advantage: formatMarketAdvantage(m.advantage),
    delta: marketWeeklyMove(districtId, cycle, m.provider),
    updated_at: m.updated_at,
    source_url: m.source_url,
    is_seed: Boolean(m.is_seed),
  }));
}

function moneySummary(districtId, cycle) {
  const f = db.prepare(`SELECT dem_amount, rep_amount, advantage, reporting_period, updated_at, source_url, source_method, is_seed
    FROM fundraising WHERE district_id = ? AND election_cycle = ?`).get(districtId, cycle);
  const has = f && (f.dem_amount != null || f.rep_amount != null);
  return {
    available: Boolean(has),
    dem_amount: has ? f.dem_amount : null,
    rep_amount: has ? f.rep_amount : null,
    advantage: has ? formatMoney(f.advantage) : null,
    reporting_period: f ? f.reporting_period : null,
    updated_at: f ? f.updated_at : null,
    source_url: f ? f.source_url : null,
    method: f ? f.source_method : null,
    is_seed: f ? Boolean(f.is_seed) : false,
  };
}

// Stories about one specific seat, for the list under CPI Info. Only rows that
// were tagged to this exact district qualify, so a district never shows
// statewide or other-seat coverage.
function districtNews(districtId, cycle, limit = 6) {
  return db.prepare(`SELECT article_id, district_id, headline, outlet, published_at, url, summary
    FROM news WHERE election_cycle = ? AND district_id = ? AND url <> ''
    ORDER BY published_at DESC LIMIT ?`).all(cycle, districtId, limit);
}

// Registration and ballot movement between two snapshots taken at the same
// point in each cycle. "Velocity" is the point: a raw count says how many
// voters there are, the change since the equivalent date last cycle says which
// way the seat is moving, and the party split says who is driving it.
function districtVitals(districtId, cycle) {
  const rows = db.prepare(`SELECT * FROM district_vitals
    WHERE district_id = ? AND election_cycle = ?
    ORDER BY snapshot_date ASC`).all(districtId, cycle);
  if (rows.length < 2) return null;
  const from = rows[0];
  const to = rows[rows.length - 1];
  if (from.snapshot_date === to.snapshot_date) return null;

  const delta = (a, b) => (a != null && b != null ? a - b : null);
  const regChange = {
    total: delta(to.registered_total, from.registered_total),
    dem: delta(to.registered_dem, from.registered_dem),
    rep: delta(to.registered_rep, from.registered_rep),
    unaff: delta(to.registered_unaff, from.registered_unaff),
  };
  // Ballot velocity is the change in requests by party between the two dated
  // snapshots -- the same point in each cycle, so the two are comparable. The
  // return rate is deliberately absent: how many mailed ballots came back is a
  // turnout mechanic, not a measure of which way a seat is moving.
  const reqChange = {
    dem: delta(to.ballots_req_dem, from.ballots_req_dem),
    rep: delta(to.ballots_req_rep, from.ballots_req_rep),
    unaff: delta(to.ballots_req_unaff, from.ballots_req_unaff),
  };
  const reqTotal = {
    dem: to.ballots_req_dem, rep: to.ballots_req_rep, unaff: to.ballots_req_unaff,
  };
  reqChange.total = (reqChange.dem || 0) + (reqChange.rep || 0) + (reqChange.unaff || 0);

  return {
    available: true,
    is_mock: rows.every((r) => Boolean(r.is_mock)),
    source: to.source || null,
    from: from.snapshot,
    to: to.snapshot,
    from_date: from.snapshot_date,
    to_date: to.snapshot_date,
    registration: {
      baseline: from.registered_total,
      current: to.registered_total,
      net: regChange.total,
      net_pct: regChange.total && from.registered_total
        ? +((regChange.total / from.registered_total) * 100).toFixed(2) : null,
      change: regChange,
    },
    ballot: {
      // The headline: requests on the later date minus the earlier one.
      net: reqChange.total,
      current_total: (reqTotal.dem || 0) + (reqTotal.rep || 0) + (reqTotal.unaff || 0),
      change: reqChange,
      by_party: reqTotal,
    },
  };
}

// Money for a state legislative race, shaped exactly like the federal
// fundraising summary: one advantage figure, not a per-candidate breakdown.
// MetricBlock renders both identically, which is the point.
function stateFunds(districtId, cycle) {
  const rows = db.prepare(`SELECT party, total_raised, reporting_period, source_url, is_mock
    FROM state_funds WHERE district_id = ? AND election_cycle = ?`).all(districtId, cycle);
  if (!rows.length) return null;
  const byParty = { D: 0, R: 0 };
  for (const r of rows) {
    if (r.party in byParty) byParty[r.party] += r.total_raised || 0;
  }
  return {
    available: true,
    // Surfaces in the UI: these are placeholders, not filings.
    is_mock: rows.every((r) => Boolean(r.is_mock)),
    dem_amount: Math.round(byParty.D),
    rep_amount: Math.round(byParty.R),
    advantage: formatMoney((byParty.D || 0) - (byParty.R || 0)),
    reporting_period: rows[0].reporting_period || null,
    source_url: rows[0].source_url || null,
  };
}


function districtRow(districtId, cycle) {
  return db.prepare(`SELECT * FROM districts WHERE district_id = ? AND election_cycle = ?`).get(districtId, cycle);
}

// The Civitas index is an NCGA instrument. It is published for General Assembly
// seats only, so it is exposed for state House/Senate races and withheld from
// US House/Senate ones. The congressional rows in the database carry a
// Council-of-State-derived stand-in, which is a baseline lean rather than a
// rating of the race -- shipping it under a Civitas heading would overstate what
// the number is, and a baseline lean is not what a federal seat is judged by
// here: those are carried by polling and money in Supabase.
function isNcgaRaceType(raceType) {
  return raceType === 'state_house' || raceType === 'state_senate';
}

// Civitas partisan index for a district: the signed party lean (e.g. "R+8"),
// its rating bucket (Safe / Likely / Lean / Toss-up) and whether the cycle
// designates the race as competitive. This is the primary in-play signal for
// state legislative races, which have no polling or market coverage.
function partisanSummary(row) {
  if (!isNcgaRaceType(row.race_type)) return { available: false };
  const m = /^([DR])\+(\d+)$/.exec(String(row.cpi_value || '').trim());
  const lean = m ? { party: m[1], value: +m[2] } : null;
  return {
    available: Boolean(lean),
    party: lean ? lean.party : null,
    value: lean ? lean.value : null,
    label: lean ? `${lean.party} +${lean.value}` : null,
    lean: row.partisan_lean || null,
    competitive: Boolean(row.competitive),
    source_url: CIVITAS_SOURCE_URL,
  };
}

export function getRaceSummary(row, cycle) {
  const polls = pollSummary(row.district_id, cycle);
  const markets = marketSummary(row.district_id, cycle);
  const market_list = marketList(row.district_id, cycle);
  const money = moneySummary(row.district_id, cycle);
  const candidates = candidateList(row.district_id, cycle);
  const partisan = partisanSummary(row);
  // Only genuinely in-play races get a movement arrow: within 10 points on
  // either a polling average or the market spread. The US Senate race is the
  // marquee statewide contest, so it always carries its arrow.
  const inPlay =
    row.race_type === 'us_senate' ||
    (polls.available && polls.margin != null && Math.abs(polls.margin) < 10) ||
    (markets.available && markets.dem_price != null && markets.rep_price != null &&
      Math.abs((markets.dem_price - markets.rep_price) * 100) < 10);
  if (!inPlay) markets.delta = null;
  const updatedCandidates = [polls.updated_at, markets.updated_at, money.updated_at].filter(Boolean).sort();
  return {
    district_id: row.district_id,
    race_type: row.race_type,
    district_number: row.district_number,
    election_cycle: row.election_cycle,
    title: raceTitle(row.race_type, row.district_number, row.district_id),
    competitive: Boolean(row.competitive),
    competitive_source: row.competitive_source,
    competitive_reason: row.competitive_reason,
    candidates,
    partisan,
    polls,
    markets,
    market_list,
    money,
    coverage: {
      polls: polls.available,
      markets: markets.available,
      money: money.available,
    },
    last_updated: updatedCandidates.length ? updatedCandidates[updatedCandidates.length - 1] : null,
  };
}

export function listRaces({ cycle = CYCLE, raceType = null, competitiveOnly = true } = {}) {
  let sql = `SELECT * FROM districts WHERE election_cycle = ?`;
  const params = [cycle];
  if (raceType) { sql += ` AND race_type = ?`; params.push(raceType); }
  if (competitiveOnly) sql += ` AND competitive = 1`;
// In-play districts first, so a client that opens on the first race lands on a
  // contested seat rather than whichever district happens to sort lowest. With
  // competitiveOnly off this is what keeps SD-01 or HD-1 from being the default.
  sql += ` ORDER BY competitive DESC, district_number, district_id`;
  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => getRaceSummary(r, cycle));
}

function profileFor(districtId, cycle, raceType) {
  const f = db.prepare(`SELECT median_age, median_income, bachelors_plus,
      race_white, race_black, race_hispanic, pres_margin, cpi, source
    FROM district_profiles WHERE district_id = ? AND election_cycle = ?`).get(districtId, cycle);
  if (!f) return null;
  return {
    scope: districtId.endsWith('-SEN') ? 'Statewide' : null,
    median_age: f.median_age,
    median_income: f.median_income,
    bachelors_plus: f.bachelors_plus,
    race: {
      white: f.race_white,
      black: f.race_black,
      hispanic: f.race_hispanic,
      other: f.race_white == null ? null : +Math.max(0, 100 - f.race_white - f.race_black - f.race_hispanic).toFixed(1),
    },
    pres_margin: f.pres_margin,
    // Profiles are a federal dataset today, so no profile in the tree is NCGA
    // and the key is dropped off every one of them rather than shipped null --
    // a profile should carry no Civitas vocabulary at all. An NCGA profile, if
    // one is ever added, keeps its index.
    ...(isNcgaRaceType(raceType) && f.cpi ? { cpi: f.cpi } : {}),
    // The source line is trimmed to match, rather than continuing to credit
    // "Civitas CPI" for a figure the profile no longer shows.
    source: f.source.replace(/\s*·\s*Civitas CPI\s*$/, ''),
  };
}

export function getRace(districtId, cycle = CYCLE) {
  const row = districtRow(districtId, cycle);
  if (!row) return null;
  const race = getRaceSummary(row, cycle);
  const polls = db.prepare(`SELECT poll_id, pollster, start_date, end_date, sample_size, population,
      dem_share, rep_share, margin, source_url, source, is_seed
    FROM polls WHERE district_id = ? AND election_cycle = ?
    ORDER BY end_date DESC`).all(districtId, cycle);
  race.poll_detail = polls;
  race.news = districtNews(districtId, cycle);
  race.profile = profileFor(districtId, cycle, row.race_type);
  // State-legislature only. Federal races keep the party-aggregate money
  // already in race.money and the congressional profile in race.profile.
  if (row.race_type === 'state_senate' || row.race_type === 'state_house') {
    race.state_funds = stateFunds(districtId, cycle);
    race.vitals = districtVitals(districtId, cycle);
  }
  return race;
}

export function getMapFeatures({ cycle = CYCLE, raceType } = {}) {
  // Every district the tracker covers, not only the ones in play. The General
  // Assembly maps carry all 50 senate and all 120 house districts so the map is
  // the whole state; which of them are competitive is a per-district flag the
  // client colours by, not a filter on what exists.
  const race = listRaces({ cycle, raceType, competitiveOnly: false });
  const features = db.prepare(`SELECT district_id, race_type, district_number, competitive, cpi_value,
      partisan_lean, partisan_party, geometry
    FROM districts WHERE election_cycle = ? AND race_type = ? ORDER BY district_number`)
    .all(cycle, raceType);
  const byId = new Map(race.map((r) => [r.district_id, r]));
  return {
    cycle,
    race_type: raceType,
    races: race,
    features: features.map((f) => {
      const r = byId.get(f.district_id);
      return {
        district_id: f.district_id,
        district_number: f.district_number,
        competitive: Boolean(f.competitive),
        // The full Civitas triple is NCGA-only. The map's lean label reads the
        // bucket to say "Likely" rather than calling everything safe, and that
        // vocabulary is General Assembly vocabulary -- a congressional seat has
        // no Civitas rating to report, so the keys are dropped rather than
        // nulled and the feature carries none of them.
        ...(isNcgaRaceType(raceType) ? {
          cpi: f.cpi_value || null,
          partisan_lean: f.partisan_lean || null,
          partisan_party: f.partisan_party || null,
        } : {}),
        geometry: JSON.parse(f.geometry),
        metrics: r ? {
          polls: r.polls.advantage,
          markets: r.markets.advantage,
          money: r.money.advantage,
          coverage: r.coverage,
        } : null,
      };
    }),
  };
}

// The ticker is a funnel for the two partner outlets only. Seat-level stories
// from other outlets appear in the per-district list instead, not here.
export function getTicker({ cycle = CYCLE, limit = 12 } = {}) {
  return db.prepare(`SELECT article_id, district_id, headline, outlet, url, published_at
    FROM news WHERE election_cycle = ? AND in_funnel = 1
    ORDER BY published_at DESC LIMIT ?`).all(cycle, limit);
}

export function getSourceStatus() {
  return db.prepare(`SELECT source, last_fetched, last_success, last_error, status, notes
    FROM ingest_meta ORDER BY source`).all();
}