/**
 * Reference-photo rules shared by every character form.
 *
 * Two surfaces attach reference photos — the Character Library form (`/characters`)
 * and the story's cast step (/workspace) — and both must apply the same rules:
 * never attach a display-only item, never attach the same photo twice. Keeping
 * the rule here (pure, no I/O) means it is unit-tested once and cannot drift
 * between the two screens.
 */

/** Why an attachment was refused. */
export type AttachError =
  /** The picked item had no submit-ready ref (preview-only library entry). */
  | "no_reference"
  /** That exact photo is already attached. */
  | "duplicate";

export type AttachResult<T> =
  | { ok: true; images: T[] }
  | { ok: false; error: AttachError };

/** Loose view of a stored reference, for reading its provider id. */
type RefLike = { ref?: { id?: unknown } | null };

function refIdOf(value: unknown): string | null {
  const id = (value as RefLike | null | undefined)?.ref?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * True when a picked item can actually be attached: it must carry a
 * submit-ready `ref` (never just a display `src`) and a non-empty src.
 *
 * Used on its own by the cast step, which persists immediately and only knows
 * whether a member already has a photo — and inside `attachReference` for the
 * Character Library form, which holds the full list. One rule, two entry points.
 */
export function isAttachable(item: { ref?: unknown; src?: string } | null | undefined): boolean {
  return item != null && item.ref != null && typeof item.src === "string" && item.src.length > 0;
}

/**
 * Append one picked photo to a character's references.
 * Returns the NEXT array rather than mutating, so callers can put it straight
 * into React state or a DB update. Generic in the stored image type so both
 * screens keep their own type (CharacterImage) without casts.
 *
 * `incoming` is deliberately loose: the picker hands back
 * `{ name, type, src, ref? }` where `ref` is optional (absent on preview-only
 * demo items) — attaching one of those would store a character with no usable
 * face, which is exactly the bug this guards.
 */
export function attachReference<T extends { src: string }>(
  existing: readonly T[],
  incoming: { ref?: unknown; src?: string } | null | undefined,
): AttachResult<T> {
  if (!isAttachable(incoming)) {
    return { ok: false, error: "no_reference" };
  }
  // Safe: isAttachable narrowed ref + src.
  const ref = (incoming as { ref: unknown; src: string }).ref;
  const src = (incoming as { ref: unknown; src: string }).src;

  const incomingId = refIdOf({ ref });
  if (incomingId != null && existing.some((image) => refIdOf(image) === incomingId)) {
    return { ok: false, error: "duplicate" };
  }

  // The appended image is a valid T by construction (every stored reference is
  // { ref, src }), but T is caller-defined, so the cast goes via unknown.
  return { ok: true, images: [...existing, { ref, src } as unknown as T] };
}

/** Human copy for a refused attachment (single source for both screens). */
export function attachErrorMessage(error: AttachError): string {
  switch (error) {
    case "duplicate":
      return "That photo is already attached to this character.";
    case "no_reference":
    default:
      return "That item has no usable reference — pick another photo or upload one.";
  }
}
