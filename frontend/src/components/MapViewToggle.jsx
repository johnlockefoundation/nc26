// Map or circles. Two views of the same chamber, so this is a two-way switch
// rather than a row of tabs: there is nothing else to choose between, and a
// reader who has just come from the map is not looking for a third option.
export default function MapViewToggle({ value, onChange }) {
  return (
    <div className="view-toggle" role="group" aria-label="Map or seats">
      <button
        type="button"
        className={`view-toggle-btn ${value === 'map' ? 'active' : ''}`}
        aria-pressed={value === 'map'}
        onClick={() => onChange('map')}
      >
        MAP
      </button>
      <button
        type="button"
        className={`view-toggle-btn ${value === 'circles' ? 'active' : ''}`}
        aria-pressed={value === 'circles'}
        onClick={() => onChange('circles')}
      >
        SEATS
      </button>
    </div>
  );
}