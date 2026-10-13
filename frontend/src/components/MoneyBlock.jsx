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
// State legislative races render the same two rows, with the same totals, and a
// link to each candidate's filing on the NCSBE portal -- the report-sections page
// for the exact report the figure came from. That URL is the report id, carried
// in state_funds.source_url and passed through per party by
// state_funds_summary(). A row whose source_url is empty still renders as plain
// text rather than a dead link, which is what the bundled reference did for
// every state seat before the NCSBE summaries were loaded.
//
// A contested General Assembly race with only one committee's money folds to a
// blank headline. The "advantage" there differences the one filing against an
// opponent who simply has no report, which is the fabricated zero by_party was
// reshaped to avoid: "R +$382K" reads as a margin over a Democrat who raised
// nothing, when the truth is that no Democratic filing exists. The one real
// total is still a fact, so it stays visible behind the caret; it is the folded
// margin that would be a lie. An uncontested seat (one candidate) keeps its
// figure -- there is no second side for the number to be misread as a margin
// against.
//
// Only the state path reaches this. money_summary() always emits both a 'D' and
// an 'R' key, so a single present party is structurally a General Assembly seat,
// where by_party is keyed by the committees that actually filed.

import CollapsibleMetric from './CollapsibleMetric.jsx';
import { money as fmtMoney } from '../lib/format.js';

const PARTY_LABEL = { D: 'DEM', R: 'REP' };

// One candidate's row. `href` is the candidate's own filing page -- their FEC
// committee page on a federal seat, their NCSBE report-sections page on a state
// one; a row without one is rendered as a <div> rather than an <a>, so it is
// visibly not a link instead of being a dead one.
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
        title={`Open ${name}'s filing`}>
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

  // A contested race (two candidates) whose by_party holds one party: only one
  // side filed. Blank the folded figure and leave the number to the rows below.
  const oneSided = (candidates || []).length >= 2 && parties.length === 1;

  // Same colour coding the other metric boxes use: the folded figure carries the
  // party that is ahead, so the advantage is legible without opening the box.
  // MetricBlock applies val-d/val-r the same way, and the rule that fixes it is
  // .metric-value.val-d / .val-r.
  const party = summary.advantage.party;
  const valueCls = party === 'D' ? 'val-d' : party === 'R' ? 'val-r' : '';
  const value = oneSided ? null : (
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
