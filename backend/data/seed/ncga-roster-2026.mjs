// Current NCGA roster, 2025-2026 session, from the member lists at
// ncleg.gov/Members/MemberList/{H,S}/District.
//
// Two things this data has that the seed did not:
//
//  * Five seats changed hands mid-session by appointment rather than at an
//    election -- HD-40, HD-47, HD-60, HD-90, HD-119 and four Senate seats --
//    and the appointed successor is the sitting member, not the person the
//    seed names. District 90 was Stevens until 16 June 2026 and Kiger from
//    23 June; 119 was Clampitt until his death in March and Ferguson from
//    April; Senate 1 was Hanig until 24 August and Tillett from 3 September.
//    Several of those successors are themselves on the 2026 ballot, so the
//    seed has them as candidates while recording them as non-incumbents.
//
//  * Two House seats are held by unaffiliated members. Majeed in the 99th and
//    Cunningham in the 106th carry (U) on the roster, which is neither party
//    and is not something a D/R colour can honestly represent.
//
// Where a district has two roster entries the later one carries the Appointed
// note and is the current member.

export const HOUSE_ROSTER = `
1 R Edward Goodwin|2 D B. Ray Jeffers|3 R Steve Tyson|4 R Jimmy Dixon|5 R Bill Ward|6 R Joseph Pike|
7 R Matthew Winslow|8 D Gloristine Brown|9 R Timothy Reeder|10 R John R. Bell IV|11 D Allison A. Dahle|
12 R Chris Humphrey|13 R Celeste C. Cairns|14 R Wyatt Gable|15 R Phil Shepard|16 R Carson Smith|
17 R Frank Iler|18 D Deb Butler|19 R Charles W. Miller|20 R Ted Davis Jr|21 D Ya Liu|
22 R William D. Brisson|23 D Shelly Willingham|24 D Dante Pittman|25 R Allen Chesser|
26 R Donna McDowell White|27 D Rodney D. Pierce|28 R Larry C. Strickland|29 D Vernetta Alston|
30 D Marcia Morey|31 D Zack Hawkins|32 D Bryan Cohn|33 D Monika Johnson-Hostler|34 D Tim Longest|
35 R Mike Schietzelt|36 D Julie von Haefen|37 R Erin Paré|38 D Abe Jones|39 D James Roberson|
40 D Phil Rubin|41 D Maria Cervania|42 D Mike Colvin|43 R Diane Wheatley|44 D Charles Smith|
45 D Frances Jackson|46 R Brenden H. Jones|47 R John L. Lowery|48 D Garland E. Pierce|
49 D Cynthia Ball|50 D Renée A. Price|51 R John Sauls|52 R Ben T. Moss Jr|53 R Howard Penny Jr|
54 D Robert T. Reives II|55 R Mark Brody|56 D Allen Buansi|57 D Tracy Clark|58 D Amos L. Quick III|
59 R Jerry Alan Branson|60 D Amanda P. Cook|61 D Pricey Harrison|62 R John M. Blust|
63 R Stephen M. Ross|64 R Dennis Riddell|65 R A. Reece Pyrtle Jr|66 D Sarah Crawford|
67 R Cody Huneycutt|68 R David Willis|69 R Dean Arp|70 R Brian Biggs|71 D Kanika Brown|
72 D Amber M. Baker|73 R Jonathan L. Almond|74 R Jeff Zenger|75 R Donny Lambeth|76 R Harry Warren|
77 R Julia C. Howard|78 R Neal Jackson|79 R Keith Kidwell|80 R Sam Watford|81 R Larry W. Potts|
82 R Brian Echevarria|83 R Grant L. Campbell|84 R Jeffrey C. McNeely|85 R Dudley Greene|
86 R Hugh Blackwell|87 R Destin Hall|88 D Mary Belk|89 R Mitchell S. Setzer|90 R Dan Kiger|
91 R Kyle Hall|92 D Terry M. Brown Jr|93 R Ray Pickett|94 R Blair Eddins|95 R Todd Carver|
96 R Jay Adams|97 R Heather H. Rhyne|98 D Beth Helfrich|99 U Nasif Majeed|100 D Julia Greenfield|
101 D Carolyn G. Logan|102 D Becky Carney|103 D Laura Budd|104 D Brandon Lofton|
105 R Tricia Ann Cotham|106 U Carla D. Cunningham|107 D Aisha O. Dew|108 R John A. Torbett|
109 R Donnie Loftis|110 R Kelly E. Hastings|111 R Paul Scott|112 D Jordan Lopez|
113 R Jake Johnson|114 D Eric Ager|115 D Lindsey Prather|116 D Brian Turner|
117 R Jennifer Balkcom|118 R Mark Pless|119 R Anna Ferguson|120 R Karl E. Gillespie|
`;

