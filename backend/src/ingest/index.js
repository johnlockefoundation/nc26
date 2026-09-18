// Ingest CLI.
//   node src/ingest/index.js all            -> full pipeline from seed data
//   node src/ingest/index.js districts      -> rebuild district geometry rows
//   node src/ingest/index.js civitas        -> GA candidates + competitiveness (CPI)
//   node src/ingest/index.js us-house       -> federal candidates + competitiveness
//   node src/ingest/index.js us-senate      -> NC Senate race + candidates
//   node src/ingest/index.js metrics        -> baseline metrics (polls/markets/money/news)
//   node src/ingest/index.js polls          -> live polls from ./data/sources/polls.json
//   node src/ingest/index.js markets        -> live markets from ./data/sources/markets.json
//   node src/ingest/index.js fundraising    -> live fundraising from ./data/sources/fundraising.json
//   node src/ingest/index.js news           -> live news from ./data/sources/news.json
import { db, initSchema, nowIso } from '../db.js';
import { CYCLE } from './config.js';
import { ingestDistricts } from './districts.js';
import { ingestCivitas } from './civitas.js';
import { ingestUsHouse } from './us-house.js';
import { ingestUsSenate } from './us-senate.js';
import { ingestSeedMetrics } from './metrics.js';
import { ingestProfiles } from './profile.js';
import {
  ingestPollsFromSource, ingestMarketsFromSource, ingestFundraisingFromSource, ingestNewsFromSource,
} from './sources.js';

initSchema();

function recordRun(source, ok, notes) {
  const t = nowIso();
  db.prepare(`INSERT INTO ingest_meta (source, last_fetched, last_success, last_error, status, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET
      last_fetched = excluded.last_fetched,
      last_success = CASE WHEN excluded.status = 'ok' THEN excluded.last_fetched ELSE ingest_meta.last_success END,
      last_error = excluded.last_error,
      status = excluded.status,
      notes = CASE WHEN excluded.notes IS NOT NULL THEN excluded.notes ELSE ingest_meta.notes END`)
    .run(source, t, ok ? t : null, ok ? null : notes, ok ? 'ok' : 'error', notes || null);
}

const JOB = {
  districts: () => ingestDistricts(CYCLE),
  civitas: () => ingestCivitas(CYCLE),
  'us-house': () => ingestUsHouse(CYCLE),
  'us-senate': () => ingestUsSenate(CYCLE),
  metrics: () => ingestSeedMetrics(CYCLE),
  profiles: () => ingestProfiles(CYCLE),
  polls: () => ingestPollsFromSource(CYCLE),
  markets: () => ingestMarketsFromSource(CYCLE),
  fundraising: () => ingestFundraisingFromSource(CYCLE),
  news: () => ingestNewsFromSource(CYCLE),
};

async function run(target) {
  const jobs = target === 'all' ? ['districts', 'civitas', 'us-house', 'us-senate', 'metrics', 'profiles', 'polls', 'markets', 'fundraising', 'news'] : [target];
  for (const j of jobs) {
    const fn = JOB[j];
    if (!fn) { console.error(`unknown ingest target: ${j}`); process.exitCode = 1; continue; }
    const started = Date.now();
    try {
      const result = fn() || { source: j };
      recordRun(result.source || j, true, null);
      console.log(` ✓ ${j} (${Date.now() - started}ms)`);
    } catch (err) {
      recordRun(j, false, err.message);
      console.error(` ✗ ${j}: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

const target = process.argv[2] || 'all';
await run(target);