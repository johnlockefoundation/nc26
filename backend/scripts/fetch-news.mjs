// Fetch recent North Carolina political news from outlet RSS feeds and write
// the normalized news drop consumed by:  node src/ingest/index.js news
//
// Only stories with an explicit North Carolina anchor are kept (the ticker is
// NC-exclusive), and each story is tagged to the specific race it covers when
// the article names a district or a candidate ("Raleigh races" = the NC Senate
// and NC House candidates tracked by divider/civitas).
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const OUT = join(BACKEND, 'data', 'sources', 'news.json');
const SEED = join(BACKEND, 'data', 'seed');

// Two tiers of source, per the news hierarchy on the site:
//   funnel - Locke and Carolina Journal. The top ticker is a funnel for these
//            two only, so a story is marked in_funnel regardless of which tier
//            it came from.
//   race   - outlets that cover specific NC seats, which feed the per-district
//            list under CPI Info. They do not drive the ticker.
const FEEDS = [
  { outlet: 'John Locke Foundation', url: 'https://www.johnlocke.org/feed/', funnel: true },
  { outlet: 'Carolina Journal', url: 'https://www.carolinajournal.com/feed/?post_type=article', funnel: true },
  { outlet: 'WRAL', url: 'https://www.wral.com/news/rss/35/' },   // Political
  { outlet: 'WRAL', url: 'https://www.wral.com/news/rss/74/' },   // NC news
  { outlet: 'Carolina Public Press', url: 'https://carolinapublicpress.org/feed/' },
  { outlet: 'Our State', url: 'https://www.ourstate.com/feed' },
  { outlet: 'indyweek', url: 'https://indyweek.com/feed/' },
];

// Outlets that may appear in the top ticker.
const FUNNEL_OUTLETS = new Set(feedsFilter());
function feedsFilter() {
  return FEEDS.filter((f) => f.funnel).map((f) => f.outlet);
}

const RACE_KEYS = /\b(senate|senator|congress|congressional|cooper|whatley|tillis|buckhout|davis|ager|balkcom|district|election|campaign|ballot|voting|voter|midterm|debate|endorse|gop|democrat|republican)\b/i;
const RACE_TOPIC = /\b(senate|senator|cooper|whatley|tillis|congress|house race|congressional district|midterm|election|campaign|district|debate|ballot)\b/i;

// A surname on its own is not a safe signal. The candidate list contains
// surnames that are also ordinary English words or state fragments ("North",
// "Quick", "Lee", "Bell", "Page", "Pike", "Ward"), and matching those against
// body text tags unrelated stories to the wrong seat -- every mention of
// "North Carolina" resolved to a House seat. A surname is only accepted as a
// secondary signal, alongside one of these corroborators.
const SEAT_CONTEXT = /\b(seat|race|rematch|challenger|incumbent|reelection|re-election|primary|general election|ballot|campaign|donor|fundraising|spend|spending|polling|pollster|debate|endorsement|endorsed|candidate|legislator|representative|senator|district|county|voters?|turnout|opponent|primary challenger)\b/i;
// Substrings that are never a standalone candidate mention.
const SURNAME_STOPWORDS = new Set(['north', 'south', 'east', 'west', 'quick', 'lee', 'page', 'bell', 'pike', 'ward', 'blue', 'ford', 'gray', 'moss', 'ball', 'hamm', 'cruz', 'ii', 'iii', 'iv', 'jr', 'sr']);

// Explicit North Carolina anchor. Required for a story to reach the ticker,
// which keeps Iowa/Russia/national-wire items out of the NC-exclusive loop.
const NC_ANCHOR = new RegExp([
  /north carolina|n\.c\.|tar\s?heel/i.source,
  /\bnc\b.*?(senate|house|gop|democrat|election|ballot|voter|congress|race)/i.source,
  /\b(ncsbe|nc senate|nc house|council of state|state board of elections)\b/i.source,
  /\b(raleigh|charlotte|asheville|greensboro|durham|fayetteville|wilmington|gastonia|winston[- ]salem)\b/i.source,
  /\b(mecklenburg|wake|guilford|buncombe|cumberland|forsyth|alamance|orange|pitt|onslow|johnston|harnett|cabarrus|iredell|union|rowan|catawba|davidson|gaston)\b\s*county?/i.source,
].map((s) => `(?:${s})`).join('|'), 'i');

