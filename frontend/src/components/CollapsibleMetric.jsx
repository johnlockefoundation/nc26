// The disclosure box shared by every panel category that folds away its content
// -- DEMOGRAPHICS, REGISTRATION and BALLOT.
//
// The point of extracting this is that all of them must be the same box. They
// previously shared one component, which is what kept them aligned; splitting
// them into siblings would have left three copies of the markup free to drift.
// One shell, one source of truth for the collapsed state.
//
// Collapsed it reads as a plain .metric: title hard left, disclosure caret
// right, nothing else -- so a folded box is the same height as the POLLS, MONEY
// and market blocks stacked above it and the stack does not step. Expanding
// elongates the box in place.
//
// None of these three has a single party-advantage figure, so there is no value
// to show while folded: a stand-in number would mean something different in
// every chamber, and an empty right-hand side reads as "nothing here" rather
// than "ask me". Everything lives behind the caret.
export default function CollapsibleMetric({ title, children, source }) {
  return (
    <details className="metric collapsible-metric">
      <summary className="collapsible-metric-head">
        <span className="metric-title">{title}</span>
        <span className="collapsible-caret" aria-hidden="true" />
      </summary>
      <div className="collapsible-metric-body">
        {children}
        {source && <div className="profile-source dim">{source}</div>}
      </div>
    </details>
  );
}
