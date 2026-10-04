// The weekly move is one fact that the page draws in three places: the arrow
// beside the Kalshi figure in the panel, the arrow pulsing over a district on
// the map, and the line inside the district tooltip. Each of those used to
// derive its own glyph, its own colour class and its own wording, which is how
// they came to disagree -- the map drifted onto diagonals and a separate
// keyframe while the panel kept arrows, so the same move read as two different
// things depending on where you looked.
//
// One helper, so the three cannot drift again. A caller that has a delta and
// wants to show the move asks here; a caller that gets null shows nothing.
//
// The glyph is horizontal on purpose. A diagonal arrow placed over a map of
// North Carolina districts is a compass bearing: the north-west glyph beside a
// seat reads as "north-west" to a reader who has no reason to know it means
// "toward the Democrats". Left and right survives being put over geography,
// and it is the convention the panel already used -- which is exactly why the
// two used to contradict each other.

const POINTS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function moveArrow(delta) {
  if (!delta || !delta.party || delta.party === 'EVEN') return null;
  const towardD = delta.party === 'D';
  return {
    towardD,
    party: delta.party,
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