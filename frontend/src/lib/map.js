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

// Zoom for a ZIP lookup. Close enough to place the reader in their own ZIP on
// the county and district outlines around them -- at 6 the whole state is the
// view and at 11+ a single ZIP fills the frame with nothing to compare against.
// One step short of MAP_MAX_ZOOM so a lookup can still be panned back out.
export const ZIP_ZOOM = 10;
