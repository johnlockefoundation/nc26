import { useEffect, useRef, useState, useMemo } from 'react';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import { advantageColor, primarySignal, advantageText } from '../lib/colors.js';

const W = 900;
const H = 500;

function shortLabel(districtId) {
  return districtId.split('-')[1];
}

function colorFor(race) {
  const sig = primarySignal(race);
  return advantageColor(sig.value);
}

export default function NCMap({ features, outline, races, selectedId, onSelect, onHover }) {
  const [tooltip, setTooltip] = useState(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef(null);
  const svgRef = useRef(null);

  const projection = useMemo(() => {
    if (!outline) return null;
    return geoMercator().fitExtent([[12, 12], [W - 12, H - 12]], outline);
  }, [outline]);

  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection]);

  useEffect(() => {
    setView({ k: 1, x: 0, y: 0 });
  }, [features]);

  if (!projection) return <div className="map-loading">Loading North Carolina…</div>;

  const raceById = new Map((races || []).map((r) => [r.district_id, r]));
  const ordered = [...features].sort((a, b) => {
    if (a.competitive !== b.competitive) return a.competitive ? 1 : -1;
    if (a.district_id === selectedId) return 1;
    if (b.district_id === selectedId) return -1;
    return 0;
  });

  function onWheel(e) {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    setView((v) => {
      const k = Math.max(1, Math.min(14, v.k * factor));
      const x = px - ((px - v.x) * k) / v.k;
      const y = py - ((py - v.y) * k) / v.k;
      return { k, x, y };
    });
  }

  function onMove(e) {
    if (!tooltip) return;
    const rect = svgRef.current.getBoundingClientRect();
    setTooltip((t) => (t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : t));
  }

  function onDown(e) {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    window.addEventListener('mousemove', onMoveDrag);
    window.addEventListener('mouseup', onUp);
  }

  function onMoveDrag(e) {
    if (!drag.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const dx = (e.clientX - drag.current.x) * scaleX;
    const dy = (e.clientY - drag.current.y) * scaleY;
    if (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 3) drag.current.moved = true;
    setView((v) => ({ ...v, x: drag.current.vx + dx, y: drag.current.vy + dy }));
  }

  function onUp() {
    window.removeEventListener('mousemove', onMoveDrag);
    window.removeEventListener('mouseup', onUp);
    setTimeout(() => { drag.current = null; }, 0);
  }

  function handleEnter(f) {
    if (!f.competitive) return;
    const race = raceById.get(f.district_id);
    setTooltip({ district_id: f.district_id, race });
    onHover?.(f.district_id);
  }

  function handleLeave() {
    setTooltip(null);
    onHover?.(null);
  }

  function handleClick(f) {
    if (!f.competitive) return;
    if (drag.current?.moved) return;
    onSelect(f.district_id);
  }

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="nc-map"
        onWheel={onWheel}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseLeave={handleLeave}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <path d={path(outline)} className="state-outline" />
          {ordered.map((f) => {
            const race = raceById.get(f.district_id);
            const color = f.competitive && race ? colorFor(race) : '#e9edf2';
            return (
              <path
                key={f.district_id}
                d={path(f)}
                className={`district ${f.competitive ? 'competitive' : 'safe'} ${selectedId === f.district_id ? 'selected' : ''}`}
                style={{ fill: color }}
                onMouseEnter={() => handleEnter(f)}
                onClick={() => handleClick(f)}
              />
            );
          })}
          {ordered.filter((f) => f.competitive).map((f) => {
            const c = projection(geoCentroid(f));
            if (!c) return null;
            return (
              <text key={`l-${f.district_id}`} x={c[0]} y={c[1]} className="district-label">
                {shortLabel(f.district_id)}
              </text>
            );
          })}
        </g>
      </svg>
      <div className="map-legend">
        <span className="legend-swatch" style={{ background: '#1d4ed8' }} /> D-leading
        <span className="legend-swatch" style={{ background: '#a78bfa' }} /> toss-up
        <span className="legend-swatch" style={{ background: '#b91c1c' }} /> R-leading
        <span className="legend-note">color = primary signal: polls → markets → money</span>
      </div>
      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 14, top: Math.max(tooltip.y - 10, 8) }}>
          <div className="tt-title">{tooltip.district_id}</div>
          <div className="tt-row">Polls: <b>{advantageText('POLLS', tooltip.race?.polls)}</b></div>
          <div className="tt-row">Markets: <b>{advantageText('MARKETS', tooltip.race?.markets)}</b></div>
          <div className="tt-row">Money: <b>{advantageText('MONEY', tooltip.race?.money)}</b></div>
        </div>
      )}
    </div>
  );
}