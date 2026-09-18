// Shared partisan-advantage formatting.
// Everything is normalized to a signed value where positive = Democratic edge.

export function partyOfSigned(value) {
  if (value == null || !isFinite(value)) return null;
  if (Math.abs(value) < 0.05) return 'EVEN';
  return value > 0 ? 'D' : 'R';
}

// Polling margin: value in percentage points (dem - rep).
export function formatPollAdvantage(value) {
  if (value == null || !isFinite(value)) return null;
  if (Math.abs(value) < 0.05) return { party: 'EVEN', label: 'EVEN', value: 0 };
  const party = value > 0 ? 'D' : 'R';
  const v = Math.abs(value);
  return { party, label: `${party} +${v.toFixed(1)}`, value: v };
}

// Market difference in cents (dem price - rep price). Example: R +16¢.
export function formatMarketAdvantage(value) {
  if (value == null || !isFinite(value)) return null;
  const pts = Math.abs(value) * 100;
  if (pts < 0.5) return { party: 'EVEN', label: 'EVEN', value: 0 };
  const party = value > 0 ? 'D' : 'R';
  const p = Math.round(pts);
  return { party, label: `${party} +${p}`, value: p };
}

// Fundraising difference in dollars (dem - rep). Examples: D +$3.0M, D +$850K.
export function formatMoney(value) {
  if (value == null || !isFinite(value)) return null;
  const abs = Math.abs(value);
  if (abs < 0.5) return { party: 'EVEN', label: 'EVEN', value: 0 };
  const party = value > 0 ? 'D' : 'R';
  let text;
  if (abs >= 1e6) text = `$${(abs / 1e6).toFixed(1)}M`;
  else if (abs >= 1e3) text = `$${(abs / 1e3).toFixed(0)}K`;
  else text = `$${Math.abs(Math.round(abs))}`;
  return { party, label: `${party} +${text}`, value: abs };
}

// Short human date, e.g. "Sep. 14" or "3 hours ago".
export function relativeTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return days === 1 ? 'Yesterday' : `${days} days ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function raceTypeLabel(raceType) {
  return { us_house: 'U.S. House', state_senate: 'NC Senate', state_house: 'NC House' }[raceType] || raceType;
}