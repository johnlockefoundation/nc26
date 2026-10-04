// ZIP search: type a North Carolina ZIP and the map centres on it.
//
// Zoom only. It deliberately does not select a race. The reader asking "where is
// 27701" is locating themselves on a map, not asking who is running in the
// district that ZIP falls in, and a ZIP often spans a district line anyway --
// picking one would assert an answer the question did not ask for. The panel
// stays where the reader left it.
//
// The ZIP table is bundled rather than fetched. It is invariant reference data in
// the same category as the Census profile: 853 centroids, 23 KB, and it has to
// work with no network. Geocoding per keystroke would put a third party in the
// render path and make the box fail on someone else's rate limit.
import { useState } from 'react';
import centroids from '../lib/ncZipCentroids.json';

// Visible but disabled on the Senate map. NC-SEN is one seat covering the whole
// state, so there is nothing to zoom into -- every ZIP is inside it. Disabled
// rather than hidden so the control does not move when the chamber changes.
export default function ZipSearch({ raceType, onLocate }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const disabled = raceType === 'us_senate';

  function submit(e) {
    e.preventDefault();
    if (disabled) return;
    // Accept 27701, 27701-1234 and 277011234. A ZIP+4 is a more precise
    // location inside the same ZIP, so the first five digits are what matter.
    const zip = value.replace(/\D/g, '').slice(0, 5);
    if (zip.length !== 5) {
      setError('Enter a five-digit ZIP.');
      return;
    }
    const point = centroids.zips[zip];
    if (!point) {
      // The table is North Carolina only, so a real ZIP elsewhere reads as
      // not-found rather than as a typo. Saying so is more useful than implying
      // every ZIP outside NC is mistyped.
      setError('Not a North Carolina ZIP.');
      return;
    }
    setError(null);
    onLocate({ zip, lat: point[0], lng: point[1] });
  }

  return (
    <form className="zip-search" onSubmit={submit} role="search">
      <label className="zip-search-label" htmlFor="zip-search-input">
        Zoom in to a specific zip code
      </label>
      <div className="zip-search-row">
        <input
          id="zip-search-input"
          className="zip-search-input"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
          placeholder={disabled ? 'Not on the Senate map' : '27701'}
          value={value}
          disabled={disabled}
          aria-describedby="zip-search-help"
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
        />
        <button className="zip-search-go" type="submit" disabled={disabled}>
          Go
        </button>
      </div>
      {/* Kept in the DOM even when empty: aria-live has to be present before a
          message arrives for it to be announced. It now carries only what a
          reader cannot work out -- why it is disabled, or why the ZIP was not
          found. What the control does is the label's job. */}
      <div className="zip-search-help" id="zip-search-help" aria-live="polite">
        {disabled ? 'One seat covers the state.' : error || ''}
      </div>
    </form>
  );
}