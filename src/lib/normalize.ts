/**
 * Mongolian business-name normalisation & fuzzy matching helpers.
 * Used by the import pipeline and de-duplication.
 */

// Legal-entity suffixes to strip for matching (Mongolian + common Latin).
const LEGAL_SUFFIXES = [
  "ххк", "ххн", "ххт", "өхк", "тхк", "нххк",
  "llc", "ltd", "co", "co.", "inc", "inc.", "jsc", "group", "grogroup",
];

// Cyrillic ↔ Latin lookalike folding so "Café" / "Кафе" variants converge.
const FOLD: Record<string, string> = {
  "ё": "е", "й": "и", "ъ": "", "ь": "",
};

/**
 * Normalise a name for de-dup:
 *  - lowercase, trim, collapse whitespace
 *  - strip punctuation & legal suffixes (ХХК, LLC, …)
 *  - fold lookalike letters
 */
export function normalizeBusinessName(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/["'«»“”‘’`.,()\-_/\\|]+/g, " ");
  s = [...s].map((ch) => FOLD[ch] ?? ch).join("");
  s = s.replace(/\s+/g, " ").trim();

  const tokens = s.split(" ").filter((t) => t && !LEGAL_SUFFIXES.includes(t));
  return tokens.join(" ").trim();
}

/** Normalise a Mongolian phone number to digits (drops +976, spaces, dashes). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  // Strip Mongolia country code if present.
  const local = digits.startsWith("976") && digits.length > 8 ? digits.slice(3) : digits;
  return local.slice(-8); // local UB numbers are 8 digits
}

/** Levenshtein distance (small strings — used for name similarity). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

/** Name similarity 0..1 based on normalised Levenshtein. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeBusinessName(a);
  const nb = normalizeBusinessName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

export type DedupeCandidate = {
  name: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  categorySlug?: string | null;
};

/**
 * Confidence (0..1) that two business records are the same entity.
 * Combines name similarity, phone match, proximity (<50 m), and category.
 */
export function duplicateConfidence(
  a: DedupeCandidate,
  b: DedupeCandidate,
): number {
  let score = 0;
  const nameSim = nameSimilarity(a.name, b.name);
  score += nameSim * 0.5;

  const pa = normalizePhone(a.phone);
  const pb = normalizePhone(b.phone);
  if (pa && pb && pa === pb) score += 0.3;

  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const d = haversine(a.lat, a.lng, b.lat, b.lng);
    if (d <= 50) score += 0.15;
    else if (d <= 150) score += 0.07;
  }

  if (a.categorySlug && b.categorySlug && a.categorySlug === b.categorySlug) {
    score += 0.05;
  }

  return Math.min(1, score);
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const DUPLICATE_THRESHOLD = 0.75;
