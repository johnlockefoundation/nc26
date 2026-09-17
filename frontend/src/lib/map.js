// CARTO basemap configured with the same key used by the Locke property-tax
// demo (https://github.com/mihir-kale/property-tax-demo): `light_all` vectors
// with the account key appended. The key is public (served client-side) and is
// required for CARTO basemap access.
export const CARTO_KEY = 'cb1_30wm_1_653990a9989fe9a5239ea6e7';
export const BASEMAP_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`;
export const BASEMAP_ATTR = '&copy; OpenStreetMap contributors &copy; CARTO';

export const MAP_MIN_ZOOM = 5;
export const MAP_MAX_ZOOM = 14;