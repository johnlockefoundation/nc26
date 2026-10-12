import { useEffect, useMemo, useState } from 'react';
import { getMap, getMeta, assetUrl } from './api.js';
import SeatBuckets from './components/SeatBuckets.jsx';

// The General Assembly chambers, safe and competitive, on their own page.
//
// This was a chart of every individual seat, which turned out to be the wrong
// unit: 120 circles arranged by an index is a picture of a method, and the
// question a reader actually arrives with -- how many seats does each party
// safely hold, and how many are still live -- is a three-part split. Three
// rectangles answer it directly.
//
// Only the General Assembly, deliberately. The Civitas per-district index the
// split is cut from exists for no federal seat, and a chamber of 14 or 1 is not
// a chamber.

const CHAMBERS = [
  { key: 'state_house', label: 'NC House', total: 120 },
  { key: 'state_senate', label: 'NC Senate', total: 50 },
];

export default function SeatsPage() {
  const [raceType, setRaceType] = useState('state_house');
  const [mapData, setMapData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMeta().then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    getMap(raceType)
      .then((d) => { if (alive) setMapData(d); })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = alive && false; };
  }, [raceType]);

  const races = useMemo(() => mapData?.races || [], [mapData]);

  return (
    <div className="app seats-app">
      <header className="seats-topbar">
        <a className="seats-back" href="./">← Carolina Election Map</a>
        <h1 className="seats-title">
          North Carolina General Assembly
          <span className="seats-sub">
            Every seat split three ways by its Civitas partisan lean: safe for a
            party, or within four points of even and therefore competitive.
          </span>
        </h1>
      </header>

      {error && <div className="error-banner">Could not load data: {error}</div>}

      <div className="seats-controls">
        <div className="view-toggle" role="group" aria-label="Chamber">
          {CHAMBERS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`view-toggle-btn ${raceType === c.key ? 'active' : ''}`}
              aria-pressed={raceType === c.key}
              onClick={() => setRaceType(c.key)}
            >
              {c.label.toUpperCase()} · {c.total}
            </button>
          ))}
        </div>
      </div>

      <main className="seats-main">
        <SeatBuckets races={races} />
      </main>

      <footer className="seats-foot">
        A competitive seat is within four points of even on the Civitas index.
        {meta?.nc_house_outlook && (
          <span className="seats-foot-source">
            {' '}Seat projections from {meta.nc_house_outlook.source}.
          </span>
        )}
      </footer>

      <img
        className="corner-logo"
        src={assetUrl('assets/locke-logo-white.png')}
        alt="John Locke Foundation"
        width="1200"
        height="346"
      />
    </div>
  );
}
