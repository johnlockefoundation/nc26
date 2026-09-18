const W = 106;
const H = 42;
const CX = W / 2;
const CY = H - 3;
const R = 34;

function pt(deg, r) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(a0, a1) {
  const p0 = pt(a0, R);
  const p1 = pt(a1, R);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

function angleFor(seats, total) {
  const frac = seats / total;
  return 180 + Math.min(1, Math.max(0, frac)) * 180;
}

export default function MiniGauge({ outlook, label }) {
  if (!outlook) return null;
  const { dem, rep, tossup = 0, threshold, total, source } = outlook;

  const thrAngle = angleFor(threshold, total);
  const lead = rep - dem;
  const leadLabel = lead > 0 ? `R +${lead}` : lead < 0 ? `D +${-lead}` : 'EVEN';
  const leadClass = lead > 0 ? 'lead-r' : lead < 0 ? 'lead-d' : '';

  const needleAngle = angleFor(dem, total);
  const tip = pt(needleAngle, 24);
  const base = pt(needleAngle, 6);
  const thrTop = pt(thrAngle, R - 13);

  return (
    <div className="mini-gauge" title={`${label} — ${dem} D · ${rep} R${tossup ? ` · ${tossup} T` : ''} (${threshold} for majority) · ${source}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${leadLabel}, projected control`}>
        <path d={arcPath(180, 360)} fill="none" stroke="#16223a" strokeWidth={10} strokeLinecap="round" />
        <path d={arcPath(180, thrAngle)} fill="none" stroke="#b91c1c" strokeWidth={10} opacity={0.55} strokeLinecap="round" />
        <path d={arcPath(thrAngle, 360)} fill="none" stroke="#1d4ed8" strokeWidth={10} opacity={0.55} strokeLinecap="round" />
        <line x1={thrTop.x} y1={thrTop.y} x2={pt(thrAngle, R - 3).x} y2={pt(thrAngle, R - 3).y} stroke="#8b9cb0" strokeWidth={1.5} />
        <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke="#e2e8f0" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={3.5} fill="#e2e8f0" />
      </svg>
      <div className="mini-gauge-meta">
        <span className="gauge-name">{label}</span>
        <span className={`gauge-lead ${leadClass}`}>{leadLabel}</span>
      </div>
    </div>
  );
}