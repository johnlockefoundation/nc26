// Unified search: one box that accepts a candidate name, a district id (NC-01,
// HD-5, SD-04), or a 5-digit NC ZIP. Names and ids produce a dropdown of
// matching races across every chamber; a ZIP zooms the map to that location.
import { useEffect, useMemo, useRef, useState } from 'react';
import centroids from '../lib/ncZipCentroids.json';

const CHAMBER_LABEL = {
  us_house: 'U.S. House', us_senate: 'U.S. Senate',
  state_house: 'NC House', state_senate: 'NC Senate',
};
const RACE_TYPE_FOR = {
  us_house: 'congress', us_senate: 'congress',
  state_house: 'state_house', state_senate: 'state_senate',
};

export default function UnifiedSearch({ mapsByType, onSelectRace, onLocate }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const allRaces = useMemo(() => {
    const out = [];
    for (const [key, data] of Object.entries(mapsByType || {})) {
      for (const r of data?.races || []) out.push({ ...r, _mapKey: key });
    }
    return out;
  }, [mapsByType]);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    // ZIP: handled separately, no race list.
    if (/^\d{3,5}$/.test(q)) return [];
    const out = [];
    for (const r of allRaces) {
      const idMatch = String(r.district_id || '').toLowerCase().includes(q);
      const numMatch = String(r.district_number ?? '').toLowerCase() === q.replace(/^0+/, '');
      const nameMatch = (r.candidates || []).some((c) =>
        String(c.name || '').toLowerCase().includes(q),
      );
      if (idMatch || numMatch || nameMatch) out.push(r);
    }
    return out.slice(0, 12);
  }, [value, allRaces]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function choose(race) {
    setOpen(false);
    setValue('');
    onSelectRace?.(RACE_TYPE_FOR[race.race_type] || race.race_type, race.district_id);
  }

  function submit(e) {
    e.preventDefault();
    const q = value.trim();
    const zip = q.replace(/\D/g, '').slice(0, 5);
    if (zip.length === 5 && centroids.zips[zip]) {
      const p = centroids.zips[zip];
      onLocate?.({ zip, lat: p[0], lng: p[1] });
      setValue('');
      setOpen(false);
      return;
    }
    if (matches.length) choose(matches[0]);
  }

  return (
    <div className="unified-search" ref={wrapRef}>
      <form className="unified-search-form" onSubmit={submit} role="search">
        <input
          className="unified-search-input"
          type="text"
          placeholder="Search candidate, district (NC-01, HD-5), or ZIP…"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          aria-label="Search races"
        />
        {matches.length > 0 && open && (
          <ul className="unified-search-dropdown" role="listbox">
            {matches.map((r) => (
              <li key={r.district_id} role="option">
                <button type="button" className="unified-search-option" onClick={() => choose(r)}>
                  <span className="unified-search-id">{r.district_id}</span>
                  <span className="unified-search-chamber">{CHAMBER_LABEL[r.race_type] || r.race_type}</span>
                  <span className="unified-search-names">
                    {(r.candidates || []).map((c) => c.name).join(' v ') || '—'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
}