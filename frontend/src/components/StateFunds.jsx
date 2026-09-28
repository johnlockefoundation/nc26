// Widget: candidate money for a state legislative race.
// PLACEHOLDER DATA. is_mock comes straight from the API and renders as a
// visible banner, so a placeholder total can never be read as a filing.
function money(v) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

function signed(v) {
  if (v == null) return '—';
  return v > 0 ? `+${v}` : `${v}`;
}

export default function StateFunds({ funds }) {
  if (!funds || !funds.available) {
    return (
      <section className="panel-section">
        <h3>CAMPAIGN MONEY</h3>
        <div className="dim">No filings data for this race yet.</div>
      </section>
    );
  }

  const dem = funds.candidates.find((c) => c.party === 'D');
  const rep = funds.candidates.find((c) => c.party === 'R');

  return (
    <section className="panel-section">
      <h3>
        {funds.source_url ? (
          <a className="section-link" href={funds.source_url} target="_blank" rel="noreferrer" title="NC campaign finance search">CAMPAIGN MONEY ↗</a>
        ) : (
          'CAMPAIGN MONEY'
        )}
      </h3>

      {funds.is_mock && (
        <div className="mock-banner" role="note">
          PLACEHOLDER FIGURES — not NC SBOE filings
        </div>
      )}

      <div className="funds-bars">
        {funds.candidates.map((c) => {
          const cls = c.party === 'D' ? 'funds-fill-d' : 'funds-fill-r';
          return (
            <div key={c.candidate_id} className="funds-row">
              <div className="funds-row-head">
                <span className={`funds-name cand-${String(c.party).toLowerCase()}`}>{c.name}</span>
                <span className="funds-amount">{money(c.total_raised)}</span>
              </div>
              <div className="funds-track">
                <i className={cls} style={{ width: `${c.share_of_total ?? 0}%` }} />
              </div>
              <div className="funds-meta">
                {c.contributions != null ? <span>{c.contributions.toLocaleString('en-US')} contributions</span> : null}
                {c.cash_on_hand != null ? <span> · {money(c.cash_on_hand)} on hand</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      {dem && rep && (
        <div className="funds-tally">
          {rep.total_raised > dem.total_raised ? (
            <>
              <b className="cand-r">{rep.name.split(' ').pop()}</b> has raised {money(Math.abs(rep.total_raised - dem.total_raised))} more
            </>
          ) : dem.total_raised > rep.total_raised ? (
            <>
              <b className="cand-d">{dem.name.split(' ').pop()}</b> has raised {money(Math.abs(dem.total_raised - rep.total_raised))} more
            </>
          ) : (
            <>Raised {money(dem.total_raised)} apiece</>
          )}
        </div>
      )}

      {funds.reporting_period && <div className="dim funds-period">{funds.reporting_period}</div>}
    </section>
  );
}
