import {
  GENERIC_MAX,
  GENERIC_MIN,
  genericLabel,
  vulnerabilitySummary,
} from '../lib/vulnerability.js';

// The generic ballot control, and the tally that goes with it.
//
// The slider is the honest part of this feature and the label is where most of
// the honesty has to live. Two traps:
//
//  1. Subtracting a statewide number from a district index is arithmetic, not a
//     forecast, and nothing here carries a margin of error. "In play" means
//     "within four points of the state on the Civitas index", so that is what
//     the caption says.
//
//  2. At zero this arithmetic is symmetric while the published designation is
//     not -- the cycle counts toss-ups and lean Republican seats only, and skips
//     Democratic leans of the same size. So the tally always shows the
//     designated count beside the computed one. Without it a reader moves the
//     slider to zero, sees more seats in play than the map marks, and concludes
//     the page has found competitive seats nobody else can see. The two numbers
//     disagreeing at zero is a fact about the designation, and it is shown
//     rather than smoothed over.
export default function GenericBallotSlider({ races, generic, onChange, margin }) {
  const summary = vulnerabilitySummary(races, generic, margin);
  const delta = summary.vulnerable - summary.designatedTotal;

  return (
    <div className="gb">
      <div className="gb-head">
        <label className="gb-label" htmlFor="gb-range">GENERIC BALLOT</label>
        <output className="gb-value" htmlFor="gb-range">{genericLabel(generic)}</output>
      </div>

      <input
        id="gb-range"
        className="gb-range"
        type="range"
        min={GENERIC_MIN}
        max={GENERIC_MAX}
        step={1}
        value={generic}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby="gb-caption"
      />

      <div className="gb-scale" aria-hidden="true">
        <span>D +{Math.abs(GENERIC_MIN)}</span>
        <span>EVEN</span>
        <span>R +{GENERIC_MAX}</span>
      </div>

      <div className="gb-tally">
        <span className="gb-tally-lead">
          <strong>{summary.vulnerable}</strong> in play
        </span>
        <span className="gb-tally-break">
          <span className="gb-chip gb-chip-d">{summary.byHolder.D} held by D</span>
          <span className="gb-chip gb-chip-r">{summary.byHolder.R} held by R</span>
          {summary.byHolder.open > 0 && (
            <span className="gb-chip gb-chip-open">{summary.byHolder.open} open</span>
          )}
        </span>
        <span className="gb-tally-base">
          {summary.designatedTotal} designated competitive
          {delta !== 0 && (
            <span className="gb-delta">
              {' '}({delta > 0 ? '+' : ''}{delta} vs today)
            </span>
          )}
        </span>
      </div>

      <p className="gb-caption" id="gb-caption">
        A seat is in play when its Civitas index falls within {margin} points of this
        number. Index arithmetic, not a polling margin of error.
        {summary.unrated > 0 && ` ${summary.unrated} seat${summary.unrated === 1 ? '' : 's'} carry no index and are not counted.`}
      </p>
    </div>
  );
}