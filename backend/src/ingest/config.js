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

// For General Assembly districts, JLF/Civitas designates competitive races as
// toss-ups plus lean-Republican districts in a Republican midterm year (2026).
export const GA_COMPETITIVE_RULE = {
  matches: (rec) => rec.rating_lean === 'Toss-up' || (rec.rating_lean === 'Lean' && rec.rating_party === 'R'),
  source: 'john_locke_civitas',
  label: '2026 Civitas Partisan Index (toss-up or lean Republican)',
};

// US House is outside the GA-only CPI; the competitive set for the cycle is
// stated explicitly from published national ratings.
export const US_HOUSE_COMPETITIVE = [
  { id: 'NC-01', source: 'inside_elections_2026', reason: 'Lean Republican. District redrawn GOP-friendlier for 2026; Davis (D) vs. Buckhout (R).' },
  { id: 'NC-11', source: 'inside_elections_2026_dccc', reason: 'Open seat — Edwards (R) dropped out after House Ethics report. DCCC Red to Blue target; Lean Republican.' },
];

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