import { useEffect, useMemo, useState } from 'react';
import { getMap, getMeta, getRace, getTicker, getOutline, assetUrl } from './api.js';
import RaceTypeToggle from './components/RaceTypeToggle.jsx';
import RaceTicker from './components/RaceTicker.jsx';
import NCMap from './components/NCMap.jsx';
import ZipSearch from './components/ZipSearch.jsx';
import MiniGauge from './components/MiniGauge.jsx';
import RacePanel from './components/RacePanel.jsx';
import ChamberCircles from './components/ChamberCircles.jsx';
import { GA_MARGIN } from './lib/vulnerability.js';

// The chambers the Legislature view applies to. The chamber semicircles are General
// Assembly only: the Civitas index they arrange by exists for no federal seat,
// and a chamber of 14 or 1 is not a chamber.
const STATE_RACES = new Set(['state_house', 'state_senate']);

export default function App() {
  const [raceType, setRaceType] = useState('us_house');
  // 'map' or 'legislature'. Only meaningful for the two state chambers; a
  // federal race type forces it back to the map below.
  const [view, setView] = useState('map');
  const [mapData, setMapData] = useState(null);
  const [outline, setOutline] = useState(null);
  const [meta, setMeta] = useState(null);
  const [ticker, setTicker] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [zipFocus, setZipFocus] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  const isState = STATE_RACES.has(raceType);

  useEffect(() => {
    getOutline().then(setOutline).catch((e) => setError(String(e)));
    getMeta().then(setMeta).catch(() => {});
    getTicker(12).then((d) => setTicker(d.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    // No crossfade between chambers. Every map is framed on North Carolina over
    // the same basemap, so there is no view to soften the transition into -- the
    // fade only ever hid the layer rebuild, at the cost of a blank half-second
    // on every tab switch.
    setError(null);
    getMap(raceType)
      .then((d) => { if (alive) setMapData(d); })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [raceType]);

  // A federal race type has no Legislature view, so switching to one returns to
  // the map rather than leaving a chart that cannot describe the seat.
  useEffect(() => {
    if (!STATE_RACES.has(raceType) && view !== 'map') setView('map');
  }, [raceType, view]);

  const races = useMemo(() => mapData?.races || [], [mapData]);

  // Keep a valid selection for the current race type: on first load (or when the
  // type changes) open the leading competitive race so the panel is never empty.
  useEffect(() => {
    if (!mapData || mapData.race_type !== raceType) return;
    const stillValid = selectedId && races.some((r) => r.district_id === selectedId);
    if (!stillValid) setSelectedId(races[0]?.district_id || null);
  }, [mapData, raceType, races, selectedId]);

  // A detail for one chamber must not linger under another. Switching Map and
  // Legislature within a chamber does not run this -- the race type is the same.
  useEffect(() => {
    setDetail(null);
  }, [raceType]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let alive = true;
    setLoadingDetail(true);
    getRace(selectedId)
      .then((d) => { if (alive) setDetail(d); })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoadingDetail(false); });
    return () => { alive = false; };
  }, [selectedId]);

  // A seat opens only when it is clicked (or activated by keyboard), never on
  // hover: passing the pointer across a chamber to reach the map should not
  // reshuffle the panel underneath it.
  const shownDetail = detail && selectedId && detail.district_id === selectedId ? detail : null;
  const panelLoading = loadingDetail || Boolean(selectedId && !shownDetail);

  return (
    <div className="app">
      <header className="topbar">
        <div className="gauge-cluster gauge-left">
          <div className="gauge-row">
            <MiniGauge outlook={meta?.nc_senate_outlook} label="NC SENATE" raceType="state_senate" active={raceType === 'state_senate'} onSelect={setRaceType} />
            <MiniGauge outlook={meta?.nc_house_outlook} label="NC HOUSE" raceType="state_house" active={raceType === 'state_house'} onSelect={setRaceType} />
          </div>
        </div>
        <h1 className="brand-title">
          {/* One anchor over the wordmark and the byline, so the whole block is
              the click target rather than a logo with an invisible hit area. The
              site is published by the John Locke Foundation and the tracker runs
              on its support, so the attribution doubles as the way to fund it. */}
          <a
            className="brand-link"
            href="https://www.johnlocke.org/donate/"
            target="_blank"
            rel="noreferrer"
            title="Support the John Locke Foundation"
          >
            <img
              className="brand-logo"
              src={assetUrl('assets/carolina-election-map.png')}
              alt="Carolina Election Map"
              width="777"
              height="339"
            />
            <span className="brand-byline"><em>from</em> the John Locke Foundation</span>
          </a>
        </h1>
        <div className="gauge-cluster gauge-right">
          <div className="gauge-row">
            <MiniGauge outlook={meta?.house_outlook} label="U.S. HOUSE" raceType="us_house" active={raceType === 'us_house'} onSelect={setRaceType} />
            <MiniGauge outlook={meta?.senate_outlook} label="U.S. SENATE" raceType="us_senate" active={raceType === 'us_senate'} onSelect={setRaceType} />
          </div>
        </div>
      </header>

      <RaceTicker items={ticker} />
      <img
        className="corner-logo"
        src={assetUrl('assets/locke-logo-white.png')}
        alt="John Locke Foundation"
        width="1200"
        height="346"
      />

      {error && <div className="error-banner">Could not load data: {error}</div>}

      <main className="layout">
        <section className="map-column">
          <div className="map-toolbar">
            <div className="map-toolbar-left">
              <RaceTypeToggle value={raceType} onChange={setRaceType} />
              {/* Beside the chamber tabs, because it is a second way to read the
                  same chamber rather than a separate place. Absent on federal
                  chambers, where there is no index to arrange by. */}
              {isState && (
                <div className="view-toggle" role="group" aria-label="View">
                  <button
                    type="button"
                    className={`view-toggle-btn ${view === 'map' ? 'active' : ''}`}
                    aria-pressed={view === 'map'}
                    onClick={() => setView('map')}
                  >
                    MAP
                  </button>
                  <button
                    type="button"
                    className={`view-toggle-btn ${view === 'legislature' ? 'active' : ''}`}
                    aria-pressed={view === 'legislature'}
                    onClick={() => setView('legislature')}
                  >
                    LEGISLATURE
                  </button>
                </div>
              )}
            </div>
            <div className="map-toolbar-right">
              {/* Discoverable from the federal view, where the control it opens
                  is not visible: the page opens on U.S. House, so a reader has
                  to be told the Legislature view exists. It opens NC House,
                  which is the chamber the Civitas index covers most fully. */}
              {!isState && (
                <button
                  type="button"
                  className="seats-link"
                  onClick={() => { setRaceType('state_house'); setView('legislature'); }}
                >
                  View NC Legislature →
                </button>
              )}
              {/* ZIP search is geographic; there is no geography on the chart, so
                  it is hidden in the Legislature view rather than disabled. */}
              {view === 'map' && (
                <ZipSearch raceType={raceType} onLocate={setZipFocus} />
              )}
            </div>
          </div>
          {isState && view === 'legislature' ? (
            <ChamberCircles
              races={races}
              generic={0}
              margin={GA_MARGIN}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <NCMap
              raceType={raceType}
              features={mapData?.features || []}
              races={races}
              outline={outline}
              selectedId={selectedId}
              onSelect={setSelectedId}
              zipFocus={zipFocus}
            />
          )}
        </section>

        <RacePanel race={shownDetail} loading={panelLoading} />
      </main>
    </div>
  );
}
