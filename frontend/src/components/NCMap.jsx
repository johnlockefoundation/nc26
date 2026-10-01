import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fillFor, primarySignal, leanLabel, SAFE_FILL_OPACITY } from '../lib/colors.js';
import {
  BASEMAP_URL, BASEMAP_ATTR, MAP_MIN_ZOOM, MAP_MAX_ZOOM, MAP_BOUNDS, MAP_VIEW,
} from '../lib/map.js';

// The shared district border, and the colour that means "this one" while a
// reader is pointing at it or has it selected. Amber is the one hue in the
// palette that reads against near-white, against the D blue and against the R
// red, so hover and selection stay obvious on every district without having to
// change the fill -- which is load-bearing, because the fill is the lean.
const DISTRICT_BORDER = '#f8fafc';
const DISTRICT_FOCUS = '#fbbf24';

function shortLabel(districtId) {
  const [state, rest] = districtId.split('-');
  return rest === 'SEN' ? state : rest;
}

function matchupText(candidates) {
  if (!candidates || candidates.length === 0) return null;
  return candidates.map((c) => c.name.split(/\s+/).pop()).join(' v ');
}

// The lean for a district, and the bucket to label it with. NCGA features carry
// the Civitas value, so the label can be honest -- "LIKELY R+9" rather than
// calling a Likely seat Safe. Congressional features carry a bare party with no
// magnitude, so they get no lean label; the panel is where their numbers live.
function leanOf(f) {
  if (!f.cpi) return f.lean_party ? { party: f.lean_party } : null;
  const m = /^([DR])\+(\d+(?:\.\d+)?)$/.exec(String(f.cpi).trim());
  if (!m) return null;
  return { party: m[1], value: +m[2], bucket: f.partisan_lean };
}

// One style function, because there is one rule: the hue comes from the lean and
// the brightness from the competitive flag. A seat reads the same in all four
// chambers, and an in-play seat is brighter than a settled one in both the hue
// the signal gives it and the hue the NCGA index gives it.
//
// The live race signal wins when there is one, so a seat that picks up polling
// or a fresh price is coloured by it. The feature's own lean is the fallback,
// which is what lets the map be fully coloured with no network at all.
function leanFor(f, race) {
  if (f.competitive && race) {
    const s = primarySignal(race);
    if (s.advantage && s.advantage.party && s.advantage.party !== 'EVEN') {
      return { party: s.advantage.party };
    }
  }
  return leanOf(f);
}

// Every district is outlined in the same near-white, whatever it leans and
// whatever its competitiveness. The border is the map's grid, and a grid that
// changes weight or colour with the data stops being a grid: on a dark basemap
// the dark borders used to disappear into the districts they were supposed to
// separate, so at state-house zoom -- 120 seats -- the eye had nothing to trace
// and every click was a guess. One weight, one colour, everywhere, in all four
// chambers, and the districts read as districts first and as races second.
//
// That is also why the border is a fixed width regardless of zoom rather than
// something that thins as you zoom out: a hairline at state zoom vanishes.
function styleFor(f, race) {
  const inPlay = Boolean(f.competitive && race);
  return {
    color: DISTRICT_BORDER,
    weight: 1.3,
    // Slightly transparent so the border reads as a seam between two fills
    // rather than as a drawn line sitting on top of them.
    opacity: 0.9,
    fillColor: fillFor(leanFor(f, race), inPlay),
    fillOpacity: inPlay ? 0.85 : SAFE_FILL_OPACITY,
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

// ---------------------------------------------------------------------------
// Label anchors
//
// A district's bounding-box centre is not reliably inside the district. The box
// spans the whole extent of the shape, so for a district that wraps around a
// concavity -- most of a state's coastline, or the notch where Mecklenburg sits
// -- the centre lands in whatever is in that notch. NC-05 and NC-13 both put
// the number outside their own district this way, and NC-13's area-weighted
// centroid is outside it too, so neither the box nor the centroid is enough on
// its own.
//
// Anchors are the area-weighted centroid where that is comfortably inside the
// shape, and otherwise the pole of inaccessibility -- the interior point furthest
// from the district's own boundary -- found by sampling a grid over the box and
// refining around the winner twice. The centroid covers nearly every district
// and costs a single pass over the edges; the search is only for the few that
// pinch to a sliver or wrap a concavity, which keeps a tab switch from paying
// for it fourteen times. The pole lands in the widest part of the shape, which
// is also where a number reads best: NC-05 goes from 3.6 km clear of its border
// to 36.8 km.
// ---------------------------------------------------------------------------

// How far a label must sit from its district's border to be good enough to take
// the cheap centroid path. About 6 km, which at any zoom the map opens at is
// many times the width of the number itself.
const MIN_LABEL_CLEARANCE = 0.06;

function districtPolygons(f) {
  const g = f.geometry;
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
}

function bboxOf(polygons) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of polygons) {
    for (const [x, y] of poly[0]) {
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
    }
  }
  return b;
}

function pointInRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A polygon is its exterior ring minus its holes.
function pointInDistrict(polygons, x, y) {
  return polygons.some((poly) => (
    pointInRing(poly[0], x, y) && !poly.slice(1).some((hole) => pointInRing(hole, x, y))
  ));
}

// Squared distance to the nearest edge. Squared, because this runs in the
// innermost loop of the grid search and only the winning value needs a sqrt.
function clearanceSq(polygons, x, y) {
  let min = Infinity;
  for (const poly of polygons) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[j];
        const [bx, by] = ring[i];
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / lenSq;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - (ax + t * dx);
        const ey = y - (ay + t * dy);
        const d = ex * ex + ey * ey;
        if (d < min) {
          min = d;
          if (min === 0) return 0;
        }
      }
    }
  }
  return min;
}

