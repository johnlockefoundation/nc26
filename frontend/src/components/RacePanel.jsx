import MetricBlock from './MetricBlock.jsx';
import NewsList from './NewsList.jsx';
import { fullDate } from '../lib/format.js';

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

export default function RacePanel({ race, loading, onClose }) {
  if (loading && !race) {
    return <aside className="panel"><div className="panel-loading">Loading race…</div></aside>;
  }
  if (!race) return null;

  const polls = race.polls || {};
  const markets = race.markets || {};
  const moneyS = race.money || {};

  return (
    <aside className="panel">
      <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
      <h2 className="panel-title">{race.title}</h2>
      <CandidateCards candidates={race.candidates} />

      <div className="metrics">
        <MetricBlock title="POLLS" emptyText="NO POLLING" summary={polls} />
        <MetricBlock title="MARKETS" emptyText="NO MARKET" summary={markets} />
        <MetricBlock title="MONEY" emptyText="NO MONEY" summary={moneyS} />
      </div>

      <section className="panel-section">
        <h3>LATEST NEWS</h3>
        <NewsList articles={race.all_news && race.all_news.length ? race.all_news : race.news} limit={3} />
      </section>

      {(markets.source_url || moneyS.source_url) && (
        <section className="panel-section sources">
          <h3>SOURCES</h3>
          <ul>
            {markets.available && <li>{markets.provider} prediction market · {markets.source_url ? <a href={markets.source_url} target="_blank" rel="noreferrer">view source</a> : 'source pending'}</li>}
            {moneyS.available && (
              <li>
                Fundraising ({moneyS.method || 'total receipts'}) · {fullDate(moneyS.updated_at)}
                {moneyS.source_url ? <> · <a href={moneyS.source_url} target="_blank" rel="noreferrer">view source</a></> : null}
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="panel-footer">
        <div className="dim">Race selection source: {race.competitive_source || '—'}</div>
      </div>
    </aside>
  );
}