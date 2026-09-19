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
  const { dem, rep, tossup = 0, threshold, total, today, source } = outlook;

  const thrAngle = angleFor(threshold, total);

  const todayDem = today?.dem ?? dem;
  const todayRep = today?.rep ?? rep;
  const shift = (dem - rep) - (todayDem - todayRep);
  const gainParty = shift > 0.5 ? 'D' : shift < -0.5 ? 'R' : 'EVEN';
  const gainLabel = gainParty === 'EVEN' ? 'EVEN' : `${gainParty} +${Math.abs(Math.round(shift))}`;

  const currentMaj = todayRep > todayDem ? 'R' : todayDem > todayRep ? 'D' : 'EVEN';
  let projMaj = dem >= threshold ? 'D' : rep >= threshold ? 'R' : 'TOSS';
  const outcome = projMaj === 'TOSS'
    ? 'TOSS-UP'
    : projMaj === currentMaj ? `${projMaj} HOLD` : `${projMaj} FLIP`;
  const outcomeCls = outcome.startsWith('D') ? 'outcome-d' : outcome.startsWith('R') ? 'outcome-r' : 'outcome-t';
  const isToss = projMaj === 'TOSS';
  const gainCls = !isToss && gainParty === 'D' ? 'lead-d' : !isToss && gainParty === 'R' ? 'lead-r' : '';

  const needleAngle = angleFor(dem, total);
  const tip = pt(needleAngle, 24);
  const base = pt(needleAngle, 6);
  const thrTop = pt(thrAngle, R - 13);

  return (
    <div className="mini-gauge" title={`${label} — today ${todayDem}D/${todayRep}R, projection ${dem}D · ${rep}R${tossup ? ` · ${tossup} T` : ''} (${threshold} for majority). Gain vs today: ${gainLabel}. ${outcome}. ${source}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${outcome}${!isToss && gainParty !== 'EVEN' ? `, ${gainLabel} vs today` : ''}`}>
        <path d={arcPath(180, 360)} fill="none" stroke="#16223a" strokeWidth={10} strokeLinecap="round" />
        <path d={arcPath(180, thrAngle)} fill="none" stroke="#b91c1c" strokeWidth={10} opacity={0.55} strokeLinecap="round" />
        <path d={arcPath(thrAngle, 360)} fill="none" stroke="#1d4ed8" strokeWidth={10} opacity={0.55} strokeLinecap="round" />
        <line x1={thrTop.x} y1={thrTop.y} x2={pt(thrAngle, R - 3).x} y2={pt(thrAngle, R - 3).y} stroke="#8b9cb0" strokeWidth={1.5} />
        <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke="#e2e8f0" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={3.5} fill="#e2e8f0" />
      </svg>
      <div className="mini-gauge-meta">
        <span className="gauge-name">{label}</span>
        {!isToss && <span className={`gauge-lead ${gainCls}`}>{gainLabel}</span>}
      </div>
      <div className={`gauge-outcome ${outcomeCls}`}>{outcome}</div>
    </div>
  );
}