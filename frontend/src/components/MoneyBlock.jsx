// MONEY: the fundraising advantage while folded, the per-candidate totals and
// filings behind it while open.
//
// It was a plain MetricBlock until now, which meant the only link to the filing
// data was a dotted underline on the title pointing at whichever of the two
// candidates happened to be stored as the district's single source_url. That is
// the half of the race a reader is least able to check: the block showed a
// margin, and the link led to one side's record. A margin is exactly the number
// you verify by looking at both sides.
//
// So the box now folds, and opens onto a row per candidate -- the person's name,
// the total they raised, and a link to their own FEC page. A reader who doubts
// D +$22.7M can read both totals and open both filings.
//
// State legislative races render the same two rows, with the same totals, and
// with no link. There is no per-candidate filing behind them yet -- the figures
// are placeholders and the state_funds rows point at an NCSBE portal rather than
// at a filing -- so a link would invite a reader to verify something that is not
// there. The rows render as plain text instead, and picking that up later is a
// data change rather than a rendering one.

import CollapsibleMetric from './CollapsibleMetric.jsx';
import { money as fmtMoney } from '../lib/format.js';

const PARTY_LABEL = { D: 'DEM', R: 'REP' };

// One candidate's row. `href` is the candidate's own filing page; a row without
// one is rendered as a <div> rather than an <a>, so it is visibly not a link
// instead of being a dead one.
function MoneyRow({ candidate, party, figure }) {
  const name = candidate?.name || PARTY_LABEL[party] || party;
  const amount = figure?.amount != null ? fmtMoney(figure.amount) : '—';
  const href = figure?.source_url;

  const inner = (
    <>
      <span className="money-row-name">{name}</span>
      <span className="money-row-party">{PARTY_LABEL[party] || party}</span>
      <span className="money-row-amount">{amount}</span>
    </>
  );

  return href
    ? (
      <a className="money-row" href={href} target="_blank" rel="noreferrer"
        title={`Open ${name}'s FEC filing`}>
        {inner}
      </a>
    )
    : (
      <div className="money-row">
        {inner}
        <span className="money-row-note">no filing on file</span>
      </div>
    );
}

export default function MoneyBlock({ summary, candidates }) {
  const available = Boolean(summary?.available && summary?.advantage);
  if (!available) return null;

  const byParty = summary.by_party || {};
  // Candidates carry the names; the money rows carry the totals and the links.
  // Joining on party is what ties "D +$4.1M" to a person rather than to a letter.
  const byPartyCandidate = {};
  for (const c of candidates || []) {
    if (c && c.party && !byPartyCandidate[c.party]) byPartyCandidate[c.party] = c;
  }
  const parties = Object.keys(byParty).sort();

  // Same colour coding the other metric boxes use: the folded figure carries the
  // party that is ahead, so the advantage is legible without opening the box.
  // MetricBlock applies val-d/val-r the same way, and the rule that fixes it is
  // .metric-value.val-d / .val-r.
  const party = summary.advantage.party;
  const valueCls = party === 'D' ? 'val-d' : party === 'R' ? 'val-r' : '';
  const value = (
    <span className={`metric-value collapsible-metric-value ${valueCls}`}>
      {summary.advantage.label}
    </span>
  );

  return (
    <CollapsibleMetric title="MONEY" value={value}>
      {parties.length > 0 && (
        <div className="money-rows">
          {parties.map((p) => (
            <MoneyRow
              key={p}
              party={p}
              candidate={byPartyCandidate[p]}
              figure={byParty[p]}
            />
          ))}
        </div>
      )}
      {summary.reporting_period ? (
        <div className="money-foot dim">{summary.reporting_period}</div>
      ) : null}
    </CollapsibleMetric>
  );
}
