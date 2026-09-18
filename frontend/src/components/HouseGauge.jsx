// U.S. House "odometer": a semicircular fuel-gauge showing projected seat split
// (D vs R) against the 218-seat majority line. Data comes from meta.house_outlook.

const SCALE_MIN = 195;
const SCALE_MAX = 241;
const CX = 110;
const CY = 110;
const R = 88;

function pt(deg, r) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(a0, a1, r = R) {
  const p0 = pt(a0, r);
  const p1 = pt(a1, r);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

function angleFor(seats) {
  const frac = (seats - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
  return 180 + Math.min(1, Math.max(0, frac)) * 180;
}

export default function HouseGauge({ outlook }) {
  if (!outlook) return null;
  const { dem, rep, tossup, threshold, source, updated_at: updated } = outlook;

  const thrAngle = angleFor(threshold);
  const lead = rep - dem;
  const leadLabel = lead > 0 ? `R +${lead}` : lead < 0 ? `D +${-lead}` : 'EVEN';
  const leadClass = lead > 0 ? 'lead-r' : lead < 0 ? 'lead-d' : '';
  const needleAngle = angleFor(dem);
  const needleTip = pt(needleAngle, 60);
  const needleBase = pt(needleAngle, 12);

  const ticks = [];
  for (let v = SCALE_MIN + 1; v < SCALE_MAX; v += 4) {
    const major = v % 10 === 0 || v === threshold;
    const a = angleFor(v);
    const p0 = pt(a, R - (major ? 14 : 8));
    const p1 = pt(a, R - 3);
    ticks.push(<line key={v} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#1e2a3a" strokeWidth={major ? 1.6 : 1} />);
  }

  const thrTop = pt(thrAngle, R - 18);

  return (
    <div className="house-gauge">
      <div className="house-gauge-header">
        <span className="house-gauge-title">U.S. House — projected control</span>
        <span className="house-gauge-src dim">{source} · {updated ? updated.slice(0, 10) : ''}</span>
      </div>
      <div className="house-gauge-body">
        <svg className="house-gauge-svg" viewBox="0 0 220 130" role="img"
          aria-label={`Projected U.S. House majority: ${leadLabel}, ${dem} Democrat, ${rep} Republican, ${tossup} toss-up`}>
          <path d={arcPath(180, 360)} fill="none" stroke="#16223a" strokeWidth={26} strokeLinecap="round" />
          <path d={arcPath(180, thrAngle)} fill="none" stroke="#b91c1c" strokeWidth={26} opacity={0.55} strokeLinecap="round" />
          <path d={arcPath(thrAngle, 360)} fill="none" stroke="#1d4ed8" strokeWidth={26} opacity={0.55} strokeLinecap="round" />
          {ticks}
          <line x1={needleBase.x} y1={needleBase.y} x2={needleTip.x} y2={needleTip.y}
            stroke="#e2e8f0" strokeWidth={3.5} strokeLinecap="round" />
          <circle cx={CX} cy={CY} r={7} fill="#e2e8f0" />
          <text x={thrTop.x} y={thrTop.y} textAnchor="middle" fontSize="11" fontWeight="800" fill="#8b9cb0">{threshold}</text>
          <text x={27} y={108} fontSize="13" fontWeight="800" fill="#f87171">R</text>
          <text x={193} y={108} fontSize="13" fontWeight="800" fill="#60a5fa">D</text>
        </svg>
        <div className="house-gauge-read">
          <div className={`read-lead ${leadClass}`}>{leadLabel}</div>
          <div className="read-seats">
            <span className="s-d">{dem} D</span>
            <span className="s-r">{rep} R</span>
            <span className="s-t">{tossup} T</span>
          </div>
          <div className="read-note dim">{threshold} seats needed for a majority</div>
        </div>
      </div>
    </div>
  );
}