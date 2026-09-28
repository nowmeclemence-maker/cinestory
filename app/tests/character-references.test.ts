/**
 * Reference-photo coverage for BOTH character forms:
 *   - the Character Library page (/characters)
 *   - the story's cast step (/workspace)
 *
 * The sandbox and CI have no browser session (the app needs a Higgsfield
 * sign-in), so this drives the REAL code paths the two forms call, against a
 * real SQLite database, instead of clicking a remote UI:
 *
 *   upload ──────────► appendCharacterReference ──► characters.reference_images
 *   "Use my photo" ──► getLatestStorySelfie / applySelfieReference ──► same row
 *
 * Both surfaces share one write path and one rule module, so covering them here
 * covers what the forms do — the UI only supplies the selection and shows the
 * result.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { attachErrorMessage, attachReference, isAttachable, replaceReference } from "@/lib/character-references";
import { createHarness, OWNER, wirePlatform, type D1Like } from "./helpers/d1";

// ─── Harness ────────────────────────────────────────────────────────────────
// Shared with tests/script-preservation.test.ts: a real SQLite behind a D1 shim
// plus the two platform mocks, so the REAL code paths run under test.

let db: Database;
let fakeD1: D1Like;

beforeEach(() => {
  const harness = createHarness();
  db = harness.db;
  fakeD1 = harness.d1;
  wirePlatform(fakeD1);
});

// ─── The shared rule (what both forms apply to a picked photo) ───────────────

describe("the attach rule used by both character forms", () => {
  const picked = { name: "me.png", type: "image/png", src: "https://cdn/me.png", ref: { id: "media-1", type: "media_input" } };

  test("a picked photo is attachable", () => {
    expect(isAttachable(picked)).toBe(true);
  });

  test("a preview-only library item (no submit-ready ref) is refused", () => {
    expect(isAttachable({ name: "demo", type: "Location", src: "https://cdn/x.png" })).toBe(false);
    expect(isAttachable(null)).toBe(false);
    const result = attachReference([], { src: "https://cdn/x.png" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("no_reference");
  });

  test("attaching appends the photo to the character's references", () => {
    const result = attachReference<{ ref: unknown; src: string }>([], picked);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.images).toHaveLength(1);
      expect(result.images[0].src).toBe("https://cdn/me.png");
    }
  });

  test("the same photo cannot be attached twice", () => {
    const first = attachReference<{ ref: unknown; src: string }>([], picked);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = attachReference(first.images, picked);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("duplicate");
  });

  test("every refusal has human copy", () => {
    expect(attachErrorMessage("no_reference")).toContain("no usable reference");
    expect(attachErrorMessage("duplicate")).toContain("already attached");
  });
});

// ─── Character Library page: upload, then "Use my photo", persisted ──────────

describe("Character Library form — reference photo is attached and persisted", () => {
  test("an uploaded photo is written to the character row", async () => {
    const { createCharacter, appendCharacterReference, getCharacter } = await import("@/lib/services/characters");

    const character = await createCharacter({ name: "Mara" });
    expect(character.referenceImages).toHaveLength(0);

    // Exactly what the modal's picker does: the library/upload selection is
    // handed to the shared write path.
    await appendCharacterReference(character.id, {
      ref: { id: "media-upload-1", type: "media_input" },
      src: "https://cdn/mara.png",
    });

    const persisted = await getCharacter(character.id);
    expect(persisted.referenceImages).toHaveLength(1);
    expect(persisted.referenceImages[0].src).toBe("https://cdn/mara.png");

    // …and it is really in the database, not just in memory.
    const row = db.query("SELECT reference_images FROM characters WHERE id = ?").get(character.id) as { reference_images: string };
    expect(JSON.parse(row.reference_images)).toHaveLength(1);
    expect(JSON.parse(row.reference_images)[0].ref.id).toBe("media-upload-1");
  });

  test('"Use my photo" pulls the story photo and persists it', async () => {
    const { createCharacter, appendCharacterReference, getCharacter, getLatestStorySelfie } =
      await import("@/lib/services/characters");

    // The user's own photo, as stored when a story was created.
    db.run(
      "INSERT INTO stories (id, owner_key, status, selfie_ref, created_at) VALUES (?,?,?,?,?)",
      ["story-1", OWNER, "characters", JSON.stringify({ ref: { id: "selfie-1", type: "media_input" }, src: "https://cdn/me.png" }), "2026-09-28 10:00:00"],
    );

    const character = await createCharacter({ name: "Protagonist" });

    // What the form's "Use my photo" button does.
    const mine = await getLatestStorySelfie();
    expect(mine).not.toBeNull();
    await appendCharacterReference(character.id, mine as { ref: unknown; src: string });

    const persisted = await getCharacter(character.id);
    expect(persisted.referenceImages).toHaveLength(1);
    expect(persisted.referenceImages[0].src).toBe("https://cdn/me.png");

    const row = db.query("SELECT reference_images FROM characters WHERE id = ?").get(character.id) as { reference_images: string };
    expect(JSON.parse(row.reference_images)[0].ref.id).toBe("selfie-1");
  });

  test('"Use my photo" reports nothing found when no story photo exists', async () => {
    const { getLatestStorySelfie } = await import("@/lib/services/characters");
    expect(await getLatestStorySelfie()).toBeNull();
  });
});

// ─── Story cast step: "Use my photo" attached and persisted ──────────────────

describe("story cast step — 'Use my photo' attaches and persists", () => {
  async function seedCast(): Promise<void> {
    const { createCharacter } = await import("@/lib/services/characters");
    db.run(
      "INSERT INTO stories (id, owner_key, status, selfie_ref, created_at) VALUES (?,?,?,?,?)",
      ["story-cast", OWNER, "characters", JSON.stringify({ ref: { id: "selfie-9", type: "media_input" }, src: "https://cdn/story-me.png" }), "2026-09-28 11:00:00"],
    );
    const character = await createCharacter({ name: "Protagonist" });
    db.run("INSERT INTO story_characters (story_id, character_id, scene_indices) VALUES (?,?,?)", [
      "story-cast",
      character.id,
      null,
    ]);
  }

  test("applySelfieReference fills the cast member from the story's photo", async () => {
    await seedCast();
    const { applySelfieReference } = await import("@/lib/story-engine.server");
    const { getCharacter } = await import("@/lib/services/characters");

    const characterId = (db.query("SELECT character_id FROM story_characters WHERE story_id = ?").get("story-cast") as {
      character_id: string;
    }).character_id;

    const cast = await applySelfieReference("story-cast", characterId);

    // The DTO the cast card renders reports the photo as ready…
    const member = cast.find((m) => m.characterId === characterId);
    expect(member?.hasReference).toBe(true);
    expect(member?.portraitUrl).toBe("https://cdn/story-me.png");

    // …and the row is persisted with the story's own photo.
    const persisted = await getCharacter(characterId);
    expect(persisted.referenceImages).toHaveLength(1);
    expect(persisted.referenceImages[0].ref.id).toBe("selfie-9");
  });

  test("a cast member without a photo inherits the story photo on continue", async () => {
    await seedCast();
    const { validateCharacters } = await import("@/lib/story-engine.server");
    const { getCharacter } = await import("@/lib/services/characters");

    const characterId = (db.query("SELECT character_id FROM story_characters WHERE story_id = ?").get("story-cast") as {
      character_id: string;
    }).character_id;

    // The never-block guarantee: continuing must succeed, not throw.
    await validateCharacters("story-cast");

    const persisted = await getCharacter(characterId);
    expect(persisted.referenceImages).toHaveLength(1);
    expect(persisted.referenceImages[0].src).toBe("https://cdn/story-me.png");

    const storyRow = db.query("SELECT current_step FROM stories WHERE id = ?").get("story-cast") as { current_step: string };
    expect(storyRow.current_step).toBe("locations");
  });
});

// ─── "Replace photo" must actually replace (regression) ──────────────────────

describe("replace semantics — 'Replace photo' changes the face", () => {
  const first = { ref: { id: "media-old", type: "media_input" }, src: "https://cdn/old.png" };
  const second = { ref: { id: "media-new", type: "media_input" }, src: "https://cdn/new.png" };

  test("replacing drops the previous reference and keeps exactly one", () => {
    const result = replaceReference([first], second);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.images).toHaveLength(1);
    expect(result.images[0].src).toBe("https://cdn/new.png");
  });

  test("replacing with a non-attachable item is refused", () => {
    const result = replaceReference([first], { src: "https://cdn/preview-only.png" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("no_reference");
  });

  test("replacing with the photo that is already the only reference is a no-op", () => {
    const result = replaceReference([first], first);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("duplicate");
  });

  test("the persisted row holds only the new photo", async () => {
    const { createCharacter, appendCharacterReference, getCharacter } = await import("@/lib/services/characters");

    const character = await createCharacter({ name: "Mara" });
    await appendCharacterReference(character.id, first);
    await appendCharacterReference(character.id, second, { replace: true });

    const persisted = await getCharacter(character.id);
    expect(persisted.referenceImages).toHaveLength(1);
    expect(persisted.referenceImages[0].ref.id).toBe("media-new");

    const row = db.query("SELECT reference_images FROM characters WHERE id = ?").get(character.id) as {
      reference_images: string;
    };
    const stored = JSON.parse(row.reference_images) as { ref: { id: string } }[];
    expect(stored).toHaveLength(1);
    expect(stored[0].ref.id).toBe("media-new");
  });

  test("after a replace the cast card renders the NEW face", async () => {
    // Seed a cast member whose reference is the story photo…
    const { createCharacter, appendCharacterReference } = await import("@/lib/services/characters");
    db.run(
      "INSERT INTO stories (id, owner_key, status, selfie_ref, created_at) VALUES (?,?,?,?,?)",
      ["story-replace", OWNER, "characters", JSON.stringify({ ref: { id: "selfie-old" }, src: "https://cdn/story-me.png" }), "2026-09-28 12:00:00"],
    );
    const character = await createCharacter({ name: "Protagonist" });
    db.run("INSERT INTO story_characters (story_id, character_id, scene_indices) VALUES (?,?,?)", [
      "story-replace",
      character.id,
      null,
    ]);
    await appendCharacterReference(character.id, { ref: { id: "selfie-old" }, src: "https://cdn/story-me.png" });

    // …then replace it, as the card's "Replace photo" button now does.
    await appendCharacterReference(character.id, second, { replace: true });

    const { listStoryCharacters } = await import("@/lib/story-engine.server");
    const cast = await listStoryCharacters("story-replace");
    const member = cast.find((m) => m.characterId === character.id);

    // The face the card shows must be the replacement — the original bug left
    // referenceImages[0] untouched, so the button appeared to do nothing.
    expect(member?.portraitUrl).toBe("https://cdn/new.png");
    expect(member?.hasReference).toBe(true);
  });
});
