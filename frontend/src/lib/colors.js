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

// The header gauges paint their arcs from these so the gauges and the map cannot
// drift apart. Exported rather than restated in the stylesheet because a gauge
// arc is SVG geometry and takes its colour as an attribute, not from CSS.
//
// Only the live tone is exported for that purpose. It is a fill colour: the arcs
// are large areas, the same job it does on the map. It is not legible as small
// text -- #2563eb on the header's dark chip measures 3.5:1, under the 4.5:1 AA
// threshold -- so the gauge's coloured *text* keeps the lighter --d and --r
// tokens at 7.2:1 and 6.6:1 instead.
export const PARTY_TONES = PARTY_FILL;

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
// Map colours now reflect the projected winner: the live race signal (markets,
// then polls, then money) wins whenever it names a party, regardless of whether
// the seat is flagged competitive. The Civitas index is only the fallback for
// races with no live signal. Competitiveness still governs brightness via
// fillFor, so a settled seat keeps its muted tone.
export function leanFor(f, race) {
  if (race) {
    const s = primarySignal(race);
    if (s.advantage && s.advantage.party && s.advantage.party !== 'EVEN') {
      return { party: s.advantage.party };
    }
  }
  return leanOf(f);
}

// ---------------------------------------------------------------------------
// Gradient fill by victory margin
//
// The two-tone (live/dull) scheme is gone: a district's fill now runs along a
// single diverging scale, red to blue, whose intensity is the size of the
// projected or actual margin. The reddest seats are the darkest red, the bluest
// the darkest blue, and a toss-up sits in the neutral middle. Competitiveness no
// longer changes the colour -- it is the margin that does.
const NEUTRAL_FILL = '#cbd5e1';

function lerpHex(a, b, t) {
  const ca = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const cb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return 'rgb(' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t)).join(',') + ')';
}

// A signed margin in points (positive = Democratic edge). Live signals win over
// the Civitas index; money is normalised to a modest fixed magnitude since it
// is dollars, not points.
export function marginFor(f, race, results) {
  const r = results && results.races && results.races[f.district_id];
  if (r) return r.margin_pp;
  if (race) {
    const s = primarySignal(race);
    if (s.advantage && s.advantage.party && s.advantage.party !== 'EVEN') {
      const v = typeof s.advantage.value === 'number' ? s.advantage.value : 0;
      const signed = s.advantage.party === 'D' ? v : -v;
      if (s.metric === 'MONEY') return signed > 0 ? 5 : -5;
      return signed;
    }
  }
  const lean = leanOf(f);
  if (lean && typeof lean.value === 'number') {
    return lean.party === 'D' ? lean.value : -lean.value;
  }
  if (f.cpi) {
    const m = /^([DR])\+(\d+(?:\.\d+)?)$/.exec(String(f.cpi).trim());
    if (m) return (m[1] === 'D' ? 1 : -1) * +m[2];
  }
  return null;
}

export function fillForMargin(margin) {
  if (margin == null) return NO_LEAN;
  if (Math.abs(margin) < 0.5) return NEUTRAL_FILL;
  const clamped = Math.max(-25, Math.min(25, margin));
  const t = Math.abs(clamped) / 25;
  if (clamped >= 0) return lerpHex(NEUTRAL_FILL, '#1e3a8a', t);
  return lerpHex(NEUTRAL_FILL, '#7f1d1d', t);
}

// The complete fill decision for one district, so the map and the insets cannot
// drift apart.
// A seat Democrats flipped: a Democratic win on a seat whose baseline leans
// Republican (Civitas partisan_party) or whose pre-election market favoured
// the Republican. Used to pick the hatched fill instead of the solid one.
export function flippedToD(f, race, results) {
  const r = results && results.races && results.races[f.district_id];
  if (r && r.flipped_to_d) return true;
  // Fallback for data without the flag: Civitas lean or market favorite.
  if (!r || r.winner !== 'D') return false;
  if (f.partisan_party === 'R') return true;
  if (race && race.markets && race.markets.available) {
    const m = race.markets;
    if (m.dem_price != null && m.rep_price != null && m.rep_price > m.dem_price) return true;
  }
  return false;
}

// Two shades per party: a darker tone for seats that held (no party change) and a
// brighter tone for seats that flipped. No hatch pattern.
export function fillForRace(f, race, results) {
  const r = results && results.races && results.races[f.district_id];
  const winner = r ? r.winner : (race ? primarySignal(race)?.advantage?.party : null);
  const flipped = r ? (r.flipped_to_d || r.flipped_to_r) : false;
  if (winner === 'D') return flipped ? '#3b82f6' : '#1e3a8a';
  if (winner === 'R') return flipped ? '#ef4444' : '#7f1d1d';
  // Fallback to the Civitas lean when there is no result yet.
  const lean = leanOf(f);
  if (lean && lean.party === 'D') return '#1e3a8a';
  if (lean && lean.party === 'R') return '#7f1d1d';
  return '#94a3b8';
}

export function fillForFeature(f, race, results) {
  const inPlay = Boolean(f.competitive && race);
  return { inPlay, fill: fillForRace(f, race, results) };
}
