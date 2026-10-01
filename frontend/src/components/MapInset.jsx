// A close-up of one metro, drawn as a static crop of the same geometry the main
// map is already using.
//
// The reason this exists: at state zoom Mecklenburg and Wake are two small
// patches in a sea of districts, and they are where most of the people are. A
// reader who wants to know what is happening in Charlotte should not have to
// zoom, hunt, and lose the rest of the state to find out. The inset answers
// that without touching the main map, so "what is happening in Wake" and "what
// is happening everywhere" stay on screen together.
//
// It is a crop, not a second map. The window is a rectangle of the state's own
// coordinates and the districts that fall inside it are redrawn with the fills
// they already have on the main map. There is no tile layer, no second Leaflet
// instance and no pan or zoom, which keeps it cheap and -- more importantly --
// keeps it from fighting the main map for scroll and drag events.
//
// The colour of a district is resolved through the same fillForFeature() the
// main map calls, so an inset district cannot come out a different colour from
// the same district on the state map. That is the whole reason the lean logic
// was lifted out of NCMap rather than reimplemented here.

import { fillForFeature } from '../lib/colors.js';

// Web Mercator, the projection Leaflet draws the main map in. Both are used so
// a district keeps the same shape in the inset as on the map; a plain lat/lon
// squashed into a square would visibly distort the shapes at this scale.
function mercY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
}

// Windows are [minLon, minLat, maxLon, maxLat]. They are the county's own
// bounding box with a little slack, so the county is not flush against the inset
// edge. There is no county boundary in the data -- the geometry carries only a
// district id -- so a rectangle is what can be honest here: it is labelled as a
// close-up of the area, not as a clipped county outline.
export const INSETS = [
  { id: 'mecklenburg', label: 'MECKLENBURG', sub: 'CHARLOTTE', window: [-81.09, 34.99, -80.49, 35.56] },
  { id: 'wake', label: 'WAKE', sub: 'RALEIGH', window: [-79.03, 35.38, -78.26, 36.07] },
];

function boundsOf(geom) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      const x = c[0];
      const y = mercY(c[1]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return;
    }
    for (const part of c) walk(part);
  };
  walk(geom.coordinates);
  return { minX, minY, maxX, maxY };
}

const overlaps = (a, b) =>
  !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);

// GeoJSON ring -> SVG path in the inset's own coordinate space. Coordinates are
// Mercator-x and Mercator-y in degrees, then scaled into the viewBox.
function pathFor(geom, view) {
  const { minX, minY, maxX, maxY } = view;
  const sx = view.w / (maxX - minX);
  const sy = view.h / (maxY - minY);
  const px = (x) => (x - minX) * sx;
  // SVG y grows downward, Mercator y grows upward.
  const py = (y) => view.h - (y - minY) * sy;
  const ring = (r) => `${r.map(([x, y]) => `${px(x).toFixed(1)},${py(mercY(y)).toFixed(1)}`).join('L')}Z`;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const d = polys
    .map((poly) => `M${poly.map(ring).join('')}`)
    .join(' ');
  return d;
}

export default function MapInset({ inset, features, races, selectedId, onSelect }) {
  const [minLon, minLat, maxLon, maxLat] = inset.window;
  // The window carries its own size: pathFor scales lon/lat into these, so a
  // view without w/h yields NaN for every coordinate and silently draws nothing.
  const view = { minX: minLon, minY: mercY(minLat), maxX: maxLon, maxY: mercY(maxLat), w: 100, h: 100 };

  const raceById = new Map((races || []).map((r) => [r.district_id, r]));

  // Every district that touches the window, not just the ones whose centre is
  // inside it: a district cut in half by the edge of the crop still belongs in
  // the picture, and dropping it would leave a hole in the geography.
  if (!(view.maxX > view.minX) || !(view.maxY > view.minY)) return null;

  const shown = (features || [])
    .filter((f) => f.geometry)
    .map((f) => ({ f, b: boundsOf(f.geometry) }))
    .filter(({ b }) => overlaps(b, view));

  if (shown.length === 0) return null;

  const clipId = `inset-clip-${inset.id}`;

  return (
    <figure className="map-inset">
      <svg viewBox={`0 0 ${view.w} ${view.h}`} className="map-inset-svg" role="img"
        aria-label={`Close-up of ${inset.label} County districts`}>
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={view.w} height={view.h} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width={view.w} height={view.h} className="map-inset-bg" />
          {shown.map(({ f }) => {
            const { fill } = fillForFeature(f, raceById.get(f.district_id));
            const isSel = f.district_id === selectedId;
            const d = pathFor(f.geometry, view);
            return (
              <path
                key={f.district_id}
                d={d}
                fill={fill}
                className={`map-inset-district${isSel ? ' is-selected' : ''}`}
                onClick={() => onSelect(f.district_id)}
                tabIndex={0}
                role="button"
                aria-label={`Select district ${f.district_id}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(f.district_id);
                  }
                }}
              />
            );
          })}
        </g>
      </svg>
      <figcaption className="map-inset-cap">
        <span className="map-inset-name">{inset.label}</span>
        <span className="map-inset-sub">{inset.sub}</span>
      </figcaption>
    </figure>
  );
}
