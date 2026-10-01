// Election-cycle configuration.
// The rule for which districts count as "competitive" is a per-cycle decision,
// kept here so the set can change between cycles without touching the data model.

export const CYCLE = '2026';

// The only outlets whose coverage this site carries. The ticker and the
// per-seat news list both print the outlet verbatim, so anything else that
// reaches the news table is visible third-party coverage. Kept here so the
// fetcher's feed list and the ingest's allowlist cannot drift apart.
export const NEWS_OUTLETS = ['John Locke Foundation', 'Carolina Journal'];
export const ALLOWED_NEWS_OUTLETS = new Set(NEWS_OUTLETS);

// National U.S. House outlook used for the race-signal "odometer" gauge.
export const HOUSE_OUTLOOK = {
  dem: 205,
  rep: 212,
  tossup: 18,
  threshold: 218,
  total: 435,
  today: { dem: 215, rep: 220 },
  source: 'Cook Political Report',
  updated_at: '2026-09-16T12:00:00Z',
};

// National U.S. Senate outlook (35 Class II seats up in 2026).
export const SENATE_OUTLOOK = {
  dem: 51,
  rep: 49,
  tossup: 0,
  threshold: 50,
  total: 100,
  today: { dem: 47, rep: 53 },
  source: 'Decision Desk HQ',
  updated_at: '2026-09-16T12:00:00Z',
};

// North Carolina Senate (Buckley amendment) chamber outlook.
export const NC_SENATE_OUTLOOK = {
  dem: 20,
  rep: 30,
  tossup: 0,
  threshold: 26,
  total: 50,
  today: { dem: 20, rep: 30 },
  source: 'JLF Civitas',
  updated_at: '2026-09-16T12:00:00Z',
};

// North Carolina House chamber outlook.
export const NC_HOUSE_OUTLOOK = {
  dem: 48,
  rep: 72,
  tossup: 0,
  threshold: 61,
  total: 120,
  today: { dem: 49, rep: 71 },
  source: 'JLF Civitas',
  updated_at: '2026-09-16T12:00:00Z',
};

// For General Assembly districts, JLF/Civitas designates competitive races as
// toss-ups plus lean-Republican districts in a Republican midterm year (2026).
export const GA_COMPETITIVE_RULE = {
  matches: (rec) => rec.rating_lean === 'Toss-up' || (rec.rating_lean === 'Lean' && rec.rating_party === 'R'),
  source: 'john_locke_civitas',
  label: '2026 Civitas Partisan Index (toss-up or lean Republican)',
};

// Linked from the Civitas partisan breakdown shown for state races.
export const CIVITAS_SOURCE_URL =
  'https://www.johnlocke.org/9-14-election-data-dump-which-nc-general-assembly-districts-are-in-play/';

// US House is outside the GA-only CPI; every district is tracked for the
// cycle regardless of margin, which keeps the map and panels complete even
// where polling/markets are sparse (they report honestly as unavailable).
const HOUSE_RATED = {
  'NC-01': 'Lean R — district redrawn GOP-friendlier for 2026; Davis (D) vs. Buckhout (R).',
  'NC-02': 'Safe D — Ross (D) incumbent.',
  'NC-03': 'Safe R — Murphy (R) incumbent.',
  'NC-04': 'Safe D — Foushee (D) incumbent.',
  'NC-05': 'Safe R — Foxx (R) incumbent.',
  'NC-06': 'Safe R — McDowell (R) incumbent.',
  'NC-07': 'Safe R — Rouzer (R) incumbent.',
  'NC-08': 'Safe R — Harris (R) incumbent.',
  'NC-09': 'Safe R — Hudson (R) incumbent.',
  'NC-10': 'Safe R — Harrigan (R) incumbent.',
  'NC-11': 'Lean R — open seat; Edwards (R) withdrew, Balkcom (R) selected by convention. DCCC Red to Blue target.',
  'NC-12': 'Safe D — Adams (D) incumbent.',
  'NC-13': 'Safe R — Knott (R) incumbent.',
  'NC-14': 'Safe R — Moore (R) incumbent.',
};
export const US_HOUSE_COMPETITIVE = Object.entries(HOUSE_RATED).map(([id, reason]) => ({
  id,
  source: 'jlf_nc26_tracker',
  reason,
}));

// The U.S. Senate race this tracker follows. North Carolina is the only state
// covered: Cooper (D) vs. Whatley (R) in the seat Tillis (R) is vacating, the
// top Senate battleground per Cook. Other in-play seats are deliberately not
// carried -- they had a quote and nothing else, and a map of ten shells said
// more about the pipeline than about any one race.
export const SENATE_RACES = [
  { id: 'NC-SEN', state: 'NC', name: 'North Carolina', source: 'cook_2026', reason: 'Open seat — Tillis (R) retiring; Cooper (D) vs. Whatley (R). Lean D per Cook. Top Senate battleground.' },
];
export const SENATE_RACES_BY_ID = new Map(SENATE_RACES.map((r) => [r.id, r]));

// Manual designation overrides for individual GA districts (e.g. rematches
// tracked heavily by regional press beyond the CPI rule).
export const COMPETITIVE_OVERRIDES = [
  { id: 'SD-42', source: 'charlotte_observer_2026', reason: 'Rematch of 2024 recount-margin race (CPI D+2); widely tracked Charlotte battleground.' },
];