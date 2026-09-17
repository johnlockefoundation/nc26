import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { advantageColor, primarySignal, advantageText } from '../lib/colors.js';
import { BASEMAP_URL, BASEMAP_ATTR, MAP_MIN_ZOOM, MAP_MAX_ZOOM } from '../lib/map.js';

function shortLabel(districtId) {
  return districtId.split('-')[1];
}

function colorFor(race) {
  const sig = primarySignal(race);
  return advantageColor(sig.value);
}

function safeStyle() {
  return { color: '#dbe2ea', weight: 0.6, fillColor: '#f1f5f9', fillOpacity: 0.55 };
}

function raceStyle(f, race) {
  return {
    color: '#475569',
    weight: 0.8,
    fillColor: colorFor(race),
    fillOpacity: 0.85,
  };
}

function tooltipHtml(race) {
  const p = advantageText('POLLS', race?.polls);
  const m = advantageText('MARKETS', race?.markets);
  const money = advantageText('MONEY', race?.money);
  return `<div class="tt-title">${race.district_id}</div>
    <div class="tt-row"><span>Polls</span><b>${p}</b></div>
    <div class="tt-row"><span>Markets</span><b>${m}</b></div>
    <div class="tt-row"><span>Money</span><b>${money}</b></div>`;
}

function geometryFeature(f) {
  return { type: 'Feature', properties: {}, geometry: f.geometry };
}

function pathCenter(f) {
  const bounds = L.geoJSON(geometryFeature(f)).getBounds();
  return bounds.isValid() ? bounds.getCenter() : null;
}

export default function NCMap({ features, outline, races, selectedId, onSelect }) {
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
    const map = L.map(containerRef.current, {
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });
    map.setView([35.6, -79.5], 6);
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

      const geo = L.geoJSON(geometryFeature(f), {
        style: isComp ? raceStyle(f, race) : safeStyle(),
        interactive: isComp,
        onEachFeature: (_, layer) => {
          layer.options.title = f.district_id;
          if (!isComp) return;
          layer.bindTooltip(tooltipHtml(race), { sticky: true, offset: [0, -4] });
          layer.on('click', () => onSelectRef.current(f.district_id));
          layer.on('mouseover', () => {
            if (f.district_id !== selectedRef.current) {
              layer.setStyle({ ...raceStyle(f, race), weight: 1.8, color: '#0f172a' });
            }
          });
          layer.on('mouseout', () => {
            layer.setStyle(f.district_id === selectedRef.current ? selectedStyle() : raceStyle(f, race));
          });
        },
      });
      layerRef.current.addLayer(geo);
      layersById.current.set(f.district_id, geo);

      if (isComp) {
        const label = L.marker(pathCenter(f), {
          interactive: false,
          icon: L.divIcon({ className: 'district-divlabel', html: shortLabel(f.district_id), iconSize: [30, 14], iconAnchor: [15, 7] }),
        });
        labelsRef.current.addLayer(label);
      }
    }

    fitToState(map);
  }, [features, races, outline]);

  // Highlight the selected district without rebuilding everything.
  useEffect(() => {
    const prevLayer = selectedRef.current ? layersById.current.get(selectedRef.current) : null;
    if (prevLayer) prevLayer.setStyle(raceStyle(featuresById.current.get(selectedRef.current), raceById.current.get(selectedRef.current)));
    selectedRef.current = selectedId;
    const layer = selectedId ? layersById.current.get(selectedId) : null;
    if (layer) layer.setStyle(selectedStyle());
  }, [selectedId, features, races]);

  function selectedStyle() {
    return { color: '#111827', weight: 2.6, fillColor: colorFor(raceById.current.get(selectedRef.current)), fillOpacity: 0.95 };
  }

  function fitToState(map) {
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
      <div ref={containerRef} className="map-container" aria-label="North Carolina election map" />
      <button className="map-reset" onClick={() => fitToState(mapRef.current)} title="Zoom to North Carolina">⤢</button>
      <div className="map-legend">
        <span className="legend-swatch" style={{ background: '#1d4ed8' }} /> D-leading
        <span className="legend-swatch" style={{ background: '#a78bfa' }} /> toss-up
        <span className="legend-swatch" style={{ background: '#b91c1c' }} /> R-leading
        <span className="legend-note">color = primary signal: polls → markets → money</span>
      </div>
    </div>
  );
}