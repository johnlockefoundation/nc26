// Stories tagged to this exact seat. Strictly per-district: a district never
// borrows statewide coverage, and an untagged story never appears at all.
//
// An elongated box rather than a collapsible one. Every other category in the
// stack is either a single figure or a dataset a reader has to ask for by name;
// a news list is neither -- it is a handful of headlines with no headline
// figure, and the reader came for the race. Making it fold would mean the panel
// looked complete while hiding the only thing on it a reader cannot get anywhere
// else. It carries the same border, radius and title row as the metric boxes
// above it, so it reads as part of the stack rather than as a section someone
// bolted on underneath.
//
// Renders nothing when there is nothing -- no box, no placeholder. An empty box
// that expands to nothing is worse than no box: it occupies the same 52px as a
// metric with a real figure in it.

function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DistrictNews({ articles }) {
  const items = (articles || []).filter((a) => a.url);
  if (items.length === 0) return null;

  return (
    <div className="metric metric-static">
      <div className="metric-title">IN THIS RACE</div>
      <div className="metric-static-body">
        <ul className="race-news">
          {items.map((a) => (
            <li key={a.article_id} className="race-news-item">
              <a href={a.url} target="_blank" rel="noreferrer" className="race-news-link">
                {a.headline}
              </a>
              <div className="race-news-meta">
                <span className="race-news-outlet">{a.outlet}</span>
                {a.published_at ? <span> · {fmtDate(a.published_at)}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
