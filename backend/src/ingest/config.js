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

// US Senate is a single statewide race; designated competitive for the cycle.
export const US_SENATE = {
  district_id: 'NC-SEN',
  district_number: 0,
  source: 'ap_2026',
  reason: 'Open seat — Tillis (R) retiring; Cooper (D) vs. Whatley (R). Top Senate battleground.',
};

// Manual designation overrides for individual GA districts (e.g. rematches
// tracked heavily by regional press beyond the CPI rule).
export const COMPETITIVE_OVERRIDES = [
  { id: 'SD-42', source: 'charlotte_observer_2026', reason: 'Rematch of 2024 recount-margin race (CPI D+2); widely tracked Charlotte battleground.' },
];