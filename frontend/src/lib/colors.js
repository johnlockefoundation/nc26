// Map coloring is driven by current race signal (not static partisan ratings).
// Default: polling margin. Falls back to markets, then money, then neutral.
// Saturation is scaled per metric so each signal colors in proportion to its
// own units: polls in points, markets in points, money in dollars.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function advantageColor(adv) {
  if (adv == null || !isFinite(adv)) return '#e2e8f0';
  const m = Math.max(-6, Math.min(6, adv));
  if (Math.abs(m) < 0.5) return '#a78bfa';
  const t = Math.abs(m) / 6;
  return m > 0 ? mix('#dbeafe', '#1d4ed8', t) : mix('#fee2e2', '#b91c1c', t);
}

// Solid party fill for competitive districts: blue for a D lean, red for an R
// lean, neutral gray when the signal is unavailable.
export function partyColor(party) {
  if (party === 'D') return '#1d4ed8';
  if (party === 'R') return '#b91c1c';
  return '#e2e8f0';
}

// Color a race from its primary signal, scaled in each metric's own units so a
// money-only district is not painted the same saturated hue as a blowout poll.
const SCALES = { POLLS: 10, MARKETS: 35, MONEY: 1500000, PARTISAN: 15 };

export function signalColor(sig) {
  if (!sig || !sig.advantage || !(sig.advantage.value > 0)) return '#e2e8f0';
  const t = Math.min(1, sig.advantage.value / (SCALES[sig.metric] || 10));
  if (t <= 0.02) return '#a78bfa';
  return sig.advantage.party === 'D' ? mix('#dbeafe', '#1d4ed8', t) : mix('#fee2e2', '#b91c1c', t);
}

// Primary signal for a race: polls -> markets -> money -> civitas partisan lean.
export function primarySignal(race) {
  if (race?.polls?.available) return { metric: 'POLLS', advantage: race.polls.advantage, value: race.polls.margin };
  if (race?.markets?.available) return { metric: 'MARKETS', advantage: race.markets.advantage, value: race.markets.advantage?.value ?? null };
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
