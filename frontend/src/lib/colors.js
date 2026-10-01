// Map coloring is two tones per party: which way the seat leans, and whether it
// is in play. Nothing else. A district's hue comes from whichever signal knows
// the race best, and its brightness comes only from the cycle's competitive flag.
//
// A district's fill depends on exactly two things: which way it leans, and
// whether the seat is in play. Those are independent facts we already know --
// the lean from the race signal or the NCGA index, the in-play flag from the
// cycle -- and pairing them gives four fills. Every chamber reads the same way,
// so a North Carolina House seat and a U.S. House seat are comparable at a
// glance without translating between them.
//
// Brightness is reserved for competitiveness. An in-play seat gets the vivid
// tone; a settled one gets the same hue muted, which is what makes the map read
// as the whole state rather than a few hot districts floating in nothing. There
// is deliberately no third axis: sizing the saturation by margin or price made
// 20 cents look like a certainty and 90 cents indistinguishable from it, and
// that comparison is a reader's to make from the panel, not the map's to encode.
const PARTY_FILL = {
  D: { live: '#2563eb', dull: '#1e3a5f' },
  R: { live: '#dc2626', dull: '#5c1e1e' },
};

// Neutral for a seat with no lean recorded at all, so "unrated" stays visibly
// distinct from "rated and settled" rather than borrowing either party's hue.
const NO_LEAN = '#475569';

// Fill for one district. `lean` is { party } or null; `inPlay` is the cycle's
// competitive flag.
export function fillFor(lean, inPlay) {
  const tone = lean && lean.party ? PARTY_FILL[lean.party] : null;
  if (!tone) return NO_LEAN;
  return inPlay ? tone.live : tone.dull;
}

export const SAFE_FILL_OPACITY = 1;

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
// off it -- the magnitude stays in the panel, and the map's brightness comes
// from the competitive flag instead.
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

// ---------------------------------------------------------------------------
// Lean resolution
//
// A district's hue is decided in one place, because the main map and the county
// insets have to agree: if they resolved the lean separately, an inset district
// could come out a different colour from the same district on the state map,
// which would be worse than having no inset at all.

// The lean for a district, and the bucket to label it with. NCGA features carry
// the Civitas value, so the label can be honest -- "LIKELY R+9" rather than
// calling a Likely seat Safe. Congressional features carry a bare party with no
// magnitude, so they get no lean label; the panel is where their numbers live.
export function leanOf(f) {
  if (!f.cpi) return f.lean_party ? { party: f.lean_party } : null;
  const m = /^([DR])\+(\d+(?:\.\d+)?)$/.exec(String(f.cpi).trim());
  if (!m) return null;
  return { party: m[1], value: +m[2], bucket: f.partisan_lean };
}

// Which way a seat leans, from whichever signal knows the race best. The live
// race signal wins when there is one, so a seat that picks up polling or a fresh
// price is coloured by it. The feature's own lean is the fallback, which is what
// lets the map be fully coloured with no network at all.
export function leanFor(f, race) {
  if (f.competitive && race) {
    const s = primarySignal(race);
    if (s.advantage && s.advantage.party && s.advantage.party !== 'EVEN') {
      return { party: s.advantage.party };
    }
  }
  return leanOf(f);
}

// The complete fill decision for one district, so the map and the insets cannot
// drift apart: lean for the hue, competitive flag for the tone.
export function fillForFeature(f, race) {
  const inPlay = Boolean(f.competitive && race);
  return { inPlay, fill: fillFor(leanFor(f, race), inPlay) };
}
