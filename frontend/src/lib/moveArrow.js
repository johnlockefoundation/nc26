// The 7-day Kalshi move, drawn on the map: the arrow pulsing over a district,
// and the line in the district tooltip that explains it. Both read the glyph
// from here, so the arrow and its own explanation cannot disagree.
//
// This is deliberately the only place the move is drawn. It used to appear in
// the panel's Kalshi box as well, and that was the problem: the box states who
// is ahead in the figure and in its colour, so a slanted arrow beside it
// pointing the other way -- which is the normal case, not a rare one, since a
// seat's lean and its weekly move disagree regularly -- read as a second,
// contradictory verdict rather than as a trend.
//
// A caller with a delta asks here; a caller that gets null shows nothing.
//
// The glyph is slanted, up-left toward the Democrats and up-right toward the
// Republicans, in both renderings. Left and right are the standing advantage,
// which is what the figure beside the arrow already says; the slant is the
// weekly move, and giving it its own shape keeps the two from being read as the
// same fact twice.

const POINTS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function moveArrow(delta) {
  if (!delta || !delta.party || delta.party === 'EVEN') return null;
  const towardD = delta.party === 'D';
  return {
    // Drawn, not typed. The two Unicode arrow codepoints do not resolve to the
    // same face: on the inherited stack U+2196 measures 42.1 wide with no descent
    // while U+2197 measures 46 with 3.6 below the baseline, so the same arrow
    // renders at two different weights depending on which way it points. Naming a
    // symbol font does not fix it either -- Apple Symbols and Arial Unicode MS
    // give consistent metrics, and neither exists on every platform this ships to.
    //
    // One path, mirrored. A horizontal flip cannot change stroke weight, so the
    // two directions are the same mark by construction rather than by luck.
    svg: `<svg class="arrow-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"${towardD ? ' transform="translate(24 0) scale(-1 1)"' : ''}>
        <path d="M4.5 19.5 19 5"/>
        <path d="M19 5h-6.5"/>
        <path d="M19 5v6.5"/>
      </g>
    </svg>`,
    cls: towardD ? 'move-d' : 'move-r',
    // One sentence, used verbatim by all three renderings. The panel arrow
    // keeps it as a title attribute, the tooltip shows it as text.
    text: `${POINTS.format(delta.points)}¢ toward ${delta.party} on Kalshi over the past week`,
  };
}