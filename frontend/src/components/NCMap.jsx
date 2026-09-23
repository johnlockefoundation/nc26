import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { partyColor, primarySignal } from '../lib/colors.js';
import {
  BASEMAP_URL, BASEMAP_ATTR, MAP_MIN_ZOOM, MAP_MAX_ZOOM, MAP_BOUNDS,
  SENATE_MIN_ZOOM, SENATE_BOUNDS, SENATE_FIT_BOUNDS, SENATE_VIEW,
} from '../lib/map.js';

function shortLabel(districtId) {
  const [state, rest] = districtId.split('-');
  return rest === 'SEN' ? state : rest;
}

function matchupText(candidates) {
  if (!candidates || candidates.length === 0) return null;
  return candidates.map((c) => c.name.split(/\s+/).pop()).join(' v ');
}

function colorFor(race) {
  return partyColor(primarySignal(race)?.advantage?.party);
}

function safeLean(cpi) {
  if (!cpi) return null;
  const m = /^([DR])\+(\d+)$/.exec(String(cpi).trim());
  if (!m) return null;
  return { party: m[1], value: +m[2] };
}

function safeStyle() {
  return { color: '#3d516e', weight: 0.7, fillColor: '#475569', fillOpacity: 0.4 };
}

function raceStyle(f, race) {
  return {
    color: '#0b1220',
    weight: 0.8,
    fillColor: colorFor(race),
    fillOpacity: 0.85,
  };
}

function tooltipFor(race) {
  const matchup = matchupText(race.candidates);
  const party = (race?.advantage?.party || primarySignal(race)?.advantage?.party || 'EVEN').toLowerCase();
  const html = matchup ? `${race.district_id}: ${matchup}` : primarySignal(race)?.advantage?.label || race.district_id;
  return { html, className: `tip-adv tip-${party}` };
}

function geometryFeature(f, transform) {
  return { type: 'Feature', properties: {}, geometry: transform ? transformCoords(f.geometry, transform) : f.geometry };
}

// Re-map GeoJSON coordinates through an affine function, used to shrink Alaska
// into its Pacific inset on the Senate map (see insetTransformFor).
function transformCoords(geometry, fn) {
  if (!geometry) return geometry;
  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: geometry.coordinates.map((ring) => ring.map(([lon, lat]) => fn(lon, lat))) };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((poly) =>
        poly.map((ring) => ring.map(([lon, lat]) => fn(lon, lat)))),
    };
  }
  return geometry;
}

function pathCenter(f) {
  const bounds = L.geoJSON(geometryFeature(f)).getBounds();
  return bounds.isValid() ? bounds.getCenter() : null;
}

// Senate races are statewide polygons, so label anchors are hand-picked per
// state (bounding-box centers land over water or empty terrain for several).
// NC is anchored near Asheboro, the geographic heart of the state.
const SENATE_ANCHORS = {
  'NC-SEN': L.latLng(35.71, -79.81),
  'ME-SEN': L.latLng(44.95, -69.2),
  'AK-SEN': L.latLng(62.8, -155.0),
  'MI-SEN': L.latLng(44.5, -85.0),
  'OH-SEN': L.latLng(40.2, -82.8),
  'IA-SEN': L.latLng(42.0, -93.3),
  'TX-SEN': L.latLng(31.3, -99.5),
  'GA-SEN': L.latLng(32.7, -83.4),
  'NH-SEN': L.latLng(43.4, -71.6),
  'NE-SEN': L.latLng(41.5, -99.7),
};

function anchorFor(f, transform) {
  const base = SENATE_ANCHORS[f.district_id] || pathCenter(f);
  return transform ? transform(base) : base;
}

// Alaska (AK-SEN) is the one Senate battleground web Mercator bloats beyond
// reason: at sea level its polygon stretches far up the page and pushes the
// other states aside. Shrink it into a compact box floating in the Pacific and
// leave the view fit to CONUS, which the map bounds in map.js already assume.
function insetTransformFor(feature) {
  const src = L.geoJSON(geometryFeature(feature)).getBounds();
  if (!src.isValid()) return null;
  return {
    coords: (lon, lat) => [
      AK_INSET_WEST + (lon - src.getWest()) * AK_INSET_SCALE,
      AK_INSET_SOUTH + (lat - src.getSouth()) * AK_INSET_SCALE,
    ],
    latLng: (p) => L.latLng(
      AK_INSET_SOUTH + (p.lat - src.getSouth()) * AK_INSET_SCALE,
      AK_INSET_WEST + (p.lng - src.getWest()) * AK_INSET_SCALE,
    ),
  };
}

const AK_INSET_WEST = -133;
const AK_INSET_SOUTH = 7;
const AK_INSET_SCALE = 0.42;

