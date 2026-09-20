// CARTO basemap configured with the same key used by the Locke property-tax
// demo (https://github.com/mihir-kale/property-tax-demo): `dark_all` vectors
// with the account key appended. The key is public (served client-side) and is
// required for CARTO basemap access.
export const CARTO_KEY = 'cb1_30wm_1_653990a9989fe9a5239ea6e7';
export const BASEMAP_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`;
export const BASEMAP_ATTR = '&copy; OpenStreetMap contributors &copy; CARTO';

export const MAP_MIN_ZOOM = 5;
export const MAP_MAX_ZOOM = 14;

// Keep the view locked to North Carolina (plus a little margin) so users never
// scroll or drag away from the state for the in-state race types.
export const MAP_BOUNDS = [[32.7, -87.0], [37.7, -74.0]];

// The U.S. Senate tab spans the in-play battleground states nationally, so its
// pan/zoom limits are national rather than state-locked. Lower min-zoom lets
// the whole set fit on screen.
export const SENATE_MIN_ZOOM = 3;
export const SENATE_BOUNDS = [[23.0, -170.0], [72.0, -64.0]];

// Initial view when the Senate tab first loads (states across the middle of
// the continent plus Alaska's arc up top).
export const SENATE_VIEW = { center: [38.0, -97.0], zoom: 4 };

// Fit target for the Senate tab: all battleground states with the empty
// Pacific strip west of the Aleutians trimmed so the states stay prominent.
export const SENATE_FIT_BOUNDS = [[24.5, -171.0], [71.5, -64.8]];
