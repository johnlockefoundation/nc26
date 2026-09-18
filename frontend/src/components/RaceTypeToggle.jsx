const TYPES = [
  { key: 'us_senate', label: 'U.S. Senate' },
  { key: 'us_house', label: 'U.S. House' },
  { key: 'state_senate', label: 'NC Senate' },
  { key: 'state_house', label: 'NC House' },
];

export default function RaceTypeToggle({ value, onChange }) {
  return (
    <div className="toggle-bar" role="tablist">
      {TYPES.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          className={`toggle ${value === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          <span className="toggle-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}