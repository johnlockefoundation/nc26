function chipClass(label) {
  if (!label) return '';
  if (label.startsWith('D')) return 'chip-d';
  if (label.startsWith('R')) return 'chip-r';
  return 'chip-even';
}

export default function RaceTicker({ items, onSelect }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="ticker" role="marquee" aria-label="Recent changes across competitive races">
      <span className="ticker-label">RECENT</span>
      <div className="ticker-track">
        {items.map((it) => (
          <button
            key={`${it.district_id}-${it.metric}`}
            className={`ticker-chip ${chipClass(it.advantage?.label)}`}
            onClick={() => onSelect?.(it.district_id)}
            title={`Updated ${it.updated_at || ''}`}
          >
            <span className="ticker-district">{it.district_id}</span>
            <span className="ticker-sep">—</span>
            <span className="ticker-metric">{it.metric}</span>
            <span className="ticker-adv">{it.advantage?.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}