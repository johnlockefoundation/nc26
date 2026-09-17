import { useEffect, useState } from 'react';
import MetricBlock from './MetricBlock.jsx';
import NewsList from './NewsList.jsx';
import { relativeTime, fullDate, money, percent, pollDates } from '../lib/format.js';

function CandidateLine({ candidates }) {
  if (!candidates || candidates.length === 0) return <div className="panel-candidates dim">Candidates not yet available.</div>;
  return (
    <div className="panel-candidates">
      {candidates.map((c, i) => (
        <span key={c.candidate_id || i} className={`cand cand-${c.party}`}>
          {c.name} ({c.party}{c.incumbent ? ', inc.' : ''})
          {i < candidates.length - 1 ? <span className="vs"> vs. </span> : null}
        </span>
      ))}
    </div>
  );
}

export default function RacePanel({ race, loading, onClose }) {
  const [showPolls, setShowPolls] = useState(false);
  useEffect(() => setShowPolls(false), [race?.district_id]);

  if (loading && !race) {
    return <aside className="panel"><div className="panel-loading">Loading race…</div></aside>;
  }
  if (!race) return null;

  const polls = race.polls || {};
  const markets = race.markets || {};
  const moneyS = race.money || {};
  const pollDetail = race.poll_detail || [];

  return (
    <aside className="panel">
      <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
      <div className="panel-eyebrow">{race.race_type.replace('_', ' ')}</div>
      <h2 className="panel-title">{race.title}</h2>
      <CandidateLine candidates={race.candidates} />
      {race.competitive && race.competitive_reason && (
        <div className="panel-note">
          <span className="badge">competitive</span> {race.competitive_reason}
        </div>
      )}

      <div className="metrics">
        <MetricBlock
          title="POLLS"
          emptyText="NO POLLING"
          summary={polls}
          metaLines={polls.available
            ? [`Avg of ${polls.n_polls || 0} poll${polls.n_polls === 1 ? '' : 's'}`, `Updated ${relativeTime(polls.updated_at)}`]
            : []}
          onOpen={pollDetail.length ? () => setShowPolls((s) => !s) : null}
          open={showPolls}
          openLabel={`View ${pollDetail.length} poll${pollDetail.length === 1 ? '' : 's'}`}
        >
          <table className="poll-table">
            <thead>
              <tr><th>Pollster</th><th>Field dates</th><th>N</th><th>Pop.</th><th>D</th><th>R</th><th>Margin</th></tr>
            </thead>
            <tbody>
              {pollDetail.map((p) => (
                <tr key={p.poll_id}>
                  <td>{p.source_url ? <a href={p.source_url} target="_blank" rel="noreferrer">{p.pollster}</a> : p.pollster}</td>
                  <td>{pollDates(p.start_date, p.end_date)}</td>
                  <td>{p.sample_size ?? '—'}</td>
                  <td>{p.population || '—'}</td>
                  <td className="d-cell">{percent(p.dem_share)}</td>
                  <td className="r-cell">{percent(p.rep_share)}</td>
                  <td>{(p.margin > 0 ? 'D +' : 'R +') + Math.abs(p.margin).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </MetricBlock>

        <MetricBlock
          title="MARKETS"
          emptyText="NO MARKET"
          summary={markets}
          metaLines={markets.available
            ? [
                `${markets.provider}: ${markets.dem_price}¢ D / ${markets.rep_price}¢ R`,
                `Updated ${relativeTime(markets.updated_at)}`,
                markets.is_seed ? <span className="seed-tag">baseline snapshot</span> : null,
              ].filter(Boolean)
            : []}
        />

        <MetricBlock
          title="MONEY"
          emptyText="NO MONEY"
          summary={moneyS}
          metaLines={moneyS.available
            ? [
                `D ${money(moneyS.dem_amount)} vs R ${money(moneyS.rep_amount)}`,
                moneyS.reporting_period || '',
                `Updated ${relativeTime(moneyS.updated_at)}`,
                moneyS.is_seed ? <span className="seed-tag">baseline data</span> : null,
              ].filter(Boolean)
            : []}
        />
      </div>

      <section className="panel-section">
        <h3>LATEST NEWS</h3>
        <NewsList articles={race.all_news && race.all_news.length ? race.all_news : race.news} limit={3} />
      </section>

      {(pollDetail.length > 0 || markets.source_url || moneyS.source_url) && (
        <section className="panel-section sources">
          <h3>SOURCES</h3>
          <ul>
            {pollDetail.length > 0 && <li>Polling average · {pollDetail.length} individual poll{pollDetail.length === 1 ? '' : 's'} stored</li>}
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