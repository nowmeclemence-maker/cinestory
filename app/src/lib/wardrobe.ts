/**
 * Wardrobe continuity for scene prompts.
 *
 * The screenwriter often writes "in the same outfit" in later scenes — fine for
 * a human reading the script in order, useless to an image model, which sees one
 * scene at a time with no memory of the last frame. The result is drift: scene 3
 * comes back in different clothes.
 *
 * So before a scene is generated, any back-reference is replaced with the cast's
 * explicit wardrobe, and the wardrobe is stated outright in the prompt. Pure and
 * unit-tested (tests/wardrobe.test.ts): this runs on every scene, and a bad
 * rewrite would silently change what the film looks like.
 */

/** Phrases that point at earlier scenes instead of describing the clothes. */
const BACK_REFERENCE = String.raw`(?:the\s+)?same\s+(?:outfit|clothes|clothing|dress|attire|look|shirt|suit|coat|wardrobe)`;

/** "…in the same outfit…" (with a preposition) → "…wearing <wardrobe>…" */
const WITH_PREPOSITION = new RegExp(String.raw`\b(?:in|wearing|with)\s+${BACK_REFERENCE}\b`, "gi");

/** A bare "…the same outfit…" left over after the first pass. */
const BARE = new RegExp(String.raw`\b${BACK_REFERENCE}\b`, "gi");

/** True when text leans on an earlier scene for its wardrobe. */
export function hasWardrobeBackReference(text: string): boolean {
  return new RegExp(`${WITH_PREPOSITION.source}|${BARE.source}`, "i").test(text);
}

/** Normalise a cast member's clothing field (drops a leading "wearing"). */
export function normalizeWardrobe(clothing: string | null | undefined): string {
  return (clothing ?? "").replace(/^\s*wearing\s+/i, "").trim();
}

/**
 * Replace every wardrobe back-reference with the explicit clothing text.
 * Returns the text unchanged when there is nothing to rewrite or no wardrobe to
 * substitute (better an honest back-reference than a mangled sentence).
 */
export function expandWardrobeBackReferences(text: string, clothing: string | null | undefined): string {
  const wardrobe = normalizeWardrobe(clothing);
  if (!text || wardrobe.length === 0) return text;
  return text.replace(WITH_PREPOSITION, `wearing ${wardrobe}`).replace(BARE, wardrobe);
}

/** The wardrobe line added to every scene prompt, when the cast defines one. */
export function wardrobePromptLine(clothing: string | null | undefined): string {
  const wardrobe = normalizeWardrobe(clothing);
  return wardrobe.length === 0
    ? ""
    : `Wardrobe (identical in every scene, do not change it): ${wardrobe}.`;
}
