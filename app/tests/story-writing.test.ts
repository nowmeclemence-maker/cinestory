/**
 * The script and sets writers' writing rules.
 *
 * Checked against the REAL failure — story 63bb7687, five scenes that all sat in
 * one preset room and whose descriptions opened with studio plumbing instead of
 * writing. The acceptance criteria from the report are encoded here directly:
 * five scenes must reach at least three different locations, and no description
 * may contain "same", "unchanged" or "matching the user's photo".
 */
import { describe, expect, test } from "bun:test";
import {
  MAX_CONSECUTIVE_SAME_LOCATION,
  distinctLocationCount,
  hasContinuityLeakage,
  locationVarietyOk,
  longestLocationRun,
  requiredLocationCount,
  stripContinuityLeakage,
} from "@/lib/story-writing";

/** The five descriptions exactly as they shipped, with the leaks in bold. */
const LEAKED: { text: string; keeps: string }[] = [
  {
    text: "The main subject, matching the user's photo, stands just inside a five-star hotel suite. They wear an ivory open-collar shirt, tailored black trousers",
    keeps: "five-star hotel suite",
  },
  {
    text: "The same subject, with the same photo-matched likeness and unchanged outfit, places their keycard on the suite's marble console. They turn back toward",
    keeps: "keycard",
  },
  {
    text: "The same subject, wearing the identical ivory shirt, black trousers, and brass watch, sits on the edge of the suite's cream sofa. They glance at their",
    keeps: "cream sofa",
  },
  {
    text: "The same photo-matched subject, outfit unchanged, sits upright at the suite's small marble dining table. A room-service bowl of soup rests before them",
    keeps: "marble dining table",
  },
  {
    text: "The same subject remains at the marble table in the identical wardrobe, their brass watch beside the half-finished soup. They lean slightly toward the",
    keeps: "half-finished soup",
  },
];

const FORBIDDEN = /\b(?:same|unchanged|identical)\b|matching the user'?s photo|photo-?matched/i;

describe("continuity plumbing never reaches the script", () => {
  test("every shipped description is detected as a leak", () => {
    for (const { text } of LEAKED) {
      expect(hasContinuityLeakage(text)).toBe(true);
    }
  });

  test("stripping leaves no forbidden wording in any of them", () => {
    for (const { text } of LEAKED) {
      const cleaned = stripContinuityLeakage(text);
      expect(cleaned).not.toMatch(FORBIDDEN);
    }
  });

  test("stripping keeps the cinematic content — it removes plumbing, not writing", () => {
    for (const { text, keeps } of LEAKED) {
      const cleaned = stripContinuityLeakage(text);
      expect(cleaned).toContain(keeps);
      expect(cleaned.length).toBeGreaterThan(30);
      // Still a sentence, not a fragment held together by leftover punctuation.
      expect(cleaned).not.toMatch(/^\W/);
      expect(cleaned).not.toMatch(/,\s*\./);
    }
  });

  test("the action survives verbatim", () => {
    const cleaned = stripContinuityLeakage(LEAKED[2].text);
    // The sentence now opens with the action, so it is re-capitalised.
    expect(cleaned).toMatch(/^Sits on the edge of the suite's cream sofa/);
    // …and the restated wardrobe clause is gone with the plumbing.
    expect(cleaned).not.toContain("brass watch");
  });

  test("a clean cinematic description is left alone", () => {
    const clean =
      "She stands in the rain under the hotel awning, pulling her coat tighter as a taxi pulls away without her.";
    expect(hasContinuityLeakage(clean)).toBe(false);
    expect(stripContinuityLeakage(clean)).toBe(clean);
  });

  test("the sanitised script still passes the report's own acceptance check", () => {
    const descriptions = LEAKED.map(({ text }) => stripContinuityLeakage(text));
    expect(descriptions.some((d) => FORBIDDEN.test(d))).toBe(false);
  });
});

describe("sets must travel", () => {
  /** What actually shipped. */
  const SHIPPED = ["Luxury hotel", "Luxury hotel", "Luxury hotel", "Luxury hotel", "Luxury hotel"];

  test("the shipped set list fails: one location for five scenes", () => {
    expect(distinctLocationCount(SHIPPED)).toBe(1);
    expect(longestLocationRun(SHIPPED)).toBe(5);
    expect(locationVarietyOk(SHIPPED, 5)).toBe(false);
  });

  test("a five-scene film needs at least three different locations", () => {
    expect(requiredLocationCount(5)).toBe(3);
    expect(requiredLocationCount(3)).toBe(3);
    expect(requiredLocationCount(2)).toBe(2);
  });

  test("a travelling plan passes", () => {
    const travelled = ["Hotel suite", "Marble lobby", "Street at night", "Hotel suite", "Rooftop bar"];
    expect(distinctLocationCount(travelled)).toBe(4);
    expect(longestLocationRun(travelled)).toBe(1);
    expect(locationVarietyOk(travelled, 5)).toBe(true);
  });

  test("enough distinct places is not enough if one room runs on", () => {
    // Three distinct names, but the first room holds for three scenes in a row.
    const stuck = ["Suite", "Suite", "Suite", "Lobby", "Rooftop"];
    expect(distinctLocationCount(stuck)).toBe(3);
    expect(longestLocationRun(stuck)).toBe(3);
    expect(longestLocationRun(stuck)).toBeGreaterThan(MAX_CONSECUTIVE_SAME_LOCATION);
    expect(locationVarietyOk(stuck, 5)).toBe(false);
  });

  test("exactly two consecutive scenes in one room is allowed", () => {
    const ok = ["Suite", "Suite", "Lobby", "Street", "Street"];
    expect(longestLocationRun(ok)).toBe(2);
    expect(locationVarietyOk(ok, 5)).toBe(true);
  });

  test("case and whitespace do not fool the check", () => {
    const noisy = [" luxury hotel ", "LUXURY HOTEL", "Rooftop"];
    expect(distinctLocationCount(noisy)).toBe(2);
    expect(longestLocationRun(noisy)).toBe(2);
  });

  test("an empty plan is not varied", () => {
    expect(locationVarietyOk([], 5)).toBe(false);
    expect(locationVarietyOk(["", "", ""], 3)).toBe(false);
  });

  test("the report's acceptance criteria, as one assertion", () => {
    // A five-scene result passes only if both conditions hold.
    const accept = (names: string[], descriptions: string[]) =>
      distinctLocationCount(names) >= 3 && !descriptions.some((d) => FORBIDDEN.test(d));

    const good = {
      names: ["Hotel suite", "Lobby", "Street", "Suite", "Rooftop bar"],
      descriptions: [
        "She sets her suitcase down and checks the empty room.",
        "She crosses the lobby, avoiding the concierge's eye.",
        "Rain. She steps under the awning and calls a number she deleted years ago.",
        "Back in the suite, she finally opens the envelope.",
        "On the rooftop she reads the letter aloud, then lets it go.",
      ],
    };
    expect(accept(good.names, good.descriptions)).toBe(true);

    // What shipped fails both halves.
    expect(accept(SHIPPED, LEAKED.map(({ text }) => text))).toBe(false);
    expect(accept(good.names, LEAKED.map(({ text }) => text))).toBe(false);
    expect(accept(SHIPPED, good.descriptions)).toBe(false);
  });
});
