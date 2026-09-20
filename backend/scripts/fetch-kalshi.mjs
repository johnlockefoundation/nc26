// Fetch live 2026 Kalshi election prices for NC federal races and write the
// normalized market drop consumed by:  node src/ingest/index.js kalshi
//
// Market data endpoints are public (no API key). Prices are read from the
// market snapshot's _dollars fields (yes_bid_dollars / last_price_dollars);
// if those are absent a mid-market estimate is derived from the public
// orderbook's top of book.
// Districts with no tradeable price at all are skipped, so a provider row is
// never written that would shadow another live source.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const OUT = join(BACKEND, 'data', 'sources', 'markets-kalshi.json');
const SNAPSHOT_OUT = join(BACKEND, 'data', 'sources', 'kalshi-snapshots.json');

const BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const CYCLE = '2026';

// district_id -> Kalshi event ticker for the 2026 general-election winner race.
// Verified against the live API; a missing/renamed event falls back to
// runtime discovery by title (see discoverEvents).
const EVENTS = {
  'NC-01': 'HOUSENC1-26',
  'NC-02': 'KXHOUSERACE-NC02-26',
  'NC-03': 'KXHOUSERACE-NC03-26',
  'NC-04': 'KXHOUSERACE-NC04-26',
  'NC-05': 'KXHOUSERACE-NC05-26',
  'NC-06': 'KXHOUSERACE-NC06-26',
  'NC-07': 'KXHOUSERACE-NC07-26',
  'NC-08': 'KXHOUSERACE-NC08-26',
  'NC-09': 'KXHOUSERACE-NC09-26',
  'NC-10': 'KXHOUSERACE-NC10-26',
  'NC-11': 'KXHOUSENC11-26',
  'NC-12': 'KXHOUSERACE-NC12-26',
  'NC-13': 'KXHOUSERACE-NC13-26',
  'NC-14': 'KXHOUSERACE-NC14-26',
  'NC-SEN': 'SENATENC-26',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function kal(path) {
  const url = `${BASE}${path}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 429 || res.status >= 500) {
      const wait = 2000 * (attempt + 1);
      console.log(`  kalshi http ${res.status}, waiting ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`kalshi http ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error(`kalshi retry limit exceeded for ${path}`);
}

// Clamp a probability estimate (0–1 dollars) into the valid range.
const clamp01 = (v) => (v == null ? null : Math.max(0, Math.min(1, v)));

function partyOf(ticker) {
  if (/-(?:DEM|D)$/i.test(ticker)) return 'D';
  if (/-(?:GOP|R)$/i.test(ticker)) return 'R';
  return null;
}

// Canonical kalshi.com market-page URLs (verified live). The path shape is
// /markets/{series-slug}/{event-slug}/{event-ticker-lowercase}.
const MARKET_URLS = {
  'NC-01': 'https://kalshi.com/markets/housenc1/house-nc-1/housenc1-26',
  'NC-11': 'https://kalshi.com/markets/kxhousenc11/house-nc-11/kxhousenc11-26',
  'NC-SEN': 'https://kalshi.com/markets/senatenc/north-carolina-senate-race/senatenc-26',
};

function kalshiMarketUrl(districtId) {
  if (MARKET_URLS[districtId]) return MARKET_URLS[districtId];
  const n = districtId.replace(/^NC-0?/, '');
  return `https://kalshi.com/markets/kxhouserace/house-race-winner/kxhouserace-nc${n.padStart(2, '0')}-26`;
}

// Prior-session quote used as a baseline for daily/weekly movement. Prefer the
// previous bid (comparable to the yes_bid we read for the current price).
function prevDollars(market) {
  const raw =
    market.previous_yes_bid_dollars != null && market.previous_yes_bid_dollars !== ''
      ? market.previous_yes_bid_dollars
      : market.previous_price_dollars;
  return raw != null && raw !== '' ? +raw : null;
}

// Prices are returned as _dollars-suffixed string fields (e.g. "0.6000", scale
// 0–1); prefer the best bid, then the last trade. Falls back to a mid-market
// estimate from the public orderbook top of book.
async function snapshotPrice(market) {
  const raw =
    market.yes_bid_dollars != null && market.yes_bid_dollars !== ''
      ? market.yes_bid_dollars
      : market.last_price_dollars != null && market.last_price_dollars !== ''
        ? market.last_price_dollars
        : market.yes_ask_dollars;
  if (raw != null && raw !== '') return { dollars: +raw, source: 'snapshot', prev: prevDollars(market) };
  const orderbook = await kal(`/markets/${market.ticker}/orderbook`).catch(() => null);
  const ob = orderbook?.orderbook_fp ?? null;
  if (!ob?.yes_dollars?.length || !ob?.no_dollars?.length) return null;
  const yesAsk = +ob.yes_dollars[0][0];
  const noAsk = +ob.no_dollars[0][0];
  // A book quoting a near-free "buy" on BOTH sides (e.g. both < 5c) prices an
  // effectively void contract and carries no real probability — skip it rather
  // than shadowing another live source with a meaningless mid-market value.
  if (yesAsk < 0.05 && noAsk < 0.05) return null;
  const yesBid = 1 - noAsk;
  return { dollars: (yesBid + yesAsk) / 2, source: 'orderbook', prev: prevDollars(market) };
}

async function eventMarkets(eventTicker) {
  const data = await kal(`/markets?event_ticker=${eventTicker}&limit=50`);
  return data.markets || [];
}

async function discoverEvents() {
  const found = {};
  let cursor = '';
  for (let page = 0; page < 40; page++) {
    const q = `/events?limit=200&min_close_ts=${Date.now()}${cursor ? `&cursor=${cursor}` : ''}`;
    const data = await kal(q);
    for (const e of data.events || []) {
      const title = e.title || '';
      const event = e.event_ticker;
      if (!event) continue;
      const sen = /^North Carolina Senate winner\?$/i.test(title);
      const house = /^NC-\d+ House winner\?$/i.test(title);
      if (sen) found['NC-SEN'] = event;
      if (house) found[`NC-${title.match(/^NC-(\d+)/i)[1].padStart(2, '0')}`] = event;
    }
    cursor = data.cursor || '';
    if (!cursor) break;
    await sleep(300);
  }
  return found;
}

const districtEvents = { ...EVENTS };

const markets = [];
const updated_at = new Date().toISOString();

const districtIds = Object.keys(districtEvents).sort((a, b) => {
  const na = Number(a.replace(/\D/g, '')) || 0;
  const nb = Number(b.replace(/\D/g, '')) || 0;
  return na - nb;
});

for (const districtId of districtIds) {
  let event = districtEvents[districtId];
  let list;
  try {
    list = await eventMarkets(event);
  } catch (err) {
    console.log(`  event ${event} (${districtId}) failed: ${err.message}; discovering events`);
    districtEvents[districtId] = (await discoverEvents())[districtId];
    event = districtEvents[districtId];
    if (!event) { console.log(`  no event found for ${districtId}, skipping`); continue; }
    list = await eventMarkets(event);
  }

  const demM = list.find((m) => partyOf(m.ticker) === 'D');
  const repM = list.find((m) => partyOf(m.ticker) === 'R');

  const dem = demM ? await snapshotPrice(demM) : null;
  const rep = repM ? await snapshotPrice(repM) : null;

  if (!dem && !rep) {
    console.log(`  ${districtId} (${event}): no live price, skipped`);
    continue;
  }

  const demo = dem ? clamp01(dem.dollars) : null;
  const repo = rep ? clamp01(rep.dollars) : null;
  const marketUrl = kalshiMarketUrl(districtId);
  const demPrev = dem?.prev != null ? clamp01(dem.prev) : null;
  const repPrev = rep?.prev != null ? clamp01(rep.prev) : null;
  markets.push({
    district_id: districtId,
    provider: 'Kalshi',
    dem_price: demo,
    rep_price: repo,
    dem_prev_price: demPrev,
    rep_prev_price: repPrev,
    updated_at,
    source_url: marketUrl,
  });
  console.log(`  ${districtId}: D ${demo != null ? demo.toFixed(3) : '—'} / R ${repo != null ? repo.toFixed(3) : '—'} (${[dem?.source, rep?.source].filter(Boolean).join('/')})`);
  await sleep(250);
}

mkdirSync(join(BACKEND, 'data', 'sources'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ source: 'Kalshi', cycle: CYCLE, updated_at, markets }, null, 2));
console.log(`Wrote ${OUT} (${markets.length} markets)`);