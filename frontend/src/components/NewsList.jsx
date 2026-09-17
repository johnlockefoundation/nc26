import { relativeTime, fullDate } from '../lib/format.js';

export default function NewsList({ articles, limit = 3 }) {
  const list = (articles || []).slice(0, limit);
  if (list.length === 0) {
    return <div className="news-empty">No recent race-specific news found.</div>;
  }
  return (
    <ul className="news-list">
      {list.map((a) => (
        <li key={a.article_id} className="news-item">
          <a className="news-headline" href={a.url || '#'} target="_blank" rel="noreferrer">
            {a.headline}
          </a>
          <div className="news-meta">
            <span>{a.outlet}</span>
            <span className="dot">·</span>
            <span title={fullDate(a.published_at)}>{relativeTime(a.published_at)}</span>
          </div>
          {a.summary && <div className="news-summary">{a.summary}</div>}
        </li>
      ))}
    </ul>
  );
}