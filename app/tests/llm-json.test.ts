import { describe, expect, test } from "bun:test";
import {
  completeJsonWithRetry,
  extractJson,
  extractJsonArray,
  firstJsonBlock,
  hasItems,
  STRICTER_JSON_INSTRUCTION,
  stripCodeFences,
} from "@/lib/llm-json";

// ─── extractJson: arrays, fences, prose ──────────────────────────────────────

describe("extractJson / extractJsonArray", () => {
  test("parses a plain top-level array (the shape casting and sets ask for)", () => {
    const text = '[{"name":"Mara","role":"Protagonist"},{"name":"Driver"}]';
    const items = extractJsonArray(text);
    expect(items).not.toBeNull();
    expect(items).toHaveLength(2);
    expect((items?.[0] as { name: string }).name).toBe("Mara");
  });

  test("parses a fenced array", () => {
    const text = ['Here you go:', "```json", '[{"name":"Mara"},{"name":"Driver"}]', "```", "Hope that helps!"].join("\n");
    const items = extractJsonArray(text);
    expect(items).toHaveLength(2);
    expect((items?.[1] as { name: string }).name).toBe("Driver");
  });

  test("parses a fenced array without a language tag", () => {
    const items = extractJsonArray("```\n[{\"name\":\"Only\"}]\n```");
    expect(items).toHaveLength(1);
  });

  test("parses an object surrounded by prose", () => {
    const text = 'Sure! Here is the script:\n{"title":"Two Cups","scenes":[{"description":"a"}]}\nLet me know if you want changes.';
    const parsed = extractJson(text) as { title: string; scenes: unknown[] };
    expect(parsed.title).toBe("Two Cups");
    expect(parsed.scenes).toHaveLength(1);
  });

  test("accepts an array wrapped in an object with a single array property", () => {
    const items = extractJsonArray('{"characters":[{"name":"Mara"},{"name":"Driver"}]}');
    expect(items).toHaveLength(2);
    expect((items?.[0] as { name: string }).name).toBe("Mara");
  });

  test("accepts a fenced wrapped array alongside other scalar keys", () => {
    const text = ['```json', '{"locations":[{"name":"Rooftop"}],"note":"3 scenes"}', '```'].join("\n");
    const items = extractJsonArray(text);
    expect(items).toHaveLength(1);
    expect((items?.[0] as { name: string }).name).toBe("Rooftop");
  });

  test("ignores an object with several array properties (ambiguous wrapper)", () => {
    expect(extractJsonArray('{"characters":[{"name":"A"}],"settings":[{"name":"B"}]}')).toBeNull();
  });

  // Regression: this is the failure the user hit — the old helper sliced from
  // the first "{" to the last "}", so trailing content broke JSON.parse.
  test("tolerates trailing content after the value (the position-315 failure)", () => {
    const text = '[{"name":"Mara"}]{"unexpected":"trailing object"}';
    const items = extractJsonArray(text);
    expect(items).toHaveLength(1);
    expect((items?.[0] as { name: string }).name).toBe("Mara");
  });

  test("is not confused by braces and brackets inside string values", () => {
    const text = '[{"description":"he said {\\"hi\\"} then [left]"},{"description":"}"}]';
    const items = extractJsonArray(text);
    expect(items).toHaveLength(2);
    expect((items?.[0] as { description: string }).description).toContain("{");
  });

  test("takes whichever of { or [ opens first", () => {
    expect(firstJsonBlock('text [1,2] then {"a":1}')).toBe("[1,2]");
    expect(firstJsonBlock('text {"a":1} then [1,2]')).toBe('{"a":1}');
  });

  test("returns null (never throws) on unparseable or empty input", () => {
    expect(extractJson("")).toBeNull();
    expect(extractJson("no json here at all")).toBeNull();
    expect(extractJson("{ broken: true }")).toBeNull();
    expect(extractJson("[1,2")).toBeNull();
    expect(extractJsonArray("The casting director returned no characters.")).toBeNull();
  });

  test("stripCodeFences keeps inner content and is a no-op without fences", () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toContain('{"a":1}');
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });

  test("hasItems guards empty arrays", () => {
    expect(hasItems([])).toBe(false);
    expect(hasItems(null)).toBe(false);
    expect(hasItems([1])).toBe(true);
  });
});

// ─── completeJsonWithRetry: one stricter retry ───────────────────────────────

describe("completeJsonWithRetry", () => {
  test("does not retry when the first reply parses", async () => {
    const calls: Array<string | undefined> = [];
    const result = await completeJsonWithRetry(
      async (extra) => {
        calls.push(extra);
        return '[{"name":"Mara"}]';
      },
      extractJsonArray,
    );
    expect(result).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBeUndefined();
  });

  test("retries once with the stricter instruction when parsing fails", async () => {
    const calls: Array<string | undefined> = [];
    const result = await completeJsonWithRetry(
      async (extra) => {
        calls.push(extra);
        return calls.length === 1
          ? "I'm sorry, I cannot do that."
          : '{"characters":[{"name":"Mara"}]}';
      },
      extractJsonArray,
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]).toBe(STRICTER_JSON_INSTRUCTION);
    expect((result?.[0] as { name: string }).name).toBe("Mara");
  });

  test("returns null after a failed retry (caller then surfaces a real error)", async () => {
    let calls = 0;
    const result = await completeJsonWithRetry(
      async () => {
        calls++;
        return "not json";
      },
      extractJsonArray,
    );
    expect(result).toBeNull();
    expect(calls).toBe(2);
  });

  test("treats an empty array as a failure worth retrying", async () => {
    let calls = 0;
    const result = await completeJsonWithRetry(
      async () => {
        calls++;
        return calls === 1 ? "[]" : '[{"name":"Mara"}]';
      },
      (text) => {
        const items = extractJsonArray(text);
        return hasItems(items) ? items : null;
      },
    );
    expect(calls).toBe(2);
    expect(result).toHaveLength(1);
  });
});
