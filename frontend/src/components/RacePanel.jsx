import MetricBlock from './MetricBlock.jsx';
import CivitasPartisan from './CivitasPartisan.jsx';
import Demographics from './Demographics.jsx';
import MoneyBlock from './MoneyBlock.jsx';
import PollBlock from './PollBlock.jsx';
import { Registration, Ballot } from './VoterVelocity.jsx';
import DistrictNews from './DistrictNews.jsx';
import { initials } from '../lib/candidateName.js';

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

  // One block per provider. A seat with no market gets none, rather than a box
  // reading NO MARKET, for the same reason PollBlock stays silent when there is
  // no polling: the blocks that carry a figure should not be buried under the
  // ones that do not.
  const marketBlocks = marketList.map((m) => (
    <MetricBlock
      key={m.provider}
      title={(m.provider || 'MARKET').toUpperCase()}
      emptyText="NO MARKET"
      summary={m}
      delta={m.delta}
    />
  ));

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
        {/* Not gated on the chamber and not gated on hasSubstance: PollBlock
            decides for itself, and returns null when the seat has no polling.
            A hardcoded chamber test here would silently swallow a state-legislative
            poll the day someone seeded one, which is the opposite of what the
            rest of this file does -- every block reads the payload. */}
        <PollBlock polls={polls} />
        {marketBlocks}
        {money}
        {disclosureBlocks}
        <DistrictNews articles={race.news} />
      </div>
    </aside>
  );
}