/**
 * Brand names, in one place.
 *
 * CineStory is one app in the Peyris family, so the name appears in two
 * registers and they must not be confused:
 *
 *   · `full` is the brand mark — the wordmark, the page title, the footer,
 *     anything that identifies the product to someone who does not know it.
 *   · `product` is the short form, used when the name is the subject of a
 *     sentence ("CineStory writes the script"), the way "Photoshop" stands in
 *     for "Adobe Photoshop" in running prose.
 *
 * Renaming the product is a change to this file and nothing else.
 */
export const BRAND = {
  /** The family every Peyris app belongs to. */
  family: "Peyris",
  /** Short form, for prose and in-app section labels. */
  product: "CineStory",
  /** The brand mark. */
  full: "Peyris CineStory",
} as const;

/** Title used for the document title and Open Graph. */
export const BRAND_TITLE = `${BRAND.full} — the AI film studio you direct`;
