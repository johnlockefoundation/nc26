// The 7-day Kalshi move, drawn in three places: the arrow beside the figure in
// the panel, the arrow pulsing over a district on the map, and the line in the
// district tooltip. Each used to derive its own glyph from the same delta and
// drift, which is what put a slanted arrow on the map and a straight one in the
// panel for one and the same move.
//
// One helper owns all three, so they cannot drift again. A caller with a delta
// asks here; a caller that gets null shows nothing.
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