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
    glyph: towardD ? '↖' : '↗',
    cls: towardD ? 'move-d' : 'move-r',
    // One sentence, used verbatim by all three renderings. The panel arrow
    // keeps it as a title attribute, the tooltip shows it as text.
    text: `${POINTS.format(delta.points)}¢ toward ${delta.party} on Kalshi over the past week`,
  };
}