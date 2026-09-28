/**
 * Writing rules for the script and sets writers.
 *
 * Two failures seen in production (story 63bb7687, five scenes):
 *
 * 1. CONTINUITY PLUMBING LEAKED INTO THE SCRIPT. Every description opened with
 *    "The same subject, matching the user's photo", "outfit unchanged",
 *    "identical wardrobe". That is studio plumbing, not writing: it crowds out
 *    the actual action, makes every frame look alike, and it is text the user
 *    reads and edits. Identity and wardrobe belong on the CHARACTER RECORD and
 *    are injected into the image prompt at submit time — never into the script.
 *
 * 2. NO VARIETY. All five scenes were the one preset ("Luxury hotel"), and the
 *    beats never moved: enter, put keycard down, sit on sofa, sit at table,
 *    stay at table. A film has to travel.
 *
 * This module is pure and unit-tested (tests/story-writing.test.ts) so both the
 * prompt rules and the sanitising net cannot silently drift.
 */

/** Phrases that mean the model is describing the studio's plumbing, not a scene. */
const CONTINUITY_PATTERNS: RegExp[] = [
  /matching the user'?s photo/gi,
  /photo-?matched/gi,
  /\bidentical likeness\b/gi,
  /\bidentical (?:wardrobe|outfit|clothes|clothing)\b/gi,
  /\b(?:outfit|wardrobe|clothing|clothes)\s+unchanged\b/gi,
  /\bunchanged (?:outfit|wardrobe|clothing|clothes)\b/gi,
  /\bthe same (?:subject|person|woman|man|character)\b/gi,
  /\bthe main subject\b/gi,
  /\bthe same photo-?matched subject\b/gi,
  /\bwith the same photo-?matched likeness\b/gi,
  /\bin the same outfit\b/gi,
  /\bsame outfit\b/gi,
];

/** Does this description contain continuity plumbing? (the acceptance check) */
export function hasContinuityLeakage(description: string): boolean {
  return CONTINUITY_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(description);
  });
}

/**
 * Strip continuity plumbing from a description, keeping the cinematic content.
 * A safety net, not the fix: the prompt forbids this, but models drift and the
 * user must never end up editing studio plumbing.
 */
export function stripContinuityLeakage(description: string): string {
  let text = description;

  // A leading identity clause ("The main subject, matching the user's photo, …"
  // / "The same subject, with the same photo-matched likeness and unchanged
  // outfit, …") — drop the clause, keep the sentence.
  const leading = new RegExp(
    String.raw`^\s*(?:the\s+)?(?:main|same|photo-?matched)?\s*(?:photo-?matched\s+)?subject\b[^,;.]*?(?:matching the user'?s photo[^,;.]*?)?[,;]\s*`,
    "i",
  );
  if (hasContinuityLeakage(text)) text = text.replace(leading, "");

  // A leading "wearing the identical …" clause — the model's habit when told to
  // restate wardrobe. Drop the clause, keep the action that follows it. The
  // lookahead stops at the main verb (or a new sentence) rather than greedily
  // eating it, which is what keeps the actual scene intact.
  text = text.replace(/^\s*[,;]?\s*wearing\b[^.]*?,\s*(?=[a-z]+s\b|[Tt]hey\b)/, "");

  // Inline plumbing anywhere in the sentence.
  for (const pattern of CONTINUITY_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, "");
  }

  // Last resort: any surviving "identical/same" qualifier before a noun (the
  // acceptance rule bans those words about the subject outright).
  text = text.replace(/\b(?:the\s+)?(?:identical|same)\s+(?=[a-z])/gi, "");

  // Tidy the punctuation the removals left behind, then re-capitalise.
  text = text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/^[\s,;.]+/, "")
    .replace(/,\s*([.;])/g, "$1")
    .trim();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ─── Location variety ────────────────────────────────────────────────────────

/** The most consecutive scenes allowed in one unbroken location, by default. */
export const MAX_CONSECUTIVE_SAME_LOCATION = 2;

/** Longest run of identical, consecutive location names. */
export function longestLocationRun(names: readonly string[]): number {
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const raw of names) {
    const name = raw.trim().toLowerCase();
    if (name.length === 0) {
      run = 0;
      previous = null;
      continue;
    }
    run = name === previous ? run + 1 : 1;
    previous = name;
    longest = Math.max(longest, run);
  }
  return longest;
}

export function distinctLocationCount(names: readonly string[]): number {
  return new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean)).size;
}

/** How many different locations a film of this length should move through. */
export function requiredLocationCount(sceneCount: number): number {
  if (sceneCount <= 2) return sceneCount;
  return Math.min(sceneCount, Math.max(3, Math.ceil(sceneCount / 2)));
}

/**
 * Does a proposed set list actually travel? Requires enough distinct places AND
 * no single room running longer than the cap. Used to retry the sets writer once
 * before accepting a film that never moves.
 */
export function locationVarietyOk(names: readonly string[], sceneCount: number): boolean {
  if (names.length === 0) return false;
  if (distinctLocationCount(names) < requiredLocationCount(sceneCount)) return false;
  return longestLocationRun(names) <= MAX_CONSECUTIVE_SAME_LOCATION;
}
