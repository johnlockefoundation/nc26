// The disclosure box shared by every panel category that folds away its content
// -- DEMOGRAPHICS, REGISTRATIONS, BALLOTS and MONEY.
//
// The point of extracting this is that all of them must be the same box. They
// previously shared one component, which is what kept them aligned; splitting
// them into siblings would have left four copies of the markup free to drift.
// One shell, one source of truth for the collapsed state.
//
// Collapsed it reads as a plain .metric: title hard left, and the right-hand
// slot holding either a value or a disclosure caret, so a folded box is the same
// height as the market and average-only POLLS rows stacked above it and the
// stack does not step. Expanding elongates the box in place.
//
// Which of the two the right-hand slot holds is the only difference between the
// boxes, and it is a real difference rather than a styling choice. DEMOGRAPHICS,
// REGISTRATIONS and BALLOTS have no single party-advantage figure, and a stand-in
// number would mean something different in every chamber -- so they show a caret
// and everything lives behind it. MONEY does have a figure, so it shows that
// with the caret after it, the same as a value-bearing row would read.
export default function CollapsibleMetric({ title, value, children, source }) {
  return (
    <details className="metric collapsible-metric">
      <summary>
        <span className="metric-title">{title}</span>
        {value}
        <span className="collapsible-caret" aria-hidden="true" />
      </summary>
      <div className="collapsible-metric-body">
        {children}
        {source && <div className="profile-source dim">{source}</div>}
      </div>
    </details>
  );
}
