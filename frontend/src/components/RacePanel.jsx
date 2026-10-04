import { useState } from 'react';
import MetricBlock from './MetricBlock.jsx';
import CivitasPartisan from './CivitasPartisan.jsx';
import Demographics from './Demographics.jsx';
import MoneyBlock from './MoneyBlock.jsx';
import PendingMetric from './PendingMetric.jsx';
import PollBlock from './PollBlock.jsx';
import DistrictNews from './DistrictNews.jsx';
import { initials } from '../lib/candidateName.js';
import { trackerUrl } from '../lib/tracker.js';

function CandidateCards({ candidates }) {
  // A portrait URL can now change under an installed plugin, so a URL that 404s
  // is a normal outcome rather than a build error: fall back to initials. Keyed
  // by URL, not candidate_id, so a later upload of the same seat is retried
  // instead of being permanently marked broken.
  const [broken, setBroken] = useState(() => new Set());
  if (!candidates || candidates.length === 0) return <div className="candidate-list dim">Candidates not yet available.</div>;
  return (
    <div className="candidate-list">
      {candidates.map((c) => (
        <div key={c.candidate_id} className="candidate-card">
          <div className="candidate-photo">
            {c.photo_url && !broken.has(c.photo_url) ? (
              <img
                src={c.photo_url}
                alt={`${c.name} (${c.party})`}
                loading="lazy"
                onError={() => setBroken((prev) => {
                  if (prev.has(c.photo_url)) return prev;
                  const next = new Set(prev);
                  next.add(c.photo_url);
                  return next;
                })}
              />
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

  // Money is picked by chamber, not by a `||` chain. Every read returns the full
  // shape with available false, so `race.state_funds || race.money` always found
  // a truthy object -- state_funds_summary's `{available: false}` on a
  // congressional seat -- and never reached the federal summary that did have a
  // figure. A General Assembly seat reads state_funds; a congressional one reads
  // the party-aggregate fundraising summary. Both are shaped alike.
  const isStateRace = race.race_type === 'state_senate' || race.race_type === 'state_house';
  // Resolved once here because both velocity blocks point at the same place, and
  // the panel is the only layer that knows the seat's type and number.
  const trackerHref = trackerUrl(race);
  const moneyS = isStateRace ? (race.state_funds || {}) : (race.money || {});

  // A non-empty market_list wins, else the single markets summary, else nothing.
  // Checked by length rather than `||` because an empty array is truthy in
  // JavaScript and would shadow a populated `markets`.
  const markets = race.markets || {};
  const marketList = (Array.isArray(race.market_list) && race.market_list.length)
    ? race.market_list
    : (markets.available ? [markets] : []);

  // Two datasets are gated to federal seats rather than shown-when-present.
  //
  // Markets: Kalshi lists no North Carolina state-legislative market, so there
  // is no such thing as a pending one. Rendering an empty box on 170 state seats
  // would assert a pipeline that does not exist.
  //
  // Polls: no state-legislative poll has been entered and none is expected before
  // the primaries. Same reasoning, and the comment that used to sit on the
  // PollBlock call -- warning that a hardcoded chamber test would swallow a poll
  // the day someone seeded one -- is now the decision itself: state races are
  // federal-only by product decision, not by accident.
  const isFederal = !isStateRace;

  // One block per provider. A federal seat with no market gets none rather than a
  // box reading NO MARKET, for the same reason PollBlock stays silent when there
  // is no polling: the blocks that carry a figure should not be buried under the
  // ones that do not.
  const marketBlocks = isFederal ? marketList.map((m) => (
    <MetricBlock
      key={m.provider}
      title={(m.provider || 'MARKET').toUpperCase()}
      emptyText="NO MARKET"
      summary={m}
      delta={m.delta}
    />
  )) : [];

  // Voter velocity is a General Assembly dataset, and unlike MONEY nothing on
  // this page renders it: the figures come from the state and the panel does not
  // try to stand in for them. REGISTRATIONS is gone rather than pending, and
  // BALLOTS is a link out to the tracker, which is where that data actually
  // lives. Both had been carrying a "we are processing this" notice for as long
  // as race_vitals was empty, and that notice described the pipeline rather than
  // the race.
  const disclosureBlocks = [];
  if (isStateRace && trackerHref) {
    disclosureBlocks.push(
      <div key="ballots" className="metric metric-static">
        <div className="metric-title">BALLOTS</div>
        <div className="metric-value">
          <a className="ballots-link" href={trackerHref} target="_blank" rel="noreferrer">
            View in the tracker ↗
          </a>
        </div>
      </div>,
    );
  }

  // Both money sources are expected for their own chamber and absent means
  // pending rather than inapplicable. State senate money in particular is
  // intended to be loaded, so an absent row there is pending rather than
  // inapplicable and gets the notice.
  const money = moneyS?.available
    ? <MoneyBlock key="money" summary={moneyS} candidates={race.candidates} />
    : <PendingMetric key="money-pending" title="MONEY" />;

  return (
    <aside className="panel">
      <h2 className="panel-title">{race.title}</h2>
      <CandidateCards candidates={race.candidates} />

      {/* One stack for every chamber. News sits inside it rather than below it,
          so the box above a story is the same width and aligned with the box
          below it instead of floating under a section heading. */}
      <div className="metrics">
        {isStateRace && <CivitasPartisan partisan={race.partisan} />}
        {/* Federal-only, unlike every other block here. See the isFederal note
            above: there is no state-legislature poll and no state market, so on
            a state seat these are not missing data, they are inapplicable ones,
            and the pending notice would be a false claim about a pipeline that
            does not exist. */}
        {isFederal && <PollBlock polls={polls} race={race} />}
        {marketBlocks}
        {money}
        {disclosureBlocks}
        <DistrictNews articles={race.news} />
      </div>
    </aside>
  );
}