export function money(amount) {
  if (amount == null) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${Math.round(amount)}`;
}
