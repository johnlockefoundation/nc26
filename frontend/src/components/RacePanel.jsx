import MetricBlock from './MetricBlock.jsx';
import CivitasPartisan from './CivitasPartisan.jsx';
import Demographics from './Demographics.jsx';
import { Registration, Ballot } from './VoterVelocity.jsx';
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

  // Whether a race carries anything beyond a market quote. A seat with only a
  // price would otherwise render four empty blocks, which says more about the
  // pipeline than about the race. This reads the payload rather than hardcoding
  // a district, so a seat that later picks up polling or money fills in on its
  // own.
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

  // Three independent disclosures, in one list, so a reader can open any of them
  // without the others. Which of them a seat gets is decided by the payload
  // rather than hardcoded per district: federal seats carry the Census profile,
  // General Assembly seats carry the two velocity blocks, and a seat that later
  // picks up another dataset grows its own block. Each returns null on its own
  // when its dataset is absent, so the list needs no filtering here.
  const disclosureBlocks = [<Demographics key="demographics" profile={race.profile} />];
  if (race.vitals?.available) {
    disclosureBlocks.push(<Registration key="registration" vitals={race.vitals} />);
    disclosureBlocks.push(<Ballot key="ballot" vitals={race.vitals} />);
  }

  return (
    <aside className="panel">
      <h2 className="panel-title">{race.title}</h2>
      <CandidateCards candidates={race.candidates} />

      {isStateRace ? (
        <>
          {/* One disclaimer for every placeholder figure on a state race,
              sitting directly above the blocks they qualify. */}
          {(race.state_funds?.is_mock || race.vitals?.is_mock) && (
            <p className="data-disclaimer" role="note">
              Campaign money and voter figures below are placeholders, not NC SBOE records.
            </p>
          )}
          <div className="metrics">
            <CivitasPartisan partisan={race.partisan} />
            <MetricBlock title="MONEY" emptyText="NO MONEY" summary={moneyS} />
            {disclosureBlocks}
          </div>
          <DistrictNews articles={race.news} />
        </>
      ) : showFullPanel ? (
        <div className="metrics">
          <MetricBlock title="POLLS" emptyText="NO POLLING" summary={polls} />
          {marketBlocks}
          <MetricBlock title="MONEY" emptyText="NO MONEY" summary={moneyS} />
          {disclosureBlocks}
        </div>
      ) : (
        <div className="metrics">
          {marketBlocks}
          {disclosureBlocks}
        </div>
      )}

      {!isStateRace && <DistrictNews articles={race.news} />}
    </aside>
  );
}