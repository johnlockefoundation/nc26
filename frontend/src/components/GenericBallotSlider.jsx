import {
  GENERIC_MAX,
  GENERIC_MIN,
  genericLabel,
  tallyInPlay,
} from '../lib/vulnerability.js';

// The generic ballot control, and the tally that goes with it.
//
// The control is only shown in the seats view, because it is meaningless
// anywhere else: it moves the Civitas index that the hemicycle's rings are drawn
// from, and on the map those rings are not shown at all. A slider that changes a
// number you cannot see is worse than no slider.
//
// The tally carries the two numbers that answer the question the control asks --
// how many seats are in play, and how many of those are held by each party. It
// used to carry a third, the cycle's own competitive designation, as a
// comparison. That is gone: at a generic ballot of zero this arithmetic is
// symmetric while the published designation is not, and showing the two numbers
// side by side read as a discrepancy to be reconciled rather than as the
// published designation it is.
export default function GenericBallotSlider({ races, generic, onChange, margin }) {
  const tally = tallyInPlay(races, generic, margin);

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
      />

      <div className="gb-scale" aria-hidden="true">
        <span>D +{Math.abs(GENERIC_MIN)}</span>
        <span>EVEN</span>
        <span>R +{GENERIC_MAX}</span>
      </div>

      <div className="gb-tally">
        <span className="gb-tally-lead">
          <strong>{tally.total}</strong> in play
        </span>
        <span className="gb-tally-break">
          <span className="gb-chip gb-chip-d">{tally.heldD} held by D</span>
          <span className="gb-chip gb-chip-r">{tally.heldR} held by R</span>
        </span>
      </div>
    </div>
  );
}