// Candidates -> district, loaded once from the same seed files the backend
// ingests. Used to tag race-specific stories to the NC Senate (SD-xx) and
// NC House (HD-xx) races that otherwise fall back to statewide 'NC'.
const NAME_TO_DISTRICT = new Map();
const SURNAME_TO_DISTRICTS = new Map();

function addCandidate(name, district) {
  if (!name) return;
  const full = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!full) return;
  NAME_TO_DISTRICT.set(full, district);
  // Surnames unique to a single district are usable, minus the stopwords
  // above. Everything ambiguous is dropped rather than guessed at.
  const surname = full.split(' ').pop();
  if (!surname || SURNAME_STOPWORDS.has(surname) || surname.length < 4) return;
  if (!SURNAME_TO_DISTRICTS.has(surname)) SURNAME_TO_DISTRICTS.set(surname, new Set());
  SURNAME_TO_DISTRICTS.get(surname).add(district);
}

function loadCandidates() {
  const civitas = JSON.parse(readFileSync(join(SEED, 'civitas.json'), 'utf8'));
  const pad = (n) => String(n).padStart(2, '0');
  for (const rec of civitas.senate || []) {
    const id = `SD-${pad(rec.district_number)}`;
    for (const c of rec.candidates || []) addCandidate(c?.name, id);
  }
  for (const rec of civitas.house || []) {
    const id = `HD-${rec.district_number}`;
    for (const c of rec.candidates || []) addCandidate(c?.name, id);
  }
  const usHouse = JSON.parse(readFileSync(join(SEED, 'candidates-us-house.json'), 'utf8'));
  for (const c of usHouse.candidates || []) addCandidate(c.name, c.district_id);
  const usSenate = JSON.parse(readFileSync(join(SEED, 'candidates-us-senate.json'), 'utf8'));
  for (const c of usSenate.candidates || []) {
    if (c.district_id === 'NC-SEN') addCandidate(c.name, c.district_id);
  }
}
loadCandidates();

// Maps article text -> a specific district, or null when the story is not
// about one seat in particular. Callers treat null as "not seat-specific",
// which is what keeps unrelated policy coverage out of a district's list.
function tagDistrict(text) {
  const t = ' ' + text + ' ';
  // The marquee names alone are not enough: "Cooper" shows up in deposition and
  // litigation coverage, and "Cooper University"/"Tillis Hill" are not the
  // race. Require the story to read as coverage of the Senate contest.
  if (/us senate.{0,30}carolina|carolina.{0,30}us senate|senate race|senate contest|senate seat|senate candidate|cooper.{0,60}(whatley|vance|senate|campaign|senator|debate)|whatley.{0,60}(cooper|vance|senate|campaign|senator|debate)/i.test(t)) {
    return 'NC-SEN';
  }

  // Explicit district tokens are the strongest signal and are checked first.
  const sd = /\bsd[- ](\d{1,2})\b/i.exec(t) || /\bsenate district\s+(\d{1,2})\b/i.exec(t);
  if (sd) return `SD-${sd[1].padStart(2, '0')}`;

  const hd = /\bhd[- ](\d{1,3})\b/i.exec(t) || /\bhouse district\s+(\d{1,3})\b/i.exec(t);
  if (hd) return `HD-${hd[1]}`;

  const ncHouse = /\bnc[- ](\d{1,2})\b/i.exec(t);
  if (ncHouse) return `NC-${ncHouse[1].padStart(2, '0')}`;

  const district = /(?:north carolina|nc)[\s\S]{0,25}(\d{1,2})(?:st|nd|rd|th)?\s+(?:congressional\s+)?district/i.exec(t);
  if (district && Number(district[1]) <= 14) return `NC-${district[1].padStart(2, '0')}`;

  // Candidate names are a strong signal but not sufficient alone: the former
  // governor's name runs in litigation and policy coverage too. Any
  // name-derived tag therefore also has to read as coverage of a contest.
  if (SEAT_CONTEXT.test(t)) {
    const tl = ` ${t.toLowerCase()} `;
    for (const [name, districtId] of NAME_TO_DISTRICT) {
      if (tl.includes(` ${name} `)) return districtId;
    }
    // Surname alone needs the same corroboration, and only surnames unique
    // to one district are considered.
    for (const [surname, districts] of SURNAME_TO_DISTRICTS) {
      if (districts.size !== 1) continue;
      if (new RegExp(`\\b${surname}\\b`, 'i').test(t)) return [...districts][0];
    }
  }

  return null;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…', eacute: 'é',
};

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function strip(s) {
  return decodeEntities(String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(pubDate) {
  const ts = Date.parse(String(pubDate || '').trim());
  return ts ? new Date(ts).toISOString() : null;
}

function isNorthCarolina(text) {
  return NC_ANCHOR.test(text);
}

function collect(xml, feed) {
  const items = xml.split(/<item[ >]/).slice(1);
  const out = [];
  for (const raw of items) {
    const title = strip((raw.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = ((raw.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
    const description = strip((raw.match(/<description>([\s\S]*?)<\/description>/) || [])[1]);
    const pubDate = parseDate((raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]);
    if (!title || !link || !pubDate) continue;
    const text = `${title} ${description}`;
    if (!RACE_KEYS.test(text)) continue;
    // The per-district list is seat-specific, so it only ever draws on
    // seat-tagged stories. The ticker is broader: a funnel outlet's
    // statewide policy coverage still belongs there.
    if (!feed.funnel) {
      if (!tagDistrict(text)) continue;
      if (!isNorthCarolina(text)) continue;
    }
    out.push({ outlet: feed.outlet, funnel: Boolean(feed.funnel), title, link, description, pubDate, text });
  }
  return out;
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`${feed.outlet} ${feed.url} http ${res.status}`);
  return collect(await res.text(), feed);
}

// Curated race-specific stories for the "Raleigh races" (NC Senate SD-xx and
// NC House HD-xx). The state legislative races rarely make the RSS feeds, so
// these curated seed stories are merged back into every drop to keep the
// district tickers populated alongside the live statewide news.
function curatedRaceStories() {
  const seed = readFileSync(join(SEED, 'metrics.json'), 'utf8');
  const data = JSON.parse(seed);
  if (!Array.isArray(data.news)) return [];
  return data.news.filter((n) => /^SD-|^HD-/.test(n.district_id || ''));
}

const CUTOFF = Date.now() - 14 * 24 * 60 * 60 * 1000;

const all = [];
const seen = new Set();
for (const feed of FEEDS) {
  try {
    for (const item of await fetchFeed(feed)) {
      if (Date.parse(item.pubDate) < CUTOFF) continue;
      const key = `${item.outlet}:${item.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(item);
    }
    console.log(`  ${feed.outlet} ${feed.url}: ok`);
  } catch (err) {
    console.log(`  ${feed.outlet} ${feed.url}: failed (${err.message})`);
  }
}

all.sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));
let news = all.slice(0, 60).map((item, i) => {
  const raceTopic = RACE_TOPIC.test(item.text);
  // Funnel outlets stay eligible for the ticker even when the story is not
  // about one seat; race outlets are seat-tagged by construction.
  const district = tagDistrict(item.text) || (item.funnel ? 'NC' : null);
  return {
    article_id: `rss_${item.outlet.replace(/[^a-z0-9]/gi, '_')}_${i}`,
    district_id: district,
    headline: item.title,
    outlet: item.outlet,
    published_at: item.pubDate,
    url: item.link,
    summary: item.description.slice(0, 240),
    relevance_score: raceTopic ? 0.7 : 0.4,
    topic: raceTopic ? 'race' : 'news',
    in_funnel: item.funnel ? 1 : 0,
  };
});

// Re-attach the curated race-specific SD/HD stories, so a district's list is
// not empty just because no live feed covered that seat this cycle. Curated
// rows are seat-tagged by construction and are not funnel-eligible.
const rssDistricts = new Set(news.map((n) => n.district_id));
const curated = curatedRaceStories()
  .filter((n) => !rssDistricts.has(n.district_id))
  .map((n) => ({
    article_id: n.article_id,
    district_id: n.district_id,
    headline: n.headline,
    outlet: n.outlet,
    published_at: n.published_at,
    url: n.url || '',
    summary: n.summary || '',
    relevance_score: n.relevance_score ?? 0.7,
    topic: n.topic || 'race',
    in_funnel: 0,
  }));
news = news.concat(curated).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));

mkdirSync(join(BACKEND, 'data', 'sources'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ source: 'RSS + curated', updated_at: new Date().toISOString(), news }, null, 2));
console.log(`Wrote ${OUT} (${news.length} articles)`);
for (const n of news.slice(0, 12)) console.log(`  [${n.district_id}] ${n.headline.slice(0, 80)}`);