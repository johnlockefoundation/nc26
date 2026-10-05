import { useEffect, useMemo, useState } from 'react';
import { getMap, getMeta, getRace, getTicker, getOutline, assetUrl, DEMO_ONLY } from './api.js';
import RaceTypeToggle from './components/RaceTypeToggle.jsx';
import RaceTicker from './components/RaceTicker.jsx';
import NCMap from './components/NCMap.jsx';
import ZipSearch from './components/ZipSearch.jsx';
import MiniGauge from './components/MiniGauge.jsx';
import RacePanel from './components/RacePanel.jsx';
import MapViewToggle from './components/MapViewToggle.jsx';
import ChamberCircles from './components/ChamberCircles.jsx';
import GenericBallotSlider from './components/GenericBallotSlider.jsx';
import { GA_MARGIN } from './lib/vulnerability.js';

export default function App() {
  const [raceType, setRaceType] = useState('us_house');
  const [mapData, setMapData] = useState(null);
  const [outline, setOutline] = useState(null);
  const [meta, setMeta] = useState(null);
  const [ticker, setTicker] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [zipFocus, setZipFocus] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);
  // Demo-only. See DEMO_ONLY in api.js for why these two are gated.
  const [view, setView] = useState('map');
  const [generic, setGeneric] = useState(0);

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

  const races = useMemo(() => mapData?.races || [], [mapData]);

  // The two controls need different amounts of the data, and gating them
  // together hid both of them.
  //
  // The waffle only needs to know who holds each seat, which comes from the
  // incumbent flag and is on every chamber except U.S. Senate -- where the flag
  // is wrong (Whatley holds the seat and is recorded as a challenger) and where
  // one circle is not a chamber anyway.
  //
  // The slider needs the Civitas per-district index, which only the General
  // Assembly has. Neither federal chamber has one, so there is nothing for it to
  // move against.
  const isGaChamber = raceType === 'state_house' || raceType === 'state_senate';
  const canWaffle = raceType !== 'us_senate';
  const sliderView = DEMO_ONLY && isGaChamber;
  const waffleView = DEMO_ONLY && canWaffle;

  // A generic ballot of zero belongs to the chamber it was reasoned about, so
  // both controls reset on a chamber switch rather than carrying a number that
  // was chosen while looking at a different map.
  useEffect(() => {
    setGeneric(0);
    setView('map');
  }, [raceType]);

  // Keep a valid selection for the current race type: on first load (or when the
  // type changes) open the leading competitive race so the panel is never empty.
  useEffect(() => {
    if (!mapData || mapData.race_type !== raceType) return;
    const stillValid = selectedId && races.some((r) => r.district_id === selectedId);
    if (!stillValid) setSelectedId(races[0]?.district_id || null);
  }, [mapData, raceType, races, selectedId]);

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
          {/* Only in the seats view. It moves the number the hemicycle's rings
              are drawn from, so on the map it would change something nobody can
              see. */}
          {sliderView && waffleView && view === 'circles' && (
            <div className="map-toolbar">
              <GenericBallotSlider
                races={races}
                generic={generic}
                onChange={setGeneric}
                margin={GA_MARGIN}
              />
            </div>
          )}
          <div className="map-toolbar">
            <RaceTypeToggle value={raceType} onChange={setRaceType} />
            {waffleView && <MapViewToggle value={view} onChange={setView} />}
            <ZipSearch raceType={raceType} onLocate={setZipFocus} />
          </div>
          {waffleView && view === 'circles' ? (
            <ChamberCircles
              races={races}
              generic={generic}
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

        <RacePanel race={detail} loading={loadingDetail} />
      </main>
    </div>
  );
}