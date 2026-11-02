import { useEffect, useMemo, useState } from 'react';
import { getMap, getBallots, assetUrl } from './api.js';
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

  const sorted = useMemo(() => {
    if (raceType === 'congress') {
      const senate = races.filter((r) => r.race_type === 'us_senate');
      const house = [...races.filter((r) => r.race_type === 'us_house')].sort((a, b) => {
        const pa = a.polls && a.polls.available && a.polls.advantage ? Math.abs(a.polls.advantage.value) : 9999;
        const pb = b.polls && b.polls.available && b.polls.advantage ? Math.abs(b.polls.advantage.value) : 9999;
        if (pa !== pb) return pa - pb;
        const ba = ballotAdvantage(ballots[a.district_id]);
        const bb = ballotAdvantage(ballots[b.district_id]);
        const va = ba ? Math.abs(ba.value) : 9999;
        const vb = bb ? Math.abs(bb.value) : 9999;
        if (va !== vb) return va - vb;
        return (a.district_number ?? 0) - (b.district_number ?? 0);
      });
      return { senate, house };
    }
    const all = [...races].sort((a, b) => {
      const pa = a.partisan && a.partisan.available && typeof a.partisan.value === 'number' ? Math.abs(a.partisan.value) : 9999;
      const pb = b.partisan && b.partisan.available && typeof b.partisan.value === 'number' ? Math.abs(b.partisan.value) : 9999;
      const ca = a.competitive ? 0 : 1;
      const cb = b.competitive ? 0 : 1;
      if (ca !== cb) return ca - cb;
      if (pa !== pb) return pa - pb;
      return (a.district_number ?? 0) - (b.district_number ?? 0);
    });
    return { all };
  }, [races, raceType, ballots]);

  const renderPill = (r) => {
    const cands = r.candidates || [];
    const matchupParts = cands.map((c, i) => (
      <span key={c.candidate_id || i}>
        {i > 0 && <span className="turnout-vs"> v </span>}
        <span className={`turnout-cand party-${String(c.party).toLowerCase()}`}>{String(c.name).toUpperCase()}</span>
      </span>
    ));
    const b = ballots[r.district_id];
    const adv = ballotAdvantage(b);
    const advCls = adv ? (adv.party === 'D' ? 'val-d' : adv.party === 'R' ? 'val-r' : '') : '';
    const isStateRace = r.race_type === 'state_senate' || r.race_type === 'state_house';
    const polls = r.polls || {};
    const pollAdv = polls.available && polls.advantage ? polls.advantage : null;
    const pollCls = pollAdv ? (pollAdv.party === 'D' ? 'val-d' : pollAdv.party === 'R' ? 'val-r' : '') : '';
    // State races have no polling; use the Civitas partisan index as the second figure.
    const civ = isStateRace && r.partisan && r.partisan.available ? r.partisan : null;
    const civCls = civ ? (civ.party === 'D' ? 'val-d' : civ.party === 'R' ? 'val-r' : '') : '';
    const secondAdv = isStateRace ? civ : pollAdv;
    const secondCls = isStateRace ? civCls : pollCls;
    const secondTitle = isStateRace ? 'Civitas partisan index' : 'Poll average (federal only)';
    const secondLabel = isStateRace ? (civ ? civ.label : '—') : (pollAdv ? pollAdv.label : '—');
    return (
      <details key={r.district_id} className="turnout-pill">
        <summary className="turnout-pill-summary">
          <span className="turnout-matchup">{matchupParts}</span>
          <span className="turnout-figs">
            <span className={`turnout-lead ${secondCls}`} title={secondTitle}>{secondLabel}</span>
            <span className={`turnout-lead ${advCls}`} title="Requested ballot partisan split">{adv ? adv.label : '—'}</span>
          </span>
        </summary>
        <div className="turnout-pill-body">
          <BallotBreakdown ballot={b} />
          {isStateRace && civ ? (
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
              Civitas: {civ.label} · {civ.lean}
            </div>
          ) : null}
          {!isStateRace && polls.available && polls.n_polls ? (
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
              Polls: {polls.n_polls} poll{polls.n_polls === 1 ? '' : 's'}
              {polls.span_start && polls.span_end ? ` · ${polls.span_start} → ${polls.span_end}` : ''}
            </div>
          ) : null}
        </div>
      </details>
    );
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand-title">
          <a className="brand-link" href="./" title="Back to the map">
            Polls vs Ballots
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
            <span>MATCHUP</span><span>{isState ? 'CIVITAS INDEX' : 'POLL LEAD'}</span><span>BALLOT LEAD</span>
          </div>
          <div className="turnout-list">
            {(sorted.senate || []).map((r) => renderPill(r, ballots))}
          </div>
          <div className="turnout-section-title">U.S. HOUSE</div>
          <div className="turnout-header">
            <span>MATCHUP</span><span>{isState ? 'CIVITAS INDEX' : 'POLL LEAD'}</span><span>BALLOT LEAD</span>
          </div>
          <div className="turnout-list">
            {(sorted.house || []).map((r) => renderPill(r, ballots))}
          </div>
        </>
      ) : (
        <>
          <div className="turnout-header">
            <span>MATCHUP</span><span>{isState ? 'CIVITAS INDEX' : 'POLL LEAD'}</span><span>BALLOT LEAD</span>
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