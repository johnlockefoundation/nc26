// Map colouring: a district's hue comes from whichever way the seat leans, and
// competitiveness is a second, lighter tone of that same hue. Two fills per
// party, one rule, every chamber.
//
// The lean decides the hue and the competitive flag decides the strength of it.
// A settled seat is a solid block in the full party colour; a seat that is in
// play is the same hue washed out to a light tint. Because both come from the
// same hue, a reader never has to learn a second colour to read the map -- and
// because the in-play tint is lighter rather than brighter, a genuinely toss-up
// seat stops shouting over the rest of the state, which is what it did when
// brightness was the competitiveness signal.
//
// There is deliberately no third axis. Sizing the tint by margin or price made
// 20 cents look like a certainty and 90 cents indistinguishable from it, and that
// comparison is a reader's to make from the panel, not the map's to encode.

// Two tones per party: the settled block, and the light wash for a seat in play.
export const PARTY_FILL = {
  D: { settled: '#1d4ed8', inPlay: '#7dd3fc' },
  R: { settled: '#b91c1c', inPlay: '#f472b6' },
};

// Neutral for a seat with no lean recorded at all, so "unrated" stays visibly
// distinct from "rated" rather than borrowing either party's hue. The light
// variant is the same slate washed out, so an unrated in-play district still
// reads as in play without claiming a party.
export const NO_LEAN_FILL = { settled: '#475569', inPlay: '#94a3b8' };

// Fill for one district. `lean` is { party } or null; `inPlay` is the cycle's
// competitive flag.
export function fillFor(lean, inPlay) {
  const tone = lean && lean.party ? PARTY_FILL[lean.party] : NO_LEAN_FILL;
  return inPlay ? tone.inPlay : tone.settled;
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
