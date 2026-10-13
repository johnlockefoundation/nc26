import { useEffect, useMemo, useState } from 'react';
import { getMap, getMeta, assetUrl } from './api.js';
import ChamberCircles from './components/ChamberCircles.jsx';
import GenericBallotSlider from './components/GenericBallotSlider.jsx';
import { GA_MARGIN } from './lib/vulnerability.js';

// The General Assembly hemicycle, on its own page.
//
// This was a MAP/SEATS toggle inside the map page, which turned out to be the
// wrong shape twice over. It was invisible on arrival because the map page opens
// on U.S. House and neither control applies there, so a reader had to already
// know to switch chambers to find it. And it crowded a page whose job is a
// geographic map of North Carolina: a chamber of 120 circles wants the whole
// screen, and a slider is a control, not a map overlay.
//
// As its own page it gets a URL worth linking to, and it stops competing with
// the map for space.
//
// Only the General Assembly, deliberately. The slider moves the Civitas
// per-district index and neither federal chamber has one, so there is nothing
// for it to move against; and a hemicycle of 14 or 1 seats is not a chamber.

const CHAMBERS = [
  { key: 'state_house', label: 'NC House', total: 120 },
  { key: 'state_senate', label: 'NC Senate', total: 50 },
];

export default function SeatsPage() {
  const [raceType, setRaceType] = useState('state_house');
  const [mapData, setMapData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [generic, setGeneric] = useState(0);
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

  // A generic ballot of zero belongs to the chamber it was reasoned about, so the
  // slider resets on a switch rather than carrying a number chosen while looking
  // at a different chamber.
  useEffect(() => {
    setGeneric(0);
    setSelectedId(null);
  }, [raceType]);

  // Keep a selection valid for the chamber on screen.
  useEffect(() => {
    if (!mapData || mapData.race_type !== raceType) return;
    if (selectedId && races.some((r) => r.district_id === selectedId)) return;
    setSelectedId(null);
  }, [mapData, raceType, races, selectedId]);

  const chamber = CHAMBERS.find((c) => c.key === raceType);

  return (
    <div className="app seats-app">
      <header className="seats-topbar">
        <a className="seats-back" href="./">← Carolina Election Map</a>
        <h1 className="seats-title">
          North Carolina General Assembly
          <span className="seats-sub">
            Every seat, ordered by partisan lean. Blue holds a seat, red holds a
            seat, and a ring marks the ones in play.
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
        <GenericBallotSlider
          races={races}
          generic={generic}
          onChange={setGeneric}
          margin={GA_MARGIN}
        />
      </div>

      <main className="seats-main">
        <ChamberCircles
          races={races}
          generic={generic}
          margin={GA_MARGIN}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>

      <footer className="seats-foot">
        {selectedId
          ? `${selectedId} selected. Open it on the map for the full race.`
          : 'Select a seat to highlight it.'}
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