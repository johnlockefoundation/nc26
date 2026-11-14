import { useEffect, useMemo, useState } from 'react';
import { getMap, getMeta, getRace, getOutline, assetUrl } from './api.js';
import RaceTypeToggle from './components/RaceTypeToggle.jsx';
import NCMap from './components/NCMap.jsx';
import UnifiedSearch from './components/UnifiedSearch.jsx';
import MiniGauge from './components/MiniGauge.jsx';
import RacePanel from './components/RacePanel.jsx';

const FETCH_KEYS = ['us_house', 'us_senate', 'state_house', 'state_senate'];

export default function App() {
  const [raceType, setRaceType] = useState('us_house');
  const [electionYear, setElectionYear] = useState(2026);
  const [mapsByType, setMapsByType] = useState({});
  const [outline, setOutline] = useState(null);
  const [meta, setMeta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [zipFocus, setZipFocus] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOutline().then(setOutline).catch((e) => setError(String(e)));
    getMeta().then(setMeta).catch(() => {});
  }, []);

  // Load every chamber once so the search box can match races across chambers
  // and switching chambers never re-fetches.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(FETCH_KEYS.map((k) => getMap(k)))
      .then((results) => {
        if (!alive) return;
        const merged = {};
        FETCH_KEYS.forEach((k, i) => { merged[k] = results[i]; });
        setMapsByType(merged);
      })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const mapData = mapsByType[raceType === 'congress' ? 'us_house' : raceType];
  // For the congress view, merge us_house + us_senate races/features.
  const congressMerged = useMemo(() => {
    if (raceType !== 'congress') return null;
    const uh = mapsByType.us_house, us = mapsByType.us_senate;
    if (!uh || !us) return null;
    return {
      race_type: 'congress',
      races: [...(uh.races || []), ...(us.races || [])],
      features: [...(uh.features || []), ...(us.features || [])],
    };
  }, [raceType, mapsByType]);

  const activeMapData = raceType === 'congress' ? congressMerged : mapData;
  const races = activeMapData?.races || [];
  const features = activeMapData?.features || [];

  const allRacesByType = mapsByType;

  // Keep a valid selection for the current race type.
  useEffect(() => {
    if (!activeMapData) return;
    const stillValid = selectedId && races.some((r) => r.district_id === selectedId);
    if (!stillValid) setSelectedId(races[0]?.district_id || null);
  }, [activeMapData, raceType, races, selectedId]);

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

  function handleSelectRace(rt, districtId) {
    setRaceType(rt);
    setSelectedId(districtId);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="gauge-cluster gauge-left">
          <div className="gauge-row">
            <MiniGauge outlook={meta?.nc_senate_outlook} label="NC SENATE" raceType="state_senate" active={raceType === 'state_senate'} onSelect={setRaceType} outcomeOverride="R HOLD" />
            <MiniGauge outlook={meta?.nc_house_outlook} label="NC HOUSE" raceType="state_house" active={raceType === 'state_house'} onSelect={setRaceType} outcomeOverride="D FLIP" />
          </div>
        </div>
        <h1 className="brand-title">
          <a className="brand-link" href="https://www.johnlocke.org/donate/" target="_blank" rel="noreferrer" title="Support the John Locke Foundation">
            <img className="brand-logo" src={assetUrl('assets/carolina-election-map.png')} alt="Carolina Election Map" width="777" height="339" />
            <span className="brand-byline"><em>from</em> the John Locke Foundation</span>
          </a>
        </h1>
        <div className="gauge-cluster gauge-right">
          <div className="gauge-row">
            <MiniGauge outlook={meta?.house_outlook} label="U.S. HOUSE" raceType="us_house" active={raceType === 'us_house'} onSelect={setRaceType} outcomeOverride="D FLIP" />
            <MiniGauge outlook={meta?.senate_outlook} label="U.S. SENATE" raceType="us_senate" active={raceType === 'us_senate'} onSelect={setRaceType} outcomeOverride="D FLIP" />
          </div>
        </div>
      </header>

      <div className="search-row">
        <UnifiedSearch mapsByType={allRacesByType} onSelectRace={handleSelectRace} onLocate={setZipFocus} />
        <label className="year-select">
          <span className="year-select-label">Year</span>
          <select value={electionYear} onChange={(e) => setElectionYear(Number(e.target.value))}>
            <option value={2026}>2026</option>
            <option value={2024} disabled>2024 (coming soon)</option>
          </select>
        </label>
      </div>

      <img className="corner-logo" src={assetUrl('assets/locke-logo-white.png')} alt="John Locke Foundation" width="1200" height="346" />

      {error && <div className="error-banner">Could not load data: {error}</div>}

      <main className="layout">
        <section className="map-column">
          <div className="map-toolbar">
            <RaceTypeToggle value={raceType} onChange={setRaceType} />
          </div>
          {loading && <div className="panel-loading">Loading…</div>}
          {!loading && (
            <NCMap
              raceType={raceType}
              features={features}
              races={races}
              outline={outline}
              selectedId={selectedId}
              onSelect={setSelectedId}
              zipFocus={zipFocus}
            />
          )}
        </section>

        <div className="panel-column">
          <RacePanel race={detail} loading={loadingDetail} />
        </div>
      </main>
    </div>
  );
}