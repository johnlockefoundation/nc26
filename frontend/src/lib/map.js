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
// pan/zoom limits are national rather than state-locked. Alaska is rendered as
// a compact inset in the Pacific (see NCMap), so the limits cover the
// contiguous states plus that inset instead of the Mercator-inflated 49th
// state, which otherwise dwarfs its neighbors.
export const SENATE_MIN_ZOOM = 3;
export const SENATE_BOUNDS = [[4.5, -137.0], [51.0, -63.5]];

// Initial view when the Senate tab first loads. fitToState() immediately fits
// to SENATE_FIT_BOUNDS, so this is just a pre-fit placeholder.
export const SENATE_VIEW = { center: [37.0, -100.0], zoom: 4 };

// Fit target for the Senate tab: the battleground states across the continent
// plus Alaska's relocated Pacific inset.
export const SENATE_FIT_BOUNDS = [[6.5, -133.5], [49.6, -65.8]];
