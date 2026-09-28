/**
 * Reference-photo rules shared by every character form.
 *
 * Two surfaces attach reference photos — the Character Library form (`/characters`)
 * and the story's cast step (/workspace) — and both must apply the same rules:
 * never attach a display-only item, never attach the same photo twice, and when
 * the action says REPLACE, actually replace. Keeping the rules here (pure, no
 * I/O) means they are unit-tested once and cannot drift between the two screens.
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
 * whether a member already has a photo — and inside the functions below for the
 * Character Library form, which holds the full list. One rule, two entry points.
 */
export function isAttachable(item: { ref?: unknown; src?: string } | null | undefined): boolean {
  return item != null && item.ref != null && typeof item.src === "string" && item.src.length > 0;
}

/** Narrow a picked item to the stored shape, or null when it is not attachable. */
function normalize(item: { ref?: unknown; src?: string } | null | undefined): { ref: unknown; src: string } | null {
  if (!isAttachable(item)) return null;
  const { ref, src } = item as { ref: unknown; src: string };
  return { ref, src };
}

/**
 * Append one picked photo to a character's references.
 * Returns the NEXT array rather than mutating, so callers can put it straight
 * into React state or a DB update. Generic in the stored image type so both
 * screens keep their own type (CharacterImage) without casts.
 */
export function attachReference<T extends { src: string }>(
  existing: readonly T[],
  incoming: { ref?: unknown; src?: string } | null | undefined,
): AttachResult<T> {
  const image = normalize(incoming);
  if (image == null) return { ok: false, error: "no_reference" };

  const incomingId = refIdOf({ ref: image.ref });
  if (incomingId != null && existing.some((stored) => refIdOf(stored) === incomingId)) {
    return { ok: false, error: "duplicate" };
  }

  // The appended image is a valid T by construction (every stored reference is
  // { ref, src }), but T is caller-defined, so the cast goes via unknown.
  return { ok: true, images: [...existing, image as unknown as T] };
}

/**
 * Set a character's reference to exactly this photo, dropping any previous one.
 *
 * This is what the UI means by "Replace photo": the card shows a single face, so
 * appending instead would leave the displayed face unchanged and make the button
 * look broken.
 */
export function replaceReference<T extends { src: string }>(
  existing: readonly T[],
  incoming: { ref?: unknown; src?: string } | null | undefined,
): AttachResult<T> {
  const image = normalize(incoming);
  if (image == null) return { ok: false, error: "no_reference" };

  const incomingId = refIdOf({ ref: image.ref });
  // Already the one and only reference — nothing to replace.
  if (existing.length === 1 && incomingId != null && refIdOf(existing[0]) === incomingId) {
    return { ok: false, error: "duplicate" };
  }

  return { ok: true, images: [image as unknown as T] };
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
