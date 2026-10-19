// The disclosure box shared by every panel category that folds away its content
// -- DEMOGRAPHICS, BALLOTS and MONEY.
//
// The point of extracting this is that all of them must be the same box. They
// previously shared one component, which is what kept them aligned; splitting
// them into siblings would have left three copies of the markup free to drift.
// One shell, one source of truth for the collapsed state.
//
// Collapsed it reads as a plain .metric: title hard left, and the right-hand
// slot holding either a value or a disclosure caret, so a folded box is the same
// height as the market and average-only POLLS rows stacked above it and the
// stack does not step. Expanding elongates the box in place.
//
// Which of the two the right-hand slot holds is the only difference between the
// boxes, and it is a real difference rather than a styling choice. DEMOGRAPHICS
// has no single party-advantage figure, and a stand-in number would mean
// something different in every chamber -- so it shows a caret and everything
// lives behind it. MONEY and BALLOTS each do have one -- the funding margin and
// the lead in ballot requests -- so they show it with the caret after it, the
// same as a value-bearing row would read.
export default function CollapsibleMetric({ title, value, children, source, sourceHref }) {
  return (
    <details className="metric collapsible-metric">
      <summary>
        <span className="metric-title">{title}</span>
        {value}
        <span className="collapsible-caret" aria-hidden="true" />
      </summary>
      <div className="collapsible-metric-body">
        {children}
        {/* sourceHref turns the attribution line into a link. It is separate from
            source rather than a node, because source is a plain string everywhere
            else and callers should not have to know it can hold markup. */}
        {(source || sourceHref) && (
          <div className="profile-source dim">
            {sourceHref
              ? <a href={sourceHref} target="_blank" rel="noreferrer">{source}</a>
              : source}
          </div>
        )}
      </div>
    </details>
  );
}
