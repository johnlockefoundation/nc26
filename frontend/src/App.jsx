import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMap, getMeta, getRace, getTicker, getOutline, isStatic } from './api.js';
import RaceTypeToggle from './components/RaceTypeToggle.jsx';
import RaceTicker from './components/RaceTicker.jsx';
import NCMap from './components/NCMap.jsx';
import RacePanel from './components/RacePanel.jsx';
import { relativeTime } from './lib/format.js';
import { primarySignal } from './lib/colors.js';

const TYPE_BY_PREFIX = { NC: 'us_house', SD: 'state_senate', HD: 'state_house' };

export default function App() {
  const [raceType, setRaceType] = useState('us_house');
  const [mapData, setMapData] = useState(null);
  const [outline, setOutline] = useState(null);
  const [meta, setMeta] = useState(null);
  const [ticker, setTicker] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getOutline().then(setOutline).catch((e) => setError(String(e)));
    getMeta().then(setMeta).catch(() => {});
    getTicker(12).then((d) => setTicker(d.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    getMap(raceType)
      .then((d) => { if (alive) setMapData(d); })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [raceType]);

  const races = useMemo(() => mapData?.races || [], [mapData]);

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

  const selectRace = useCallback((districtId) => {
    const type = TYPE_BY_PREFIX[districtId.split('-')[0]];
    if (type && type !== raceType) setRaceType(type);
    setSelectedId(districtId);
  }, [raceType]);

  const lastUpdated = useMemo(() => {
    const ts = (ticker || []).map((t) => t.updated_at).filter(Boolean).sort();
    return ts[ts.length - 1] || null;
  }, [ticker]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">NC</span>
          <span className="brand-text">Race Signals <em>2026</em></span>
        </div>
        <p className="tagline">How voters, markets, and donors see North Carolina's competitive races.</p>
        <div className="topbar-right">
          {lastUpdated && <span className="updated dim">metric data updated {relativeTime(lastUpdated)}</span>}
          {isStatic && <span className="demo-badge">static demo</span>}
        </div>
      </header>

      <RaceTicker items={ticker} onSelect={selectRace} />

      {error && <div className="error-banner">Could not load data: {error}</div>}

      <main className="layout">
        <section className="map-column">
          <div className="map-toolbar">
            <RaceTypeToggle value={raceType} onChange={setRaceType} counts={meta?.race_types?.reduce((acc, r) => ({ ...acc, [r.race_type]: r }), {})} />
            <label className="race-picker">
              <span className="race-picker-label dim">Jump to race</span>
              <select
                value={selectedId || ''}
                onChange={(e) => setSelectedId(e.target.value || null)}
                disabled={races.length === 0}
              >
                <option value="">{races.length ? 'Select a competitive race…' : 'Loading races…'}</option>
                {races.map((r) => {
                  const sig = primarySignal(r);
                  const tag = sig.metric ? `${sig.metric.toLowerCase()} ${sig.advantage?.label || ''}` : 'no signal';
                  return <option key={r.district_id} value={r.district_id}>{r.district_id} — {tag.trim()}</option>;
                })}
              </select>
            </label>
          </div>
          <NCMap
            features={mapData?.features || []}
            races={races}
            outline={outline}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="map-help dim">
            Competitive districts are colored by their primary signal (polls → markets → money); grey districts are not rated competitive this cycle.
            Hover for details, click to open a race, scroll to zoom, drag to pan.
          </div>
        </section>

        <RacePanel race={detail} loading={loadingDetail} onClose={() => setSelectedId(null)} />
      </main>
    </div>
  );
}