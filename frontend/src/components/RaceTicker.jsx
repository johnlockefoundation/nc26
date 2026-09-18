function chipClass(label) {
  if (!label) return '';
  if (label.startsWith('D')) return 'chip-d';
  if (label.startsWith('R')) return 'chip-r';
  return 'chip-even';
}

function renderChips(items, onSelect, copy) {
  return (
    <div key={copy} className="ticker-group" aria-hidden={copy === 1}>
      {items.map((it) => (
        <button
          key={`${copy}-${it.district_id}-${it.metric}`}
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
  );
}

export default function RaceTicker({ items, onSelect }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="ticker" role="marquee" aria-label="Recent changes across competitive races">
      <span className="ticker-label">RECENT</span>
      <div className="ticker-track">
        <div className="ticker-run">
          {renderChips(items, onSelect, 0)}
          {renderChips(items, onSelect, 1)}
        </div>
      </div>
    </div>
  );
}