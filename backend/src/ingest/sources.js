// Live data-source ingestion. Each source can be updated independently by
// dropping a normalized JSON file into backend/data/sources/<type>.json and
// running:  node src/ingest/index.js polls|markets|fundraising|news
//
// File schema mirrors the backend tables so sources stay interchangeable.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, nowIso } from '../db.js';
import { CYCLE } from './config.js';
import { slugify } from './util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES_DIR = join(__dirname, '..', '..', 'data', 'sources');

function loadDrop(type) {
  const file = join(SOURCES_DIR, `${type}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function ingestPollsFromSource(cycle = CYCLE) {
  const data = loadDrop('polls');
  if (!data) return null;
  const t = nowIso();
  // A real source replaces the placeholder seed entirely — no fake rows mixed in.
  db.prepare(`DELETE FROM polls WHERE election_cycle = ? AND is_seed = 1`).run(cycle);
  db.prepare(`DELETE FROM polling_averages WHERE election_cycle = ?`).run(cycle);
  const insPoll = db.prepare(`INSERT OR REPLACE INTO polls
    (poll_id, district_id, election_cycle, pollster, start_date, end_date, sample_size, population,
     dem_share, rep_share, margin, source_url, source, is_seed, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`);
  const insAvg = db.prepare(`INSERT OR REPLACE INTO polling_averages
    (district_id, election_cycle, dem_average, rep_average, margin, n_polls, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const delSeed = db.prepare(`UPDATE polls SET is_seed = 0 WHERE district_id = ? AND election_cycle = ?`);

  let polls = 0;
  const groups = new Map();
  for (const p of data.polls || []) {
    const margin = +(p.dem_share - p.rep_share).toFixed(2);
    insPoll.run(`${p.district_id}_${cycle}_${slugify(p.pollster)}_${p.end_date}`,
      p.district_id, cycle, p.pollster, p.start_date, p.end_date, p.sample_size ?? null,
      p.population ?? 'LV', p.dem_share, p.rep_share, margin, p.source_url || '', data.source || 'live_polls', t);
    if (!groups.has(p.district_id)) groups.set(p.district_id, []);
    groups.get(p.district_id).push(p);
    delSeed.run(p.district_id, cycle);
    polls++;
  }
  for (const [districtId, list] of groups) {
    const dem = +(list.reduce((a, p) => a + p.dem_share, 0) / list.length).toFixed(2);
    const rep = +(list.reduce((a, p) => a + p.rep_share, 0) / list.length).toFixed(2);
    insAvg.run(districtId, cycle, dem, rep, +(dem - rep).toFixed(2), list.length, t);
  }
  console.log(`[polls] ingested ${polls} polls across ${groups.size} districts`);
  return { source: data.source || 'polls', count: polls };
}

export function ingestMarketsFromSource(cycle = CYCLE) {
  const data = loadDrop('markets');
  if (!data) return null;
  db.prepare(`DELETE FROM markets WHERE election_cycle = ? AND is_seed = 1`).run(cycle);
  const ins = db.prepare(`INSERT OR REPLACE INTO markets
    (district_id, election_cycle, provider, dem_price, rep_price, advantage, updated_at, source_url, is_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`);
  let n = 0;
  for (const m of data.markets || []) {
    const adv = +((m.dem_price ?? 0) - (m.rep_price ?? 0)).toFixed(2);
    ins.run(m.district_id, cycle, m.provider, m.dem_price ?? null, m.rep_price ?? null, adv,
      m.updated_at, m.source_url || '');
    n++;
  }
  console.log(`[markets] ingested ${n} market rows`);
  return { source: data.source || 'markets', count: n };
}

export function ingestFundraisingFromSource(cycle = CYCLE) {
  const data = loadDrop('fundraising');
  if (!data) return null;
  db.prepare(`DELETE FROM fundraising WHERE election_cycle = ? AND is_seed = 1`).run(cycle);
  const ins = db.prepare(`INSERT OR REPLACE INTO fundraising
    (district_id, election_cycle, dem_amount, rep_amount, advantage, reporting_period, updated_at, source_url, source_method, is_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`);
  let n = 0;
  for (const f of data.fundraising || []) {
    const adv = Math.round((f.dem_amount || 0) - (f.rep_amount || 0));
    ins.run(f.district_id, cycle, f.dem_amount ?? null, f.rep_amount ?? null, adv,
      f.reporting_period || '', f.updated_at, f.source_url || '', f.source_method || 'total_receipts');
    n++;
  }
  console.log(`[fundraising] ingested ${n} fundraising rows`);
  return { source: data.source || 'fundraising', count: n };
}

export function ingestKalshiFromSource(cycle = CYCLE) {
  const data = loadDrop('markets-kalshi');
  if (!data) return null;
  db.prepare(`DELETE FROM markets WHERE election_cycle = ? AND provider = 'Kalshi'`).run(cycle);
  const ins = db.prepare(`INSERT OR REPLACE INTO markets
    (district_id, election_cycle, provider, dem_price, rep_price, advantage, updated_at, source_url, is_seed)
    VALUES (?, ?, 'Kalshi', ?, ?, ?, ?, ?, 0)`);
  const insSnap = db.prepare(`INSERT OR REPLACE INTO market_snapshots
    (district_id, election_cycle, provider, as_of, dem_price, rep_price)
    VALUES (?, ?, 'Kalshi', ?, ?, ?)`);
  const asOf = String(data.updated_at || new Date().toISOString()).slice(0, 10);
  const prevAsOf = new Date(`${asOf}T00:00:00Z`);
  prevAsOf.setUTCDate(prevAsOf.getUTCDate() - 1);
  const prevAsOfStr = prevAsOf.toISOString().slice(0, 10);
  let n = 0;
  for (const m of data.markets || []) {
    if (m.dem_price == null && m.rep_price == null) continue;
    const adv = +((m.dem_price ?? 0) - (m.rep_price ?? 0)).toFixed(2);
    ins.run(m.district_id, cycle, m.dem_price ?? null, m.rep_price ?? null, adv,
      m.updated_at, m.source_url || '');
    if (m.dem_price != null && m.rep_price != null && asOf) {
      insSnap.run(m.district_id, cycle, asOf, m.dem_price, m.rep_price);
    }
    // Baseline from Kalshi's own prior-session quote (previous_yes_bid), so a
    // genuine movement arrow appears from the first two fetches. Real daily
    // closes replace the baseline as fresh snapshots arrive.
    if (m.dem_prev_price != null && m.rep_prev_price != null && prevAsOfStr) {
      insSnap.run(m.district_id, cycle, prevAsOfStr, m.dem_prev_price, m.rep_prev_price);
    }
    n++;
  }
  console.log(`[kalshi] ingested ${n} market rows (snapshot ${asOf})`);
  return { source: data.source || 'kalshi', count: n };
}

export function ingestNewsFromSource(cycle = CYCLE) {
  const data = loadDrop('news');
  if (!data) return null;
  db.prepare(`DELETE FROM news WHERE election_cycle = ?`).run(cycle);
  const ins = db.prepare(`INSERT OR REPLACE INTO news
    (article_id, district_id, election_cycle, headline, outlet, published_at, url, summary, relevance_score, topic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let n = 0;
  for (const a of data.news || []) {
    ins.run(a.article_id ?? `${a.district_id}_${cycle}_${slugify(a.headline)}`,
      a.district_id, cycle, a.headline, a.outlet, a.published_at, a.url || '', a.summary || '',
      a.relevance_score ?? 0.5, a.topic || 'race');
    n++;
  }
  console.log(`[news] ingested ${n} articles`);
  return { source: data.source || 'news', count: n };
}