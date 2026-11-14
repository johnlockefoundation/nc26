import BallotsBlock from './BallotsBlock.jsx';
import ResultsBlock from './ResultsBlock.jsx';
import PredictionsBlock from './PredictionsBlock.jsx';
import MetricBlock from './MetricBlock.jsx';
import Demographics from './Demographics.jsx';
import MoneyBlock from './MoneyBlock.jsx';
import PendingMetric from './PendingMetric.jsx';
import DistrictNews from './DistrictNews.jsx';
import { trackerUrl } from '../lib/tracker.js';

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
  // Kalshi gets its own collapsible box (scorecard + both margins). Other
  // providers, if any, keep the plain MetricBlock.
  const otherMarketBlocks = isFederal
    ? marketList
        .filter((m) => (m.provider || '').toLowerCase() !== 'kalshi')
        .map((m) => (
          <MetricBlock
            key={m.provider}
            title={(m.provider || 'MARKET').toUpperCase()}
            emptyText="NO MARKET"
            summary={m}
          />
        ))
    : [];

  // Voter velocity is a General Assembly dataset, and unlike MONEY nothing on
  // this page renders it: the figures come from the state and the panel does not
  // try to stand in for them. REGISTRATIONS is gone rather than pending, and
  // stays gone -- the source registration data is keyed by county, not district,
  // so there is no honest per-seat figure to load.
  //
  // BALLOTS now has one: ballot requests aggregate cleanly onto House, Senate
  // and congressional district codes in the source rows, and load into
  // race_vitals through the human-run loader. So the row that used to be only
  // a link out to the tracker becomes the real box whenever the read has the
  // data, and keeps the link -- as the widget's source line, and as the whole
  // widget on a state seat whose snapshot has not been loaded yet. A federal
  // seat without data still renders nothing here, which is what it did before.
  const disclosureBlocks = [];
  const ballots = race.ballots || {};
  if (ballots.available) {
    disclosureBlocks.push(
      <BallotsBlock key="ballots" summary={ballots} trackerHref={trackerHref} districtId={race.district_id} />,
    );
  } else if (isStateRace && trackerHref) {
    disclosureBlocks.push(
      /* A plain .metric row, not .metric-static: this is a title and one value
         on one line like every other box in the panel, so the link belongs
         hard right rather than stacked under the label. */
      <div key="ballots" className="metric">
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
    ? <MoneyBlock key="money" summary={moneyS} candidates={race.candidates} districtId={race.district_id} />
    : <PendingMetric key="money-pending" title="MONEY" />;

  return (
    <aside className="panel">
      <h2 className="panel-title">{race.title}</h2>

      {/* One stack for every chamber. News sits inside it rather than below it,
          so the box above a story is the same width and aligned with the box
          below it instead of floating under a section heading. */}
      <div className="metrics">
        <ResultsBlock districtId={race.district_id} candidates={race.candidates} />
        <PredictionsBlock districtId={race.district_id} race={race} markets={markets} polls={polls} />
        {/* Federal-only, unlike every other block here. See the isFederal note
            above: there is no state-legislature poll and no state market, so on
            a state seat these are not missing data, they are inapplicable ones,
            and the pending notice would be a false claim about a pipeline that
            does not exist. */}
        {otherMarketBlocks}
        {money}
        {disclosureBlocks}
        <DistrictNews articles={race.news} />
      </div>
    </aside>
  );
}