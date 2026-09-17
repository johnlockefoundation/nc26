// Ingests the baseline metric seed (polls, markets, fundraising, news) into
// the normalized model. Rows are flagged is_seed = 1 so the API can surface
// that they are placeholders until live sources replace them.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, nowIso } from '../db.js';
import { CYCLE } from './config.js';
import { slugify } from './util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', '..', 'data', 'seed', 'metrics.json');

export function ingestSeedMetrics(cycle = CYCLE) {
  const data = JSON.parse(readFileSync(FILE, 'utf8'));
  const t = nowIso();

  const insAvg = db.prepare(`INSERT OR REPLACE INTO polling_averages
    (district_id, election_cycle, dem_average, rep_average, margin, n_polls, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const insPoll = db.prepare(`INSERT OR REPLACE INTO polls
    (poll_id, district_id, election_cycle, pollster, start_date, end_date, sample_size, population,
     dem_share, rep_share, margin, source_url, source, is_seed, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  const insMarket = db.prepare(`INSERT OR REPLACE INTO markets
    (district_id, election_cycle, provider, dem_price, rep_price, advantage, updated_at, source_url, is_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`);
  const insFund = db.prepare(`INSERT OR REPLACE INTO fundraising
    (district_id, election_cycle, dem_amount, rep_amount, advantage, reporting_period, updated_at, source_url, source_method, is_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);
  const insNews = db.prepare(`INSERT OR REPLACE INTO news
    (article_id, district_id, election_cycle, headline, outlet, published_at, url, summary, relevance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let polls = 0, averages = 0, markets = 0, fundraising = 0, news = 0;

  for (const [districtId, spec] of Object.entries(data.polls)) {
    if (spec.average) {
      const margin = +(spec.average.dem - spec.average.rep).toFixed(2);
      insAvg.run(districtId, cycle, spec.average.dem, spec.average.rep, margin,
        (spec.polls || []).length, spec.average.updated_at);
      averages++;
    }
    for (const p of spec.polls || []) {
      const margin = +(p.dem - p.rep).toFixed(2);
      insPoll.run(`${districtId}_${cycle}_${slugify(p.pollster)}_${p.end}`,
        districtId, cycle, p.pollster, p.start, p.end, p.sample ?? null, p.population ?? 'LV',
        p.dem, p.rep, margin, p.url || '', 'seed_metrics', t);
      polls++;
    }
  }

  for (const [districtId, spec] of Object.entries(data.markets)) {
    const adv = +(spec.dem_price - spec.rep_price).toFixed(2);
    insMarket.run(districtId, cycle, spec.provider, spec.dem_price, spec.rep_price, adv,
      spec.updated_at, spec.source_url || '');
    markets++;
  }

  for (const [districtId, spec] of Object.entries(data.fundraising)) {
    const adv = Math.round((spec.dem_amount || 0) - (spec.rep_amount || 0));
    insFund.run(districtId, cycle, spec.dem_amount ?? null, spec.rep_amount ?? null, adv,
      spec.reporting_period || '', spec.updated_at, spec.source_url || '', spec.source_method || 'total_receipts');
    fundraising++;
  }

  for (const n of data.news) {
    insNews.run(n.article_id, n.district_id, cycle, n.headline, n.outlet, n.published_at,
      n.url || '', n.summary || '', n.relevance_score ?? 0.5);
    news++;
  }

  console.log(`[metrics-seed] averages=${averages} polls=${polls} markets=${markets} fundraising=${fundraising} news=${news}`);
  return { source: 'metrics-seed', averages, polls, markets, fundraising, news };
}