// Rings are signed, so a hole subtracts itself from the total and pulls the
// centroid the way it should.
function areaCentroid(polygons) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (const poly of polygons) {
    for (const ring of poly) {
      let a = 0;
      let rx = 0;
      let ry = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
        a += cross;
        rx += (ring[j][0] + ring[i][0]) * cross;
        ry += (ring[j][1] + ring[i][1]) * cross;
      }
      a /= 2;
      if (a === 0) continue;
      area += a;
      cx += (rx / (6 * a)) * a;
      cy += (ry / (6 * a)) * a;
    }
  }
  return area === 0 ? null : [cx / area, cy / area];
}

function poleOfInaccessibility(polygons) {
  const box = bboxOf(polygons);
  let [x0, y0, x1, y1] = box;
  let best = null;
  let bestSq = -1;

  for (let pass = 0; pass < 3; pass++) {
    const steps = pass === 0 ? 24 : 12;
    const halfW = (x1 - x0) / 2;
    const halfH = (y1 - y0) / 2;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      for (let j = 0; j <= steps; j++) {
        const y = y0 + ((y1 - y0) * j) / steps;
        if (!pointInDistrict(polygons, x, y)) continue;
        const d = clearanceSq(polygons, x, y);
        if (d > bestSq) {
          bestSq = d;
          best = [x, y];
        }
      }
    }
    if (best) {
      [x0, x1] = [best[0] - halfW, best[0] + halfW];
      [y0, y1] = [best[1] - halfH, best[1] + halfH];
    }
  }

  return best ? L.latLng(best[1], best[0]) : null;
}

function anchorFor(f) {
  const polygons = districtPolygons(f);
  const centroid = areaCentroid(polygons);
  if (centroid
    && pointInDistrict(polygons, centroid[0], centroid[1])
    && clearanceSq(polygons, centroid[0], centroid[1]) >= MIN_LABEL_CLEARANCE ** 2) {
    return L.latLng(centroid[1], centroid[0]);
  }
  return poleOfInaccessibility(polygons);
}

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

  // Initialize the Leaflet map once. Every tab is North Carolina, so the view
  // limits never change with the race type.
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
    map.setView(MAP_VIEW.center, MAP_VIEW.zoom);
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
      const isComp = Boolean(f.competitive && race);
      const style = styleFor(f, race);

      const geo = L.geoJSON(geometryFeature(f), {
        style,
        interactive: true,
        onEachFeature: (_, layer) => {
          layer.options.title = f.district_id;
          layer.on('click', () => onSelectRef.current(f.district_id));
          layer.on('mouseover', () => {
            if (f.district_id !== selectedRef.current) {
              layer.setStyle({ ...style, weight: 1.9, color: DISTRICT_FOCUS });
            }
          });
          layer.on('mouseout', () => {
            layer.setStyle(f.district_id === selectedRef.current ? selectedStyle(f.district_id) : style);
          });
          if (!isComp) {
            // Only NCGA features carry a bucket, and only a bucket can be
            // labelled honestly -- leanLabel needs the value and the rating.
            const lean = leanOf(f);
            if (lean && lean.bucket) {
              layer.bindTooltip(leanLabel(lean), { sticky: true, offset: [0, -4], className: `tip-adv tip-safe tip-lean-${lean.party.toLowerCase()}` });
            }
            return;
          }
          const tip = tooltipFor(race);
          if (tip) layer.bindTooltip(tip.html, { sticky: true, offset: [0, -4], className: tip.className });
        },
      });
      layerRef.current.addLayer(geo);
      layersById.current.set(f.district_id, geo);

      const center = anchorFor(f);
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
          const glyph = delta.party === 'D' ? '↖' : '↗';
          const size = isSenate ? 64 : 46;
          const arrowMark = L.marker(center, {
            interactive: false,
            icon: L.divIcon({
              className: 'district-arrow-marker',
              html: `<span class="map-arrow ${dirCls}${isSenate ? ' map-arrow-senate' : ''}">${glyph}</span>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            }),
          });
          labelsRef.current.addLayer(arrowMark);
        }
      }
    }

    fitToState(map);
  }, [features, races, outline, raceType]);

  // Highlight the selected district without rebuilding everything.
  useEffect(() => {
    const prevId = selectedRef.current;
    const prevLayer = prevId ? layersById.current.get(prevId) : null;
    if (prevLayer) {
      const f = featuresById.current.get(prevId);
      const race = raceById.current.get(prevId);
      prevLayer.setStyle(styleFor(f, race));
    }
    selectedRef.current = selectedId;
    const layer = selectedId ? layersById.current.get(selectedId) : null;
    if (layer) layer.setStyle(selectedStyle(selectedId));
  }, [selectedId, features, races]);

  function selectedStyle(districtId) {
    const base = styleFor(featuresById.current.get(districtId), raceById.current.get(districtId));
    // Only the outline changes, never the fill: the fill is the lean, and
    // recolouring it to mark the current seat would have the map misreport a
    // race on every click.
    return { ...base, color: DISTRICT_FOCUS, weight: 2.8, opacity: 1, fillOpacity: 0.95 };
  }

  // Every tab is North Carolina, so the outline is the fit target for all of them.
  function fitToState(map) {
    if (!map) return;
    if (outline && outline.type) {
      const b = L.geoJSON(outline).getBounds();
      if (b.isValid()) {
        map.fitBounds(b, { padding: [12, 12] });
        return;
      }
    }
    map.setView(MAP_VIEW.center, MAP_VIEW.zoom);
  }

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" aria-label="Competitive election map" />
      <button className="map-reset" onClick={() => fitToState(mapRef.current)} title="Zoom to view">⤢</button>
    </div>
  );
}
