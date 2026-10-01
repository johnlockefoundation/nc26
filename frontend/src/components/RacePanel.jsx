import MetricBlock from './MetricBlock.jsx';
import CivitasPartisan from './CivitasPartisan.jsx';
import Demographics from './Demographics.jsx';
import MoneyBlock from './MoneyBlock.jsx';
import { Registration, Ballot } from './VoterVelocity.jsx';
import DistrictNews from './DistrictNews.jsx';

// Two letters off the front and last name. Parenthetical nicknames are dropped
// rather than counted: a name stored as "Jessica (Jess) Rivera" would otherwise
// yield "J(", and the seed data carries that form for candidates who use it on
// the ballot. Suffixes and middle initials are kept, so "James M. Rogers" is JR
// and "Robert J. Jackson III" is RJ.
function initials(name) {
  return (name || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w[0] || ''))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
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
  // party-aggregate fundraising summary. Both are shaped the same way, so
  // MoneyBlock renders either without knowing which it has.
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
  // when its dataset is absent, so the list needs no filtering here. MONEY sits
  // with them because it folds the same way; only the right-hand slot differs.
  const disclosureBlocks = [<Demographics key="demographics" profile={race.profile} />];
  if (race.vitals?.available) {
    disclosureBlocks.push(<Registration key="registration" vitals={race.vitals} />);
    disclosureBlocks.push(<Ballot key="ballot" vitals={race.vitals} />);
  }

  // MONEY reads its totals from state_funds on a General Assembly seat and from
  // the federal fundraising summary on a congressional one; both are shaped alike.
  const money = (
    <MoneyBlock
      key="money"
      summary={moneyS}
      candidates={race.candidates}
    />
  );

  return (
    <aside className="panel">
      <h2 className="panel-title">{race.title}</h2>
      <CandidateCards candidates={race.candidates} />

      {/* One stack for every chamber. News sits inside it rather than below it,
          so the box above a story is the same width and aligned with the box
          below it instead of floating under a section heading. */}
      <div className="metrics">
        {isStateRace && <CivitasPartisan partisan={race.partisan} />}
        {!isStateRace && showFullPanel && (
          <MetricBlock title="POLLS" emptyText="NO POLLING" summary={polls} />
        )}
        {marketBlocks}
        {money}
        {disclosureBlocks}
        <DistrictNews articles={race.news} />
      </div>
    </aside>
  );
}