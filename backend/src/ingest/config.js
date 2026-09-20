// Election-cycle configuration.
// The rule for which districts count as "competitive" is a per-cycle decision,
// kept here so the set can change between cycles without touching the data model.

export const CYCLE = '2026';

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

// U.S. Senate races designated in play for the cycle. The Cook Political
// Report battleground (Sep 2026): toss-ups plus lean races, including
// likely-Republican Nebraska from its "races to watch" list.
export const SENATE_RACES = [
  { id: 'NC-SEN', state: 'NC', name: 'North Carolina', source: 'cook_2026', reason: 'Open seat — Tillis (R) retiring; Cooper (D) vs. Whatley (R). Lean D per Cook. Top Senate battleground.' },
  { id: 'ME-SEN', state: 'ME', name: 'Maine', source: 'cook_2026', reason: 'Collins (R) seeks a sixth term; Toss-up per Cook.' },
  { id: 'AK-SEN', state: 'AK', name: 'Alaska', source: 'cook_2026', reason: 'Sullivan (R) seeks re-election; Toss-up per Cook (ranked-choice state).' },
  { id: 'MI-SEN', state: 'MI', name: 'Michigan', source: 'cook_2026', reason: 'Open seat — Stabenow (D) retiring; Toss-up per Cook.' },
  { id: 'OH-SEN', state: 'OH', name: 'Ohio', source: 'cook_2026', reason: 'Husted (R) seeks first full term; Toss-up per Cook.' },
  { id: 'IA-SEN', state: 'IA', name: 'Iowa', source: 'cook_2026', reason: 'Open seat — Ernst (R) retiring; Hinson (R) vs. Turek (D); Toss-up per Cook.' },
  { id: 'TX-SEN', state: 'TX', name: 'Texas', source: 'cook_2026', reason: 'Open seat — Paxton (R) vs. Talarico (D); moved to Toss-up per Cook.' },
  { id: 'GA-SEN', state: 'GA', name: 'Georgia', source: 'cook_2026', reason: 'Ossoff (D) seeks re-election; Lean D per Cook.' },
  { id: 'NH-SEN', state: 'NH', name: 'New Hampshire', source: 'cook_2026', reason: 'Open seat — Shaheen (D) retiring; Lean D per Cook.' },
  { id: 'NE-SEN', state: 'NE', name: 'Nebraska', source: 'cook_2026', reason: 'Ricketts (R) seeks re-election; Likely R per Cook but a 2024 Osborn wildcard.' },
];
export const SENATE_RACES_BY_ID = new Map(SENATE_RACES.map((r) => [r.id, r]));

// Manual designation overrides for individual GA districts (e.g. rematches
// tracked heavily by regional press beyond the CPI rule).
export const COMPETITIVE_OVERRIDES = [
  { id: 'SD-42', source: 'charlotte_observer_2026', reason: 'Rematch of 2024 recount-margin race (CPI D+2); widely tracked Charlotte battleground.' },
];