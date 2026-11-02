import { useEffect, useMemo, useState } from 'react';
import { getMap, getBallot, assetUrl } from './api.js';
import { trackerUrl } from './lib/tracker.js';

const CHAMBERS = [
  { key: 'congress', label: 'Congress' },
  { key: 'state_senate', label: 'NC Senate' },
  { key: 'state_house', label: 'NC House' },
];

const FETCH_KEYS = {
  congress: ['us_house', 'us_senate'],
  state_senate: ['state_senate'],
  state_house: ['state_house'],
};

function ballotAdvantage(b) {
  if (!b || !b.available || !b.ballot?.advantage) return null;
  return b.ballot.advantage;
}

function sortRaces(races, mode) {
  const arr = [...(races || [])];
  const civitasKey = (r) => {
    const p = r.partisan;
    const val = p && p.available && typeof p.value === 'number' ? Math.abs(p.value) : 9999;
    const comp = r.competitive ? 0 : 1;
    return [comp, val, r.district_number ?? 0];
  };
  const kalshiKey = (r) => {
    const m = r.markets;
    const has = !!(m && m.available);
    const spread = has && typeof m.advantage?.value === 'number' ? m.advantage.value : 9999;
    return [has ? 0 : 1, spread, r.district_number ?? 0];
  };
  const keyFn = mode === 'kalshi' ? kalshiKey : civitasKey;
  arr.sort((a, b) => {
    const ka = keyFn(a), kb = keyFn(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });
  return arr;
}

function BallotBreakdown({ ballot }) {
  if (!ballot || !ballot.available) {
    return <div className="dim" style={{ fontSize: 12, padding: '6px 0' }}>No ballot data yet.</div>;
  }
  const b = ballot.ballot || {};
  const by = b.by_party || {};
  const total = b.current_total || 0;
  const pct = (n) => (total > 0 && n != null ? `${(100 * n / total).toFixed(1)}%` : '—');
  return (
    <div style={{ padding: '8px 0' }}>
      <div className="ballot-rows">
        {[['dem', 'DEM'], ['rep', 'REP'], ['unaff', 'UNA']].map(([k, label]) => (
          <div key={k} className="ballot-row">
            <span className="ballot-row-party">{label}</span>
            <span className="ballot-row-share">{pct(by[k])}</span>
            <span className="ballot-row-count">{(by[k] ?? 0).toLocaleString()}</span>
          </div>
        ))}
        <div className="ballot-row ballot-row-total">
          <span className="ballot-row-party">TOTAL</span>
          <span className="ballot-row-share">{total > 0 ? '100%' : '—'}</span>
          <span className="ballot-row-count">{total.toLocaleString()}</span>
        </div>
      </div>
      {b.advantage && (
        <div className="ballot-foot dim" style={{ marginTop: 6 }}>
          {b.advantage.label} · {b.advantage.party === 'D' ? 'D' : 'R'} lead · ballot requests so far
        </div>
      )}
      {ballot.snapshot_date && (
        <div className="dim" style={{ fontSize: 10.5, marginTop: 4 }}>As of {ballot.snapshot_date}</div>
      )}
    </div>
  );
}

export default function ElectionPage() {
  const [raceType, setRaceType] = useState('us_house');
  const [sortMode, setSortMode] = useState('civitas');
  const isState = raceType === 'state_senate' || raceType === 'state_house';
  const [mapData, setMapData] = useState(null);
  const [ballots, setBallots] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isState) setSortMode('civitas');
  }, [isState]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setMapData(null);
    setBallots({});
    const keys = FETCH_KEYS[raceType] || [raceType];
    Promise.all(keys.map((k) => getMap(k)))
      .then((results) => {
        if (!alive) return;
        const merged = results.flatMap((d) => d?.races || []);
        setMapData({ race_type: raceType, races: merged, features: results.flatMap((d) => d?.features || []) });
      })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [raceType]);

  const races = useMemo(() => mapData?.races || [], [mapData]);

  // Fetch ballot summaries for all races in this chamber.
  useEffect(() => {
    if (!races.length) return;
    let alive = true;
    races.forEach((r) => {
      getBallot(r.district_id)
        .then((b) => { if (alive) setBallots((prev) => ({ ...prev, [r.district_id]: b })); })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [races]);

  const sorted = useMemo(() => sortRaces(races, sortMode), [races, sortMode]);

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand-title">
          <a className="brand-link" href="./" title="Back to the map">
            Live turnout tracker
          </a>
        </h1>
      </header>

      {error && <div className="error-banner">Could not load data: {error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <div className="view-toggle" role="group" aria-label="Chamber">
          {CHAMBERS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`view-toggle-btn ${raceType === c.key ? 'active' : ''}`}
              aria-pressed={raceType === c.key}
              onClick={() => setRaceType(c.key)}
            >
              {c.label.toUpperCase()}
            </button>
          ))}
        </div>
        {!isState && (
          <div className="view-toggle" role="group" aria-label="Sort">
            <button
              type="button"
              className={`view-toggle-btn ${sortMode === 'civitas' ? 'active' : ''}`}
              aria-pressed={sortMode === 'civitas'}
              onClick={() => setSortMode('civitas')}
            >
              CIVITAS
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${sortMode === 'kalshi' ? 'active' : ''}`}
              aria-pressed={sortMode === 'kalshi'}
              onClick={() => setSortMode('kalshi')}
            >
              KALSHI
            </button>
          </div>
        )}
      </div>

      {loading && <div className="panel-loading">Loading…</div>}

      <div className="turnout-list">
        {sorted.map((r) => {
          const cands = r.candidates || [];
          const matchup = cands.map((c) => String(c.name).toUpperCase()).join(' v ');
          const b = ballots[r.district_id];
          const adv = ballotAdvantage(b);
          const advCls = adv ? (adv.party === 'D' ? 'val-d' : adv.party === 'R' ? 'val-r' : '') : '';
          return (
            <details key={r.district_id} className="turnout-pill">
              <summary className="turnout-pill-summary">
                <span className="turnout-matchup">{matchup}</span>
                <span className={`turnout-lead ${advCls}`}>{adv ? adv.label : '—'}</span>
              </summary>
              <div className="turnout-pill-body">
                <BallotBreakdown ballot={b} />
              </div>
            </details>
          );
        })}
      </div>

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