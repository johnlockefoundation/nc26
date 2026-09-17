export function relativeTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fullDate(iso) {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function money(amount) {
  if (amount == null) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${Math.round(amount)}`;
}

export function percent(v, digits = 1) {
  if (v == null) return '—';
  return `${Number(v).toFixed(digits)}%`;
}

export function pollDates(start, end) {
  if (!start && !end) return '';
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (s && e && start !== end) return `${fmt(s)}–${fmt(e)}`;
  return e ? fmt(e) : fmt(s);
}