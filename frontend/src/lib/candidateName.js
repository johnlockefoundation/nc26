// Candidate names arrive from the John Locke / Civitas sheet with the honorific
// and suffix the candidate actually uses on the ballot ("Mrs. Woodson Bradley",
// "Danny Earl Britt, Jr."), so any code that picks the first or last word has to
// step over those tokens rather than read them as name parts. Counting "Mrs." as
// a first name rendered MW, and taking the last token rendered "Jr." on the map.
//
// Parentheticals are stripped first: the sheet carries "Jessica (Jess) Rivera"
// for candidates who go by the nickname, and a naive first-char read yields "J(".

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'rev', 'hon', 'prof']);
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

function bare(word) {
  return word.replace(/\.$/, '').toLowerCase();
}

// The name parts that actually identify someone, in display order.
export function nameParts(name) {
  const words = (name || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z.'-]/g, ''))
    .filter((w) => /[A-Za-z]/.test(w[0] || ''));
  const core = words.filter((w) => !HONORIFICS.has(bare(w)) && !SUFFIXES.has(bare(w)));
  // A name made only of honorifics/suffixes ("Rev. Jr.") still has to render
  // something, so fall back to the untouched words.
  return core.length > 0 ? core : words;
}

// Two letters off the front and last name, which is what a monogram is for.
// Middle names are kept in place but never counted, so "James M. Rogers" is JR
// and "Robert J. Jackson III" is RJ. A one-word name has no last name to pair
// with, so it gets a single letter rather than "CC".
export function initials(name) {
  const parts = nameParts(name);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Surname only, for the cramped map labels. "Danny Earl Britt, Jr." is Britt,
// not Jr.
export function surname(name) {
  const parts = nameParts(name);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}