export const SENATE_ROSTER = `
1 R Jerry Tillett|2 R Norman W. Sanderson|3 R Bob Brinson|4 R Buck Newton|5 D Kandie D. Smith|
6 R Michael A. Lazzara|7 R Michael V. Lee|8 R Bill Rabon|9 R Brent Jackson|10 R Benton G. Sawrey|
11 R Lisa S. Barnes|12 R Jim Burgin|13 D Lisa Grafstein|14 D Dan Blue|15 D Jay J. Chaudhuri|
16 D Gale Adcock|17 D Sydney Batch|18 D Haseeb Fatmi|19 D Val Applewhite|20 D Natalie S. Murdock|
21 R Tom McInnis|22 D Sophia Chitlik|23 D Jonah Garson|24 R Danny Earl Britt Jr|
25 R Amy S. Galey|26 R Phil Berger|27 D Michael Garrett|28 D Gladys A. Robinson|
29 R David W. Craven Jr|30 R Steve Jarvis|31 R Dana Jones|32 D Paul A. Lowe Jr|33 R Carl Ford|
34 R Chris Measmer|35 R Todd Johnson|36 R Eddie D. Settle|37 R Vickie Sawyer|38 D Mujtaba A. Mohammed|
39 D DeAndrea Salvador|40 D Joyce Waddell|41 D Caleb Theodros|42 D Woodson Bradley|
43 R Brad Overcash|44 R W. Ted Alexander|45 R Mark Hollo|46 R Warren Daniel|47 R Ralph Hise|
48 R Timothy D. Moffitt|49 D Julie Mayfield|50 R Kevin Corbin|
`;

// Seats whose sitting member changed hands mid-session by appointment. The
// successor is the current holder; the seed names the outgoing member, or names
// nobody at all, which is why `incumbent` was false on both of their candidates.
// Written in the districts table's own id form, which is NOT the roster's:
// civitas.js zero-pads Senate numbers to two digits, so district 1 is `SD-01`
// here and `SD-1` in the roster block above. The first draft of this set used the
// roster's form and silently corrected four of the five successors instead of
// five -- a Set membership test that never fires, with nothing to say so. If a
// successor stops being corrected, check this padding first.
export const APPOINTED_SUCCESSORS = new Set([
  'HD-40', 'HD-47', 'HD-60', 'HD-90', 'HD-119',
  'SD-01', 'SD-18', 'SD-23', 'SD-34',
]);

export function parseRoster(block) {
  const out = new Map();
  // Collapse all whitespace before splitting: the block is wrapped for
  // readability, so a single entry routinely spans a line break. Splitting on the
  // pipe first would hand back fragments like "6 R Joseph Pike\n7 R Matthew
  // Winslow", which is exactly what the parse assertion below is there to catch.
  for (const chunk of block.trim().replace(/\s+/g, ' ').split('|')) {
    if (!chunk.trim()) continue;
    const m = /^(\d+)\s+([RDU])\s+(.+)$/.exec(chunk.trim());
    if (!m) throw new Error(`unparseable roster entry: ${JSON.stringify(chunk)}`);
    const n = Number(m[1]);
    if (out.has(n)) throw new Error(`duplicate district ${n} in roster`);
    out.set(n, { party: m[2], name: m[3].trim() });
  }
  return out;
}

export const HOUSE = parseRoster(HOUSE_ROSTER);
export const SENATE = parseRoster(SENATE_ROSTER);

for (const [label, roster, size] of [['house', HOUSE, 120], ['senate', SENATE, 50]]) {
  if (roster.size !== size) {
    throw new Error(`${label} roster has ${roster.size} districts, expected ${size}`);
  }
  for (let i = 1; i <= size; i++) {
    if (!roster.has(i)) throw new Error(`${label} roster is missing district ${i}`);
  }
}