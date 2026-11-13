#!/usr/bin/env node
// Simplify Voting_Precincts.geojson -> frontend/public/precincts/data/precincts.geojson
// Run: node backend/scripts/simplify-precincts.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SRC = resolve(join(REPO, 'Voting_Precincts.geojson'));
const OUT = resolve(join(REPO, 'frontend', 'public', 'precincts', 'data', 'precincts.geojson'));
const TOL = 0.0015;

function perpendicularDistance(p, a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const len2 = dx*dx+dy*dy;
  if (len2 === 0) return Math.hypot(p[0]-a[0], p[1]-a[1]);
  const t = ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/len2;
  const cx = a[0]+Math.max(0,Math.min(1,t))*dx;
  const cy = a[1]+Math.max(0,Math.min(1,t))*dy;
  return Math.hypot(p[0]-cx, p[1]-cy);
}
function simplify(points, tol) {
  if (points.length <= 4) return points;
  let maxDist=0, idx=0;
  for (let i=1;i<points.length-1;i++){const d=perpendicularDistance(points[i],points[0],points[points.length-1]);if(d>maxDist){maxDist=d;idx=i;}}
  if (maxDist <= tol) return [points[0], points[points.length-1]];
  const left = simplify(points.slice(0, idx+1), tol);
  const right = simplify(points.slice(idx), tol);
  return left.slice(0,-1).concat(right);
}
const round = (n) => Math.round(n*10000)/10000;

const g = JSON.parse(readFileSync(SRC,'utf8'));
const features = g.features.map(f => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const simplified = polys.map(rings => rings.map(ring => simplify(ring, TOL).map(([x,y])=>[round(x),round(y)])));
  return {
    type:'Feature',
    properties: {
      county_id: f.properties.county_id,
      county: f.properties.county_nam,
      prec_id: f.properties.prec_id,
      name: f.properties.enr_desc,
    },
    geometry: { type:'MultiPolygon', coordinates: simplified },
  };
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ type:'FeatureCollection', features }));
console.log('Wrote', OUT, features.length, 'precincts,', (readFileSync(OUT).length/1024).toFixed(0)+'KB');