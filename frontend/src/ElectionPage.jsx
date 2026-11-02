import { useEffect, useMemo, useState } from 'react';
import { getMap, getBallots, getMovs, assetUrl } from './api.js';
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
  const [raceType, setRaceType] = useState('congress');
  const isState = raceType === 'state_senate' || raceType === 'state_house';
  const [mapData, setMapData] = useState(null);
  const [ballots, setBallots] = useState({});
  const [movs, setMovs] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setMapData(null);
    setBallots({});
    setMovs({});
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

  // Fetch ballot summaries for the whole chamber in one round trip.
  useEffect(() => {
    if (!races.length) return;
    let alive = true;
    const keys = FETCH_KEYS[raceType] || [raceType];
    Promise.all(keys.map((k) => getBallots(k)))
      .then((results) => {
        if (!alive) return;
        const merged = Object.assign({}, ...results);
        setBallots(merged);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [races, raceType]);

  // Fetch margin-of-victory (Kalshi MOV) for federal races.
  useEffect(() => {
    if (raceType !== 'congress') return;
    if (!races.length) return;
    let alive = true;
    Promise.all(['us_house', 'us_senate'].map((k) => getMovs(k)))
      .then((results) => {
        if (!alive) return;
        setMovs(Object.assign({}, ...results));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [races, raceType]);

  const sorted = useMemo(() => {
    if (raceType === 'congress') {
      const senate = races.filter((r) => r.race_type === 'us_senate');
      const house = [...races.filter((r) => r.race_type === 'us_house')].sort((a, b) => {
        const ma = movs[a.district_id]; const mb = movs[b.district_id];
        const va = ma && ma.available && typeof ma.margin === 'number' ? Math.abs(ma.margin) : 9999;
        const vb = mb && mb.available && typeof mb.margin === 'number' ? Math.abs(mb.margin) : 9999;
        if (va !== vb) return va - vb;
        return (a.district_number ?? 0) - (b.district_number ?? 0);
      });
      return { senate, house };
    }
    return { all: sortRaces(races, 'civitas') };
  }, [races, raceType, movs]);

  const renderPill = (r) => {
    const cands = r.candidates || [];
    const matchup = cands.map((c) => String(c.name).toUpperCase()).join(' v ');
    const b = ballots[r.district_id];
    const adv = ballotAdvantage(b);
    const advCls = adv ? (adv.party === 'D' ? 'val-d' : adv.party === 'R' ? 'val-r' : '') : '';
    // Federal races carry a Kalshi margin; state races carry the Civitas partisan index.
    const isStateRace = r.race_type === 'state_senate' || r.race_type === 'state_house';
    let mm = null;
    let mmCls = '';
    let mmTitle = '';
    if (isStateRace) {
      const p = r.partisan;
      if (p && p.available) {
        mm = { party: p.party, label: p.label };
        mmCls = p.party === 'D' ? 'val-d' : p.party === 'R' ? 'val-r' : '';
      }
      mmTitle = 'Civitas margin';
    } else {
      const mv = movs[r.district_id];
      if (mv && mv.available) {
        mm = { party: mv.party, label: mv.party + ' +' + mv.margin, value: mv.margin };
        mmCls = mv.party === 'D' ? 'val-d' : mv.party === 'R' ? 'val-r' : '';
      }
      mmTitle = 'MOV';
    }
    return (
      <details key={r.district_id} className="turnout-pill">
        <summary className="turnout-pill-summary">
          <span className="turnout-matchup">{matchup}</span>
          <span className="turnout-figs">
            <span className={`turnout-lead ${advCls}`} title="Requested ballot partisan split (as of snapshot date)">{adv ? adv.label : '—'}</span>
            <span className={`turnout-lead ${mmCls}`} title="Kalshi predicted margin of victory">{mm ? mm.label : '—'}</span>
          </span>
        </summary>
        <div className="turnout-pill-body">
          <BallotBreakdown ballot={b} />
          {mm && (
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
              {mmTitle}: <span className={mmCls}>{mm.label}</span>
            </div>
          )}
        </div>
      </details>
    );
  };

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
      </div>
      {loading && <div className="panel-loading">Loading…</div>}

      {raceType === 'congress' ? (
        <>
          <div className="turnout-section-title">U.S. SENATE</div>
          <div className="turnout-header">
            <span>MATCHUP</span><span>BALLOT LEAD</span><span>{isState ? 'CIVITAS INDEX' : 'KALSHI PREDICTED MOV'}</span>
          </div>
          <div className="turnout-list">
            {(sorted.senate || []).map((r) => renderPill(r, ballots))}
          </div>
          <div className="turnout-section-title">U.S. HOUSE</div>
          <div className="turnout-header">
            <span>MATCHUP</span><span>BALLOT LEAD</span><span>{isState ? 'CIVITAS INDEX' : 'KALSHI PREDICTED MOV'}</span>
          </div>
          <div className="turnout-list">
            {(sorted.house || []).map((r) => renderPill(r, ballots))}
          </div>
        </>
      ) : (
        <>
          <div className="turnout-header">
            <span>MATCHUP</span><span>BALLOT LEAD</span><span>{isState ? 'CIVITAS INDEX' : 'KALSHI PREDICTED MOV'}</span>
          </div>
          <div className="turnout-list">
            {(sorted.all || []).map((r) => renderPill(r, ballots))}
          </div>
        </>
      )}

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