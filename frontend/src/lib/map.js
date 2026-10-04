// CARTO basemap configured with the same key used by the Locke property-tax
// demo (https://github.com/mihir-kale/property-tax-demo): `dark_all` vectors
// with the account key appended. The key is public (served client-side) and is
// required for CARTO basemap access.
const CARTO_KEY = 'cb1_30wm_1_653990a9989fe9a5239ea6e7';
export const BASEMAP_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`;
export const BASEMAP_ATTR = '&copy; OpenStreetMap contributors &copy; CARTO';

export const MAP_MIN_ZOOM = 5;
export const MAP_MAX_ZOOM = 14;

// Every tab is North Carolina, so the view is locked to the state (plus a little
// margin) on all of them and users can never scroll or drag away from it.
export const MAP_BOUNDS = [[32.7, -87.0], [37.7, -74.0]];

// Initial view before fitToState() runs; it immediately fits to the outline.
export const MAP_VIEW = { center: [35.6, -79.5], zoom: 6 };

// Zoom for a ZIP lookup: all the way in, to the same level a reader can reach by
// hand. A ZIP is a specific place and the reader has named it, so the map goes
// there rather than hovering above it. Referenced rather than restated so the
// two cannot drift apart.
export const ZIP_ZOOM = MAP_MAX_ZOOM;