export default function NCMap({ features, outline, races, selectedId, onSelect, raceType }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const labelsRef = useRef(null);
  const layersById = useRef(new Map());
  const featuresById = useRef(new Map());
  const raceById = useRef(new Map());
  const selectedRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    raceById.current = new Map((races || []).map((r) => [r.district_id, r]));
    featuresById.current = new Map((features || []).map((f) => [f.district_id, f]));
  }, [features, races]);

  // Initialize the Leaflet map once.
  useEffect(() => {
    if (mapRef.current) return;
    const isSenate = raceType === 'us_senate';
    const map = L.map(containerRef.current, {
      minZoom: isSenate ? SENATE_MIN_ZOOM : MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      scrollWheelZoom: false,
      maxBounds: isSenate ? SENATE_BOUNDS : MAP_BOUNDS,
      maxBoundsViscosity: 1,
      zoomControl: true,
      attributionControl: true,
    });
    map.setView(isSenate ? SENATE_VIEW.center : [35.6, -79.5], isSenate ? SENATE_VIEW.zoom : 6);
    L.tileLayer(BASEMAP_URL, {
      attribution: BASEMAP_ATTR,
      maxZoom: MAP_MAX_ZOOM,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    labelsRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Tune pan/zoom limits when the race type changes: the Senate tab spans the
  // nation, the in-state tabs stay locked to North Carolina.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const isSenate = raceType === 'us_senate';
    map.setMinZoom(isSenate ? SENATE_MIN_ZOOM : MAP_MIN_ZOOM);
    map.setMaxBounds(isSenate ? SENATE_BOUNDS : MAP_BOUNDS);
  }, [raceType]);

  // Rebuild district layers when the dataset changes (race type switch).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current.clearLayers();
    labelsRef.current.clearLayers();
    layersById.current = new Map();
    selectedRef.current = null;

    for (const f of features || []) {
      const race = raceById.current.get(f.district_id);
      const isComp = f.competitive && race;
      const inset = f.district_id === 'AK-SEN' ? insetTransformFor(f) : null;

      const geo = L.geoJSON(geometryFeature(f, inset?.coords), {
        style: isComp ? raceStyle(f, race) : safeStyle(),
        interactive: true,
        onEachFeature: (_, layer) => {
          layer.options.title = f.district_id;
          layer.on('click', () => onSelectRef.current(f.district_id));
          layer.on('mouseover', () => {
            if (f.district_id !== selectedRef.current) {
              layer.setStyle({ ...(isComp ? raceStyle(f, race) : safeStyle()), weight: 1.8, color: '#f1f5f9' });
            }
          });
          layer.on('mouseout', () => {
            layer.setStyle(f.district_id === selectedRef.current ? selectedStyle(f.district_id) : (isComp ? raceStyle(f, race) : safeStyle()));
          });
          if (!isComp) {
            const lean = safeLean(f.cpi);
            if (lean) {
              layer.bindTooltip(`SAFE ${lean.party} +${lean.value}`, { sticky: true, offset: [0, -4], className: 'tip-adv tip-safe' });
            }
            return;
          }
          const tip = tooltipFor(race);
          if (tip) layer.bindTooltip(tip.html, { sticky: true, offset: [0, -4], className: tip.className });
        },
      });
      layerRef.current.addLayer(geo);
      layersById.current.set(f.district_id, geo);

      const center = anchorFor(f, inset?.latLng);
      if (center) {
        const race = isComp ? raceById.current.get(f.district_id) : null;
        const delta = race?.markets?.delta;
        const hasArrow = Boolean(delta && delta.party && delta.party !== 'EVEN');
        const isSenate = race?.race_type === 'us_senate';
        const label = L.marker(center, {
          interactive: false,
          icon: L.divIcon({
            className: isComp ? 'district-divlabel' : 'district-divlabel district-divlabel-safe',
            html: shortLabel(f.district_id),
            iconSize: [30, 16],
            iconAnchor: [15, isComp && hasArrow ? 18 : 8],
          }),
        });
        labelsRef.current.addLayer(label);
        if (hasArrow) {
          const dirCls = delta.party === 'D' ? 'arrow-d' : 'arrow-r';
          const size = isSenate ? 64 : 46;
          const arrowMark = L.marker(center, {
            interactive: false,
            icon: L.divIcon({
              className: 'district-arrow-marker',
              html: `<span class="map-ping ${dirCls}${isSenate ? ' map-ping-senate' : ''}">
                <span class="ping-dot"></span>
                <span class="ping-ring"></span>
                <span class="ping-ring ping-ring-delay"></span>
              </span>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            }),
          });
          labelsRef.current.addLayer(arrowMark);
        }
      }
    }

    fitToState(map, raceType);
  }, [features, races, outline, raceType]);

  // Highlight the selected district without rebuilding everything.
  useEffect(() => {
    const prevId = selectedRef.current;
    const prevLayer = prevId ? layersById.current.get(prevId) : null;
    if (prevLayer) {
      const f = featuresById.current.get(prevId);
      const race = raceById.current.get(prevId);
      prevLayer.setStyle(f && f.competitive && race ? raceStyle(f, race) : safeStyle());
    }
    selectedRef.current = selectedId;
    const layer = selectedId ? layersById.current.get(selectedId) : null;
    if (layer) layer.setStyle(selectedStyle(selectedId));
  }, [selectedId, features, races]);

  function selectedStyle(districtId) {
    const f = featuresById.current.get(districtId);
    const race = raceById.current.get(districtId);
    const isComp = f && f.competitive && race;
    return {
      color: '#f8fafc',
      weight: 2.6,
      fillColor: isComp ? colorFor(race) : '#475569',
      fillOpacity: 0.95,
    };
  }

  function fitToState(map, type) {
    if (!map) return;
    if (type === 'us_senate') {
      map.fitBounds(SENATE_FIT_BOUNDS, { padding: [6, 6] });
      return;
    }
    if (outline && outline.type) {
      const b = L.geoJSON(outline).getBounds();
      if (b.isValid()) {
        map.fitBounds(b, { padding: [12, 12] });
        return;
      }
    }
    map.setView([35.6, -79.5], 6);
  }

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" aria-label="Competitive election map" />
      <button className="map-reset" onClick={() => fitToState(mapRef.current, raceType)} title="Zoom to view">⤢</button>
    </div>
  );
}
