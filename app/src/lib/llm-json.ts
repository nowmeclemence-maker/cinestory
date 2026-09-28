/**
 * Tolerant JSON extraction for LLM output.
 *
 * Why this exists: the original helper in the story engine sliced from the
 * first `{` to the LAST `}`, which only ever worked for a top-level OBJECT.
 * `proposeCharacters` and `proposeLocations` ask for a top-level ARRAY
 * (`[{...},{...}]`), so the slice was a broken fragment — surfacing as
 * "The casting director returned no characters" / "Unexpected non-whitespace
 * character after JSON at position 315". Chat models also wrap replies in
 * markdown fences or add prose, and sometimes wrap the array in an object.
 *
 * This module is deliberately pure (no env, no I/O) so it is unit-testable —
 * see tests/llm-json.test.ts.
 */

/** Instruction appended on the single stricter retry. */
export const STRICTER_JSON_INSTRUCTION =
  "Your previous reply could not be parsed as JSON. Reply again with ONLY the raw JSON value — no markdown, no code fences, no text before or after it.";

/** Remove markdown code fences, keeping their contents. */
export function stripCodeFences(text: string): string {
  return text.replace(/```[a-zA-Z0-9_-]*[ \t]*\r?\n?([\s\S]*?)```/g, "$1");
}

/**
 * Slice out the first balanced `{...}` or `[...]` block, whichever OPENS first.
 * String literals and escapes are respected, so braces inside strings (and
 * trailing prose after the value) do not confuse the scan — which is what
 * produced the "non-whitespace character after JSON" failure.
 */
export function firstJsonBlock(text: string): string | null {
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  const candidates = [objStart, arrStart].filter((i) => i >= 0);
  if (candidates.length === 0) return null;

  const start = Math.min(...candidates);
  const open = text[start];
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Extract the first JSON value from arbitrary model output.
 * Handles objects AND arrays, fenced output, and surrounding prose.
 * Returns null when nothing parseable is present (never throws).
 */
export function extractJson(text: string): unknown | null {
  if (!text) return null;
  const block = firstJsonBlock(stripCodeFences(text));
  if (block == null) return null;
  try {
    return JSON.parse(block) as unknown;
  } catch {
    return null;
  }
}

/**
 * Extract a top-level ARRAY, also accepting a wrapped array — an object whose
 * only array property holds it, e.g. `{"characters": [...]}`. Models drift into
 * that shape often enough to be worth accepting rather than retrying.
 */
export function extractJsonArray(text: string): unknown[] | null {
  const parsed = extractJson(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed != null && typeof parsed === "object") {
    const arrays = Object.values(parsed as Record<string, unknown>).filter(Array.isArray);
    if (arrays.length === 1) return arrays[0] as unknown[];
  }
  return null;
}

/** True for a non-empty array (the useful outcome of extractJsonArray). */
export function hasItems(value: unknown[] | null): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Call the model, parse, and — on failure only — retry ONCE with a stricter
 * instruction before giving up. Most parse failures are formatting, not
 * capability, so one corrective turn recovers them; anything still unparseable
 * is a genuine error the caller should surface.
 *
 * `call` receives the extra instruction to append (undefined on the first
 * attempt) and returns the raw model text, keeping this helper free of any
 * dependency on a particular LLM client type.
 */
export async function completeJsonWithRetry<T>(
  call: (extraInstruction?: string) => Promise<string>,
  parse: (text: string) => T | null,
): Promise<T | null> {
  const first = parse(await call());
  if (first != null) return first;
  return parse(await call(STRICTER_JSON_INSTRUCTION));
}
