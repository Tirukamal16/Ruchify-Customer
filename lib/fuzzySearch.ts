/**
 * Fuzzy search utilities for food item matching.
 * Supports: synonym expansion, Levenshtein distance, case-insensitive & whitespace-tolerant matching.
 */

/** Map of canonical food name → list of accepted alternative spellings / regional names */
const FOOD_SYNONYMS: Record<string, string[]> = {
  idli:     ['idly', 'idlee', 'idlii'],
  dosa:     ['dose', 'dosha', 'dosai', 'thosai'],
  vada:     ['wada', 'wada', 'wade', 'vade', 'bada'],
  puri:     ['poori', 'puri', 'pooori'],
  chapati:  ['chapathi', 'chappati', 'chapathi', 'chappathi', 'chapatti'],
  paratha:  ['parota', 'parotta', 'paratha', 'parata'],
  biryani:  ['biriyani', 'briyani', 'biriani', 'beriani'],
  'veg biryani':   ['vegetable biryani', 'veg biriyani', 'weg biryani', 'veg briyani'],
  chicken:  ['chiken', 'chciken', 'chickn'],
  paneer:   ['panneer', 'panir', 'panner'],
  noodles:  ['nudles', 'nudels', 'noodels'],
  'fried rice': ['fry rice', 'fryrice', 'friedrice'],
  'pani puri':  ['panipuri', 'golgappa', 'puchka', 'gupchup', 'gol gappa'],
  tea:      ['chai', 'cha'],
  coffee:   ['cofee', 'coffe', 'cofffe', 'kafe', 'kaafi'],
  samosa:   ['samosa', 'samoosa', 'samasa'],
  uttapam:  ['uthappam', 'uttappam', 'uthapam'],
  upma:     ['uppma', 'upuma'],
  lassi:    ['laasi', 'lasee'],
  halwa:    ['halva', 'halva', 'halawa'],
  poha:     ['pohaa', 'aval', 'avalakki'],
  'dal makhani': ['daal makhani', 'dal makhni', 'daal makhni'],
  rajma:    ['rajmah', 'rajmaa'],
  chole:    ['chhole', 'choley', 'chana masala', 'chole masala'],
  kulfi:    ['kulfee', 'qulfi'],
  khichdi:  ['khichdi', 'khichri', 'khichree'],
  payasam:  ['payasam', 'kheer', 'keer'],
  appam:    ['appam', 'aappam'],
};

/** Expand a query term using the synonym dictionary. Returns all terms to check. */
function expandSynonyms(q: string): string[] {
  const terms = new Set<string>([q]);
  // Check if query matches any canonical key or value
  for (const [canonical, variants] of Object.entries(FOOD_SYNONYMS)) {
    const allForms = [canonical, ...variants];
    if (allForms.some((f) => f === q || f.includes(q) || q.includes(f))) {
      allForms.forEach((f) => terms.add(f));
    }
  }
  return Array.from(terms);
}

/** Levenshtein distance between two strings (capped for performance). */
function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99; // fast reject
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Returns true if `text` fuzzy-matches `query`.
 * Handles: case, whitespace, synonyms, and small typos (≤2 edits for words ≥5 chars).
 */
export function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const q = query.toLowerCase().replace(/\s+/g, ' ').trim();

  // 1. Exact substring (fastest path)
  if (t.includes(q)) return true;

  // 2. Synonym expansion
  const synonyms = expandSynonyms(q);
  for (const syn of synonyms) {
    if (t.includes(syn)) return true;
  }

  // 3. Word-level Levenshtein for typo tolerance
  const queryWords = q.split(' ');
  const textWords = t.split(' ');
  for (const qw of queryWords) {
    if (qw.length < 4) continue; // skip very short words — too noisy
    const maxEdits = qw.length >= 7 ? 2 : 1;
    if (textWords.some((tw) => levenshtein(qw, tw) <= maxEdits)) return true;
  }

  return false;
}
