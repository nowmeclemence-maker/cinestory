import { describe, expect, test } from "bun:test";
import {
  expandWardrobeBackReferences,
  hasWardrobeBackReference,
  normalizeWardrobe,
  wardrobePromptLine,
} from "@/lib/wardrobe";

/**
 * Regression for a real failure: on story 342b4394 ("A Table for Me") scene 3
 * read "…stops beneath an awning in the same outfit…" — a back-reference the
 * image model cannot resolve, so the scene came back in different clothes.
 * Scenes 1 and 2 spelled the wardrobe out; scene 3 did not.
 */
const REAL_WARDROBE = "a tailored ivory zip-front coat over a black dress, black ankle boots, and small gold earrings";
const REAL_SCENE_3 =
  "Just beyond the hotel entrance, the same woman stops beneath an awning in the same outfit, tiny raindrops catching on her ivory shoulders. She turns toward the camera.";

describe("wardrobe back-references", () => {
  test("detects the phrasing that caused the drift", () => {
    expect(hasWardrobeBackReference("…in the same outfit…")).toBe(true);
    expect(hasWardrobeBackReference("wearing the same coat")).toBe(true);
    expect(hasWardrobeBackReference("the same clothes as before")).toBe(true);
    expect(hasWardrobeBackReference("wearing a black dress and ankle boots")).toBe(false);
  });

  test("replaces the back-reference with the explicit wardrobe", () => {
    const expanded = expandWardrobeBackReferences(REAL_SCENE_3, REAL_WARDROBE);

    expect(expanded).not.toContain("same outfit");
    expect(expanded).toContain(`wearing ${REAL_WARDROBE}`);
    // The rest of the sentence survives untouched.
    expect(expanded).toContain("Just beyond the hotel entrance");
    expect(expanded).toContain("tiny raindrops catching on her ivory shoulders");
  });

  test('keeps the "same woman" reference — only wardrobe words are rewritten', () => {
    const expanded = expandWardrobeBackReferences(REAL_SCENE_3, REAL_WARDROBE);
    expect(expanded).toContain("the same woman");
  });

  test("handles a bare back-reference with no preposition", () => {
    const expanded = expandWardrobeBackReferences("The same outfit. She waits.", REAL_WARDROBE);
    expect(expanded).not.toMatch(/same outfit/i);
    expect(expanded).toContain(REAL_WARDROBE);
  });

  test("leaves text alone when there is no wardrobe to substitute", () => {
    // Better an honest back-reference than a sentence mangled into "wearing ."
    expect(expandWardrobeBackReferences("in the same outfit", "")).toBe("in the same outfit");
    expect(expandWardrobeBackReferences("in the same outfit", null)).toBe("in the same outfit");
  });

  test("leaves an already-explicit description alone", () => {
    const explicit = `She crosses the lobby wearing ${REAL_WARDROBE}.`;
    expect(expandWardrobeBackReferences(explicit, REAL_WARDROBE)).toBe(explicit);
  });

  test("does not double the word 'wearing' when the clothing field carries it", () => {
    const expanded = expandWardrobeBackReferences("in the same outfit", "wearing a red coat");
    expect(expanded).toBe("wearing a red coat");
    expect(expanded).not.toContain("wearing wearing");
  });
});

describe("wardrobe prompt line", () => {
  test("states the wardrobe outright so every scene carries it", () => {
    const line = wardrobePromptLine(REAL_WARDROBE);
    expect(line).toContain(REAL_WARDROBE);
    expect(line).toContain("identical in every scene");
  });

  test("is omitted when the cast defines no clothing", () => {
    expect(wardrobePromptLine("")).toBe("");
    expect(wardrobePromptLine(null)).toBe("");
    expect(wardrobePromptLine("   ")).toBe("");
  });

  test("normalizes a leading 'wearing'", () => {
    expect(normalizeWardrobe("wearing a red coat")).toBe("a red coat");
    expect(normalizeWardrobe("a red coat")).toBe("a red coat");
    expect(normalizeWardrobe(null)).toBe("");
  });
});
