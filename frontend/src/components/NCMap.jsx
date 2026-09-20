import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { partyColor, primarySignal } from '../lib/colors.js';
import { BASEMAP_URL, BASEMAP_ATTR, MAP_MIN_ZOOM, MAP_MAX_ZOOM, MAP_BOUNDS } from '../lib/map.js';

function shortLabel(districtId) {
  if (districtId === 'NC-SEN') return 'NC';
  return districtId.split('-')[1];
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
      scrollWheelZoom: false,
      maxBounds: MAP_BOUNDS,
      maxBoundsViscosity: 1,
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
            layer.setStyle(f.district_id === selectedRef.current ? selectedStyle(f, race) : (isComp ? raceStyle(f, race) : safeStyle()));
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

      if (pathCenter(f)) {
        const race = isComp ? raceById.current.get(f.district_id) : null;
        const delta = race?.markets?.delta;
        const hasArrow = Boolean(delta && delta.party && delta.party !== 'EVEN');
        const label = L.marker(pathCenter(f), {
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
          const glyph = delta.party === 'D' ? '↖' : '↗';
          const arrowMark = L.marker(pathCenter(f), {
            interactive: false,
            icon: L.divIcon({
              className: 'district-arrow-marker',
              html: `<span class="map-arrow ${dirCls}">${glyph}</span>`,
              iconSize: [46, 46],
              iconAnchor: [23, 23],
            }),
          });
          labelsRef.current.addLayer(arrowMark);
        }
      }
    }

    fitToState(map);
  }, [features, races, outline]);

  // Highlight the selected district without rebuilding everything.
  useEffect(() => {
    const prevId = selectedRef.current;
    const prevLayer = prevId ? layersById.current.get(prevId) : null;
    if (prevLayer) prevLayer.setStyle(selectedStyle(prevLayer));
    selectedRef.current = selectedId;
    const layer = selectedId ? layersById.current.get(selectedId) : null;
    if (layer) layer.setStyle(selectedStyle(layer));
  }, [selectedId, features, races]);

  function selectedStyle(layer) {
    const id = layer ? layer.options.title : selectedRef.current;
    const f = featuresById.current.get(id);
    const race = raceById.current.get(id);
    const isComp = f && f.competitive && race;
    return {
      color: '#f8fafc',
      weight: 2.6,
      fillColor: isComp ? colorFor(race) : '#475569',
      fillOpacity: 0.95,
    };
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
    </div>
  );
}