// Map colouring: a district's hue comes from whichever way the seat leans, and
// whether it is in play is a separate question answered by texture rather than
// colour. Two fills, one rule, every chamber.
//
// The hue is the same at every level of competitiveness. A settled seat and a
// genuinely toss-up seat are both drawn at full strength in their party's
// colour, because brightness used to be the competitiveness signal and that made
// the map lie twice: a Safe R+35 looked like a certainty, and a narrow Lean seat
// that happened to be rated competitive got painted the same vivid tone as a
// true tie. Neither is what the rating says.
//
// So competitiveness is not a colour at all. An in-play seat is unfilled and
// hatched with slanted lines in its own party hue, which is why the lines are
// tinted rather than neutral: a reader scanning the map should still be able to
// see which way a hot seat leans without hovering it. A settled seat is a solid
// block in the same hue. The two are told apart by texture -- open versus solid
// -- rather than by one looking stronger than the other.
//
// There is deliberately no third axis. Sizing saturation by margin or price made
// 20 cents look like a certainty and 90 cents indistinguishable from it, and that
// comparison is a reader's to make from the panel, not the map's to encode.

// One colour per party, used at full strength whether or not the seat is in
// play. These are the vivid tones that used to be reserved for competitive
// seats.
export const PARTY_COLOR = {
  D: '#1d4ed8',
  R: '#b91c1c',
};

// Neutral for a seat with no lean recorded at all, so "unrated" stays visibly
// distinct from "rated and settled" rather than borrowing either party's hue.
export const NO_LEAN_COLOR = '#475569';

// The ids of the SVG hatch patterns NCMap injects into the map. They have to
// match the defs built there, which is why they live here rather than being
// written inline at the call site.
export const HATCH_ID = {
  D: 'jce-hatch-d',
  R: 'jce-hatch-r',
  NONE: 'jce-hatch-n',
};

// Fill for one district. `lean` is { party } or null; `inPlay` is the cycle's
// competitive flag. A settled seat gets a solid block; an in-play one gets the
// matching hatch, which is drawn in the same hue and carries the party with it.
export function fillFor(lean, inPlay) {
  const party = lean && lean.party ? lean.party : null;
  if (!inPlay) return party ? PARTY_COLOR[party] : NO_LEAN_COLOR;
  return `url(#${party ? HATCH_ID[party] : HATCH_ID.NONE})`;
}


// How a district is labelled when it carries no race signal of its own. The
// Civitas bucket is the honest word for it -- calling a Likely R+9 "SAFE"
// overstates how settled the seat is.
const LEAN_LABELS = { 'Safe': 'SAFE', 'Likely': 'LIKELY', 'Lean': 'LEAN', 'Toss-up': 'TOSS-UP' };

export function leanLabel(lean) {
  const bucket = LEAN_LABELS[lean?.bucket] || 'SAFE';
  return `${bucket} ${lean.party}+${lean.value}`;
}

// Which way a seat leans, from whichever signal knows the race best: markets,
// then polling, then money, then the NCGA index. Only the party is ever read
// off it -- the magnitude stays in the panel, and competitiveness is carried by
// the hatch rather than by the colour.
export function primarySignal(race) {
  if (race?.markets?.available) return { metric: 'MARKETS', advantage: race.markets.advantage, value: race.markets.advantage?.value ?? null };
  if (race?.polls?.available) return { metric: 'POLLS', advantage: race.polls.advantage, value: race.polls.margin };
  if (race?.money?.available) return { metric: 'MONEY', advantage: race.money.advantage, value: race.money.advantage?.value ?? null };
  if (race?.partisan?.available) {
    return { metric: 'PARTISAN', advantage: { party: race.partisan.party, label: race.partisan.label, value: race.partisan.value }, value: race.partisan.value };
  }
  return { metric: null, advantage: null, value: null };
}

export function advantageText(metric, summary) {
  if (!summary || !summary.available || !summary.advantage) {
    return metric === 'POLLS' ? 'NO POLLING' : metric === 'MARKETS' ? 'NO MARKET' : 'NO MONEY';
  }
  return summary.advantage.label;
}
