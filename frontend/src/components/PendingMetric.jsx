// The notice shown where a dataset is expected for a seat but has no rows yet.
//
// This exists because "no box" and "not applicable" are different facts and the
// panel used to render them identically. A General Assembly seat has no
// prediction market because Kalshi lists none -- not because one is pending --
// and a seat with no poll entered has neither. Showing nothing for all three
// left a reader unable to tell a broken pipeline from an inapplicable widget,
// which is the ambiguity this resolves.
//
// It is deliberately NOT used for a dataset that does not apply to the seat.
// Markets and polls are gated off state-level races entirely (see RacePanel),
// so they never reach the pending case: there is nothing to be pending for.
// Only datasets that will exist for that seat are allowed to say this.
//
// The wording is fixed rather than per-widget on purpose. A single sentence that
// reads the same everywhere is learnable; five variants of "coming soon" would
// each be read once and understood never.

export const PENDING_TEXT = 'We are currently processing this data, please check again soon.';

// A quiet line rather than a metric box. A box would occupy the same row height
// as a real figure and read as one, which is the thing being avoided: this is an
// absence of information, so it is typeset as an aside and not as data.
export default function PendingMetric({ title }) {
  return (
    <div className="metric metric-pending">
      <div className="metric-title">{title}</div>
      <div className="metric-pending-text dim">{PENDING_TEXT}</div>
    </div>
  );
}
