import MetricBlock from './MetricBlock.jsx';
import DistrictProfile from './DistrictProfile.jsx';

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
  const moneyS = race.money || {};

  return (
    <aside className="panel">
      <h2 className="panel-title">{race.title}</h2>
      <CandidateCards candidates={race.candidates} />

      <div className="metrics">
        <MetricBlock title="POLLS" emptyText="NO POLLING" summary={polls} />
        <MetricBlock title="MARKETS" emptyText="NO MARKET" summary={markets} />
        <MetricBlock title="MONEY" emptyText="NO MONEY" summary={moneyS} />
      </div>

      <DistrictProfile profile={race.profile} />
    </aside>
  );
}