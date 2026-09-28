import MetricBlock from './MetricBlock.jsx';
import DistrictProfile from './DistrictProfile.jsx';
import CivitasPartisan from './CivitasPartisan.jsx';
import DistrictNews from './DistrictNews.jsx';

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function CandidateCards({ candidates }) {
  if (!candidates || candidates.length === 0) return <div className="candidate-list dim">Candidates not yet available.</div>;
  return (
    <div className="candidate-list">
      {candidates.map((c) => (
        <div key={c.candidate_id} className="candidate-card">
          <div className="candidate-photo">
            {c.photo_url ? (
              <img src={c.photo_url} alt={`${c.name} (${c.party})`} loading="lazy" />
            ) : (
              <span className="candidate-initials">{initials(c.name)}</span>
            )}
            <span className={`candidate-party party-${String(c.party).toLowerCase()}`}>{c.party}</span>
          </div>
          <div className={`candidate-name cand-${String(c.party).toLowerCase()}`}>{c.name}</div>
          {c.website && (
            <a className="candidate-site" href={c.website} target="_blank" rel="noreferrer">website ↗</a>
          )}
        </div>
      ))}
    </div>
  );
}

export default function RacePanel({ race, loading }) {
  if (loading && !race) {
    return <aside className="panel"><div className="panel-loading">Loading race…</div></aside>;
  }
  if (!race) return null;

  const polls = race.polls || {};
  const markets = race.markets || {};
  // State races read their money from state_funds; federal races use the
  // party-aggregate fundraising summary. Both are shaped the same way, so the
  // same MetricBlock renders either.
  const moneyS = race.state_funds || race.money || {};
  const marketList = race.market_list || (markets.available ? [markets] : []);
  const isStateRace = race.race_type === 'state_senate' || race.race_type === 'state_house';

  // Whether a race carries anything beyond a market quote. Every in-play
  // senate seat except NC is a shell with a single Kalshi contract, and
  // rendering four empty blocks for those says more about the pipeline than
  // the race. This reads the payload rather than hardcoding a district, so a
  // seat that later picks up polling or money fills in on its own.
  const hasSubstance = Boolean(polls.available || moneyS.available);
  const marketBlocks = marketList.map((m) => (
    <MetricBlock
      key={m.provider}
      title={(m.provider || 'MARKET').toUpperCase()}
      emptyText="NO MARKET"
      summary={m}
      delta={m.delta}
    />
  ));
  const showFullPanel = !isStateRace && hasSubstance;
  // Per-seat coverage is an NC product. The out-of-state Senate seats are
  // carried on a price alone, so a coverage list there would be an empty
  // heading every time. DistrictNews renders nothing when it has no stories,
  // so this only has to exclude the seats that should never show it.
  const showNews = race.race_type !== 'us_senate' || race.district_id === 'NC-SEN';

  return (
    <aside className="panel">
      <h2 className="panel-title">{race.title}</h2>
      <CandidateCards candidates={race.candidates} />

      {isStateRace ? (
        <>
          <CivitasPartisan partisan={race.partisan} />
          <div className="metrics">
            <MetricBlock title="MONEY" emptyText="NO MONEY" summary={moneyS} />
          </div>
          {race.state_funds?.is_mock && (
            <div className="mock-note" role="note">PLACEHOLDER FIGURES — not NC SBOE filings</div>
          )}
          {showNews && <DistrictNews articles={race.news} />}
        </>
      ) : showFullPanel ? (
        <div className="metrics">
          <MetricBlock title="POLLS" emptyText="NO POLLING" summary={polls} />
          {marketBlocks}
          <MetricBlock title="MONEY" emptyText="NO MONEY" summary={moneyS} />
        </div>
      ) : (
        <div className="metrics">{marketBlocks}</div>
      )}

      {!isStateRace && <DistrictProfile profile={race.profile} />}
      {!isStateRace && showNews && <DistrictNews articles={race.news} />}
    </aside>
  );
}