// Links out to the standalone Carolina Elections tracker.
//
// The tracker carries the underlying vote and registration data for a district,
// which is a different site from this one and a fuller record than a panel can
// show. These links are how a reader gets from a figure here to the source it
// came from.
//
// The path segment is a constant; only the query parameter varies, and which one
// depends on the chamber. A house seat is houseDistrict, a senate seat is
// senateDistrict, and the value is the district number -- so NC House district
// 60 is ?houseDistrict=60 and NC Senate district 12 is ?senateDistrict=12.
//
// Returned as null for anything unrecognised rather than a best guess. A link
// that points at the wrong district is worse than no link, because it looks like
// it works.

const TRACKER_BASE = 'https://carolinaelections.com/tracker/66';

export function trackerUrl(race) {
  if (!race) return null;
  const n = race.district_number;
  if (n == null || Number.isNaN(Number(n))) return null;

  switch (race.race_type) {
    case 'us_house':
    case 'state_house':
      return `${TRACKER_BASE}?houseDistrict=${n}`;
    case 'us_senate':
    case 'state_senate':
      return `${TRACKER_BASE}?senateDistrict=${n}`;
    default:
      return null;
  }
}

export const TRACKER_LINK_TEXT = 'Open this district in the Carolina Elections tracker';