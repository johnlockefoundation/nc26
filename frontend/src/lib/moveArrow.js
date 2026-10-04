// The 7-day Kalshi move, drawn in three places: the arrow beside the figure in
// the panel, the arrow pulsing over a district on the map, and the line in the
// district tooltip. Each used to derive its own glyph, colour class and wording
// from the same delta, and drifted -- the map ended up on diagonal glyphs and a
// second keyframe, so one fact read two ways depending on where you looked.
//
// One helper owns all three, so they cannot drift again. A caller with a delta
// asks here; a caller that gets null shows nothing.
//
// Horizontal is deliberate. A diagonal placed over a map of North Carolina
// districts is a compass bearing: the north-west glyph beside a seat reads as
// "north-west" to someone with no reason to know it means "toward the
// Democrats". Left and right survives being drawn over geography.

const POINTS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function moveArrow(delta) {
  if (!delta || !delta.party || delta.party === 'EVEN') return null;
  const towardD = delta.party === 'D';
  return {
    // Left means the race moved toward the Democrats, as in most election
    // coverage. Never "up": a rise in one side is a fall in the other, and
    // drawing it as a climb invites reading it as a trend line.
    glyph: towardD ? '←' : '→',
    cls: towardD ? 'move-d' : 'move-r',
    // One sentence, used verbatim by all three renderings. The panel arrow
    // keeps it as a title attribute, the tooltip shows it as text.
    text: `${POINTS.format(delta.points)}¢ toward ${delta.party} on Kalshi over the past week`,
  };
}