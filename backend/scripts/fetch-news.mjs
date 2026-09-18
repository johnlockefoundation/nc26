// Fetch recent North Carolina political news from outlet RSS feeds and write
// the normalized news drop consumed by:  node src/ingest/index.js news
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const OUT = join(BACKEND, 'data', 'sources', 'news.json');

const FEEDS = [
  { outlet: 'WRAL', url: 'https://www.wral.com/news/rss/35/' },   // Political
  { outlet: 'WRAL', url: 'https://www.wral.com/news/rss/74/' },   // NC news
  { outlet: 'Carolina Journal', url: 'https://www.carolinajournal.com/feed/' },
  { outlet: 'Carolina Journal', url: 'https://www.carolinajournal.com/politics/feed/' },
];

const RACE_KEYS = /\b(senate|senator|congress|congressional|cooper|whatley|tillis|buckhout|davis|ager|balkcom|district|election|campaign|ballot|voting|voter|midterm|debate|endorse|gop|democrat|republican)\b/i;
const RACE_TOPIC = /\b(senate|senator|cooper|whatley|tillis|congress|house race|congressional district|midterm|election|campaign|district|debate|ballot)\b/i;

// Confident mappings from article text -> district. Fallback: statewide 'NC'.
function tagDistrict(text) {
  const t = ' ' + text + ' ';
  if (/cooper|whatley|tillis/i.test(t)) return 'NC-SEN';
  if (/(?:north carolina|nc).{0,20}1st\s+district|don davis|laurie buckhout|buckhout/i.test(t)) return 'NC-01';
  if (/11th\s+district|jamie ager|jennifer balkcom|balkcom/i.test(t)) return 'NC-11';
  return 'NC';
}

function strip(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(pubDate) {
  const ts = Date.parse(String(pubDate || '').trim());
  return ts ? new Date(ts).toISOString() : null;
}

function collect(xml, outlet) {
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
    out.push({ outlet, title, link, description, pubDate, text });
  }
  return out;
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`${feed.outlet} ${feed.url} http ${res.status}`);
  return collect(await res.text(), feed.outlet);
}

const CUTOFF = Date.now() - 7 * 24 * 60 * 60 * 1000;

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
const news = all.slice(0, 40).map((item, i) => {
  const raceTopic = RACE_TOPIC.test(item.text);
  const district = tagDistrict(item.text);
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
  };
});

mkdirSync(join(BACKEND, 'data', 'sources'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ source: 'RSS', updated_at: new Date().toISOString(), news }, null, 2));
console.log(`Wrote ${OUT} (${news.length} articles, last 7 days)`);
for (const n of news.slice(0, 12)) console.log(`  [${n.outlet}] ${n.headline.slice(0, 80)}`);