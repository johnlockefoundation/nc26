// Shared partisan-advantage formatting, for the three live signals the tracker
// ranks. Everything is normalized to a signed value where positive = Democratic
// edge. These three are the whole public surface; adding a fourth formatter means
// adding a signal that reaches the panel, which is a product decision, not a
// formatting one.
//
// The tie threshold is 0.05, duplicated in poll_advantage() in
// supabase/migrations/20261001170000_poll_summary_read.sql so the SQL read and
// the SQLite read produce byte-identical labels. Change one, change both.

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
