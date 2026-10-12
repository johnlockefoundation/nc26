// Generate the fixed seated-chamber templates for the Legislature view.
//
// The chambers are concentric curved rows: each row is an arc of a circle
// whose centres all sit at depth `b` below the baseline, so every row seats
// the same line (the "common baseline"), rows rise and widen behind each other
// to a rounded outer arch, and the bottom-centre under the front row is the
// open central floor. Seats sit at an even angular pitch per row, so in-row
// spacing along the arc is constant, and the radial step between rows keeps
// neighbouring rows a similar distance apart. Nothing is solved at runtime: the
// generated {x, y} arrays below are the fixed 120 (House) / 50 (Senate)
// positions the page both assigns districts to and never moves.
//
// Parameter sets (from `node scripts/gen-chamber-templates.mjs --print`):
//   House  b=40 dr=26 gap=28 rows=8 n=[5,7,11,13,17,19,23,25]  -> 120
//   Senate b=34 dr=34 gap=24 rows=4 n=[5,11,15,19]             -> 50
//
// Each row is symmetric with a seat exactly on the vertical centreline
// (j=0), so every row naturally ends with its closest-to-centre seat on the
// line -- that is where ties and the most competitive races go, not a column
// invented for them.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const CHAMBERS = {
  state_house: { b: 40, dr: 26, gap: 28, expected: 120, padX: 34, padTop: 16, baseline: 46 },
  state_senate: { b: 34, dr: 34, gap: 24, expected: 50, padX: 34, padTop: 16, baseline: 46 },
};

function rowSeats(b, dr, gap, i) {
  const rho = b + (i + 1) * dr;
  const alpha = Math.acos(Math.min(1, b / rho));
  const m = Math.floor((alpha * rho) / gap); // seats per side of the apex
  const eps = alpha / m; // outermost seat lands exactly on the baseline
  const pts = [];
  for (let j = -m; j <= m; j++) {
    const th = j * eps;
    pts.push({
      row: i,
      j,
      x: rho * Math.sin(th),
      y: b - rho * Math.cos(th), // screen-space height above the baseline
    });
  }
  return pts;
}

function build(cfg) {
  const seats = [];
  for (let i = 0; i < cfg.rows; i++) seats.push(...rowSeats(cfg.b, cfg.dr, cfg.gap, i));
  const minY = Math.min(...seats.map((s) => s.y));
  const maxX = Math.max(...seats.map((s) => Math.abs(s.x)));
  const W = Math.ceil(2 * maxX + 2 * cfg.padX);
  const H = Math.ceil((cfg.baseline - minY) + cfg.padTop);
  const ox = W / 2;
  const oy = cfg.padTop - minY;
  return {
    rows: cfg.rows,
    seats: seats.map((s) => ({ x: +(s.x + ox).toFixed(3), y: +(s.y + oy).toFixed(3), row: s.row })),
    width: W,
    height: H,
  };
}

function ascii(t) {
  const rows = t.seats.reduce((map, s) => {
    (map[s.row] ||= []).push(s);
    return map;
  }, {});
  const order = Object.keys(rows).sort((a, b) => a - b);
  const cols = Math.max(3, Math.floor(t.width / 4.5));
  const lines = Math.max(3, Math.floor(t.height / 4.5));
  const g = Array.from({ length: lines + 2 }, () => Array(cols + 1).fill(' '));
  for (const s of t.seats) {
    const c = Math.min(cols - 1, Math.max(0, Math.round((s.x / t.width) * (cols - 1))));
    const r = Math.min(lines, Math.max(0, Math.round((s.y / t.height) * (lines - 1))));
    g[r][c] = 'o';
  }
  return g.map((l) => l.join('')).join('\n');
}

function emit() {
  const out = [];
  out.push('// Fixed seated-chamber templates: 120 House seats, 50 Senate seats.');
  out.push('//');
  out.push('// Generated -- do not hand-edit. Regenerate with:');
  out.push('//   node scripts/gen-chamber-templates.mjs');
  out.push('// Every position is absolute; the runtime assigns districts to these');
  out.push('// slots and never moves or resizes them, whatever the lean counts are.');
  out.push('');
  out.push('export const HOUSE_TEMPLATE =');
  out.push(`  ${JSON.stringify(build({ ...CHAMBERS.state_house, rows: ROWS.state_house }), null, 1).replace(/\n/g, '\n  ')};`);
  out.push('');
  out.push('export const SENATE_TEMPLATE =');
  out.push(`  ${JSON.stringify(build({ ...CHAMBERS.state_senate, rows: ROWS.state_senate }), null, 1).replace(/\n/g, '\n  ')};`);
  out.push('');
  return out.join('\n');
}

const state = Object.fromEntries(
  Object.entries(CHAMBERS).map(([key, cfg]) => {
    const seen = [];
    const n = [];
    for (let i = 0; i < 12; i++) {
      n.push(2 * Math.floor((Math.acos(Math.min(1, cfg.b / (cfg.b + (i + 1) * cfg.dr))) * (cfg.b + (i + 1) * cfg.dr)) / cfg.gap) + 1);
    }
    for (let rows = 4; rows <= 12; rows++) {
      const t = build({ ...cfg, rows });
      if (t.seats.length === cfg.expected) {
        seen.push(rows);
        break;
      }
    }
    return [key, { n, seen, summed: false }];
  }),
);

const rowsFor = { state_house: 8, state_senate: 4 };
const ROWS = rowsFor;
const built = {};
let ok = true;
for (const key of Object.keys(CHAMBERS)) {
  const t = build({ ...CHAMBERS[key], rows: rowsFor[key] });
  built[key] = t;
  const counts = t.seats.reduce((a, s) => ((a[s.row] = (a[s.row] || 0) + 1), a), {});
  const exact = t.seats.length === CHAMBERS[key].expected;
  ok = ok && exact;
  const minD = (() => {
    let d = 1e9;
    for (let i = 0; i < t.seats.length; i++) {
      for (let j = i + 1; j < t.seats.length; j++) {
        const dx = t.seats[i].x - t.seats[j].x;
        const dy = t.seats[i].y - t.seats[j].y;
        d = Math.min(d, Math.hypot(dx, dy));
      }
    }
    return d;
  })();
  console.log(`\n=== ${key} === ${t.seats.length} seats (expect ${CHAMBERS[key].expected}) viewBox ${t.width}x${t.height} minDist ${minD.toFixed(1)}`);
  console.log('rows:', Object.values(counts).join(' '), '| total', t.seats.length);
  console.log(ascii(t));
}

if (process.argv.includes('--write')) {
  writeFileSync(resolve(here, '../src/lib/chamberTemplates.js'), emit(), 'utf8');
  console.log('\nwrote src/lib/chamberTemplates.js');
}
if (!ok) {
  console.error('\nseat counts do not match the spec; fix generator params first');
  process.exit(1);
}