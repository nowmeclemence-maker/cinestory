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
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { attachErrorMessage, attachReference, isAttachable } from "@/lib/character-references";

// ─── D1 shim over bun:sqlite (no new dependencies) ───────────────────────────

type Row = Record<string, unknown>;

class FakeStatement {
  constructor(
    private readonly db: Database,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): FakeStatement {
    return new FakeStatement(this.db, this.sql, params);
  }

  async first<T>(): Promise<T | null> {
    const row = this.db.query(this.sql).get(...(this.params as never[]));
    return (row ?? null) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rows = this.db.query(this.sql).all(...(this.params as never[]));
    return { results: rows as T[] };
  }

  async run(): Promise<{ success: true }> {
    this.db.query(this.sql).run(...(this.params as never[]));
    return { success: true };
  }
}

class FakeD1 {
  constructor(private readonly db: Database) {}
  prepare(sql: string): FakeStatement {
    return new FakeStatement(this.db, sql);
  }
}

// ─── Schema (only the columns the code under test touches) ───────────────────

const SCHEMA = `
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'New Character',
  role TEXT DEFAULT '',
  biography TEXT DEFAULT '',
  appearance TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  clothing TEXT DEFAULT '',
  voice_id TEXT DEFAULT '',
  age TEXT DEFAULT '',
  ethnicity TEXT DEFAULT '',
  relationships TEXT DEFAULT '',
  reference_images TEXT DEFAULT '[]',
  reusable_prompts TEXT DEFAULT '',
  portrait_job_id TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  project_id TEXT,
  idea TEXT DEFAULT '',
  template_id TEXT DEFAULT '',
  location_id TEXT DEFAULT '',
  duration_sec INTEGER DEFAULT 15,
  scene_count INTEGER DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'scripting',
  progress_label TEXT,
  title TEXT,
  hook TEXT,
  cta TEXT,
  music_mood TEXT,
  color_grade TEXT,
  script_json TEXT,
  selfie_ref TEXT,
  reference_ref TEXT,
  final_video_key TEXT,
  final_poster_key TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  current_step TEXT NOT NULL DEFAULT 'old',
  estimated_cost REAL NOT NULL DEFAULT 0,
  spent_cost REAL NOT NULL DEFAULT 0,
  music_track TEXT,
  voiceover_url TEXT
);
CREATE TABLE story_scenes (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  description TEXT DEFAULT '',
  camera TEXT,
  dialogue TEXT,
  on_screen_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  image_job_id TEXT,
  image_url TEXT,
  video_job_id TEXT,
  video_url TEXT,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  location_name TEXT,
  location_description TEXT,
  location_ref TEXT,
  location_source TEXT,
  location_job_id TEXT,
  dialogue_enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE story_characters (
  story_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  scene_indices TEXT,
  PRIMARY KEY (story_id, character_id)
);
`;

const OWNER = "user:user-1:workspace:ws-1";

let db: Database;
let fakeD1: FakeD1;

/** Register the platform mocks BEFORE any module under test is imported. */
function wirePlatform(): void {
  const bindingsStub = () => ({ bindings: () => ({ DB: fakeD1 }) });
  const fnfStub = () => ({
    createServerFnf: () => ({
      profile: {
        getUser: async () => ({ id: "user-1", workspaceId: "ws-1" }),
        getCurrentWorkspace: async () => ({ id: "ws-1" }),
      },
    }),
  });

  mock.module("../src/lib/bindings.server", bindingsStub);
  mock.module("../src/lib/fnf.server", fnfStub);
}

beforeEach(() => {
  db = new Database(":memory:");
  db.run(SCHEMA);
  fakeD1 = new FakeD1(db);
  wirePlatform();
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
