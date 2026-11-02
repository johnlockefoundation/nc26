// Candidate search: type a candidate's name and jump to their race.
// Searches the candidate lists of the races on the current map. A partial,
// case-insensitive match is enough, so "cooper" finds Roy Cooper.
import { useState } from 'react';

export default function CandidateSearch({ races, onSelect }) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState(null);

  function findMatch(q) {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    const matches = (races || []).filter((r) =>
      (r.candidates || []).some((c) =>
        String(c.name || '').toLowerCase().includes(needle),
      ),
    );
    return matches.length ? matches[0] : null;
  }

  function submit(e) {
    e.preventDefault();
    const match = findMatch(value);
    if (match) {
      setMessage(null);
      onSelect?.(match.district_id);
    } else {
      setMessage('No candidate match.');
    }
  }

  // Live jump: as soon as a unique match exists, select it.
  function change(e) {
    const v = e.target.value;
    setValue(v);
    setMessage(null);
    const needle = v.trim().toLowerCase();
    if (needle.length < 2) return;
    const matches = (races || []).filter((r) =>
      (r.candidates || []).some((c) =>
        String(c.name || '').toLowerCase().includes(needle),
      ),
    );
    if (matches.length === 1) onSelect?.(matches[0].district_id);
  }

  return (
    <form className="candidate-search" onSubmit={submit} role="search">
      <label className="candidate-search-label" htmlFor="candidate-search-input">
        Find a candidate
      </label>
      <div className="candidate-search-row">
        <input
          id="candidate-search-input"
          className="candidate-search-input"
          type="text"
          placeholder="Cooper, Whatley…"
          value={value}
          aria-describedby="candidate-search-help"
          onChange={change}
        />
        <button className="candidate-search-go" type="submit">Go</button>
      </div>
      <div className="candidate-search-help" id="candidate-search-help" aria-live="polite">
        {message || ''}
      </div>
    </form>
  );
}