import { db } from '../db.js';
import { CYCLE } from '../ingest/config.js';
import { formatPollAdvantage, formatMarketAdvantage, formatMoney } from './format.js';

const RACE_TYPE_META = {
  us_house: { short: 'U.S. HOUSE', slug: 'us_house' },
  state_senate: { short: 'NC SENATE', slug: 'state_senate' },
  state_house: { short: 'NC HOUSE', slug: 'state_house' },
};

export function raceTitle(raceType, districtNumber) {
  return `${RACE_TYPE_META[raceType]?.short || raceType} — DISTRICT ${districtNumber}`;
}

function candidateList(districtId, cycle) {
  return db.prepare(`SELECT candidate_id, name, party, incumbent, website
    FROM candidates WHERE district_id = ? AND election_cycle = ?
    ORDER BY CASE party WHEN 'D' THEN 0 WHEN 'R' THEN 1 ELSE 2 END`).all(districtId, cycle);
}

function pollSummary(districtId, cycle) {
  const avg = db.prepare(`SELECT dem_average, rep_average, margin, n_polls, updated_at
    FROM polling_averages WHERE district_id = ? AND election_cycle = ?`).get(districtId, cycle);
  const hasPolls = avg && avg.dem_average != null && avg.rep_average != null;
  return {
    available: Boolean(hasPolls),
    dem_average: hasPolls ? avg.dem_average : null,
    rep_average: hasPolls ? avg.rep_average : null,
    margin: hasPolls ? avg.margin : null,
    n_polls: avg ? avg.n_polls : 0,
    advantage: hasPolls ? formatPollAdvantage(avg.margin) : null,
    updated_at: avg ? avg.updated_at : null,
  };
}

function marketSummary(districtId, cycle) {
  const rows = db.prepare(`SELECT provider, dem_price, rep_price, advantage, updated_at, source_url, is_seed
    FROM markets WHERE district_id = ? AND election_cycle = ? ORDER BY updated_at DESC`).all(districtId, cycle);
  const m = rows[0];
  const has = m && m.dem_price != null && m.rep_price != null;
  return {
    available: Boolean(has),
    provider: m ? m.provider : null,
    dem_price: has ? m.dem_price : null,
    rep_price: has ? m.rep_price : null,
    advantage: has ? formatMarketAdvantage(m.advantage) : null,
    updated_at: m ? m.updated_at : null,
    source_url: m ? m.source_url : null,
    is_seed: m ? Boolean(m.is_seed) : false,
  };
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

function newsFor(districtId, cycle, limit = 3) {
  return db.prepare(`SELECT article_id, headline, outlet, published_at, url, summary, relevance_score
    FROM news WHERE district_id = ? AND election_cycle = ?
    ORDER BY relevance_score DESC, published_at DESC LIMIT ?`).all(districtId, cycle, limit);
}

function districtRow(districtId, cycle) {
  return db.prepare(`SELECT * FROM districts WHERE district_id = ? AND election_cycle = ?`).get(districtId, cycle);
}

export function getRaceSummary(row, cycle, { includeNews = true } = {}) {
  const polls = pollSummary(row.district_id, cycle);
  const markets = marketSummary(row.district_id, cycle);
  const money = moneySummary(row.district_id, cycle);
  const candidates = candidateList(row.district_id, cycle);
  const updatedCandidates = [polls.updated_at, markets.updated_at, money.updated_at].filter(Boolean).sort();
  return {
    district_id: row.district_id,
    race_type: row.race_type,
    district_number: row.district_number,
    election_cycle: row.election_cycle,
    title: raceTitle(row.race_type, row.district_number),
    competitive: Boolean(row.competitive),
    competitive_source: row.competitive_source,
    competitive_reason: row.competitive_reason,
    candidates,
    polls,
    markets,
    money,
    news: includeNews ? newsFor(row.district_id, cycle, 3) : [],
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
  sql += ` ORDER BY race_type, district_number`;
  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => getRaceSummary(r, cycle));
}

export function getRace(districtId, cycle = CYCLE) {
  const row = districtRow(districtId, cycle);
  if (!row) return null;
  const race = getRaceSummary(row, cycle, { includeNews: false });
  const polls = db.prepare(`SELECT poll_id, pollster, start_date, end_date, sample_size, population,
      dem_share, rep_share, margin, source_url, source, is_seed
    FROM polls WHERE district_id = ? AND election_cycle = ?
    ORDER BY end_date DESC`).all(districtId, cycle);
  race.poll_detail = polls;
  race.all_news = newsFor(districtId, cycle, 25);
  return race;
}

export function getMapFeatures({ cycle = CYCLE, raceType } = {}) {
  const race = listRaces({ cycle, raceType, competitiveOnly: true });
  const features = db.prepare(`SELECT district_id, race_type, district_number, competitive, geometry
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

export function getTicker({ cycle = CYCLE, limit = 10 } = {}) {
  const rows = db.prepare(`
    SELECT district_id, 'POLLS' AS metric, margin AS value, updated_at FROM polling_averages
      WHERE election_cycle = ? AND margin IS NOT NULL
    UNION ALL
    SELECT district_id, 'MARKETS' AS metric, advantage AS value, updated_at FROM markets
      WHERE election_cycle = ? AND advantage IS NOT NULL
    UNION ALL
    SELECT district_id, 'MONEY' AS metric, advantage AS value, updated_at FROM fundraising
      WHERE election_cycle = ? AND advantage IS NOT NULL
    ORDER BY updated_at DESC`).all(cycle, cycle, cycle);
  const competitive = new Set(
    db.prepare(`SELECT district_id FROM districts WHERE election_cycle = ? AND competitive = 1`).all(cycle).map((r) => r.district_id)
  );
  const formatter = { POLLS: formatPollAdvantage, MARKETS: formatMarketAdvantage, MONEY: formatMoney };
  const seen = new Set();
  const items = [];
  for (const r of rows) {
    if (!competitive.has(r.district_id)) continue;
    const key = `${r.district_id}:${r.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const adv = formatter[r.metric](r.value);
    if (!adv) continue;
    items.push({
      district_id: r.district_id,
      metric: r.metric,
      advantage: adv,
      updated_at: r.updated_at,
      line: `${r.district_id} — ${r.metric} ${adv.label}`,
    });
    if (items.length >= limit) break;
  }
  return items;
}

export function getSourceStatus() {
  return db.prepare(`SELECT source, last_fetched, last_success, last_error, status, notes
    FROM ingest_meta ORDER BY source`).all();
}