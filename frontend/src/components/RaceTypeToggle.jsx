const TYPES = [
  { key: 'us_house', label: 'U.S. House', sub: '14 seats · competitive' },
  { key: 'state_senate', label: 'NC Senate', sub: '50 seats' },
  { key: 'state_house', label: 'NC House', sub: '120 seats' },
];

export default function RaceTypeToggle({ value, onChange, counts }) {
  return (
    <div className="toggle-bar" role="tablist">
      {TYPES.map((t) => {
        const c = counts?.[t.key];
        const label = c ? `${c.competitive} of ${c.total}` : t.sub;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={value === t.key}
            className={`toggle ${value === t.key ? 'active' : ''}`}
            onClick={() => onChange(t.key)}
          >
            <span className="toggle-label">{t.label}</span>
            <span className="toggle-sub">{label}</span>
          </button>
        );
      })}
    </div>
  );
}