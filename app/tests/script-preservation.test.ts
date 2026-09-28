/**
 * The promise that makes the storyboard checkpoint useful: you can see a mistake
 * and go back and fix it. Reopening the Script step and saving MUST NOT destroy
 * work already generated — this used to delete every scene row and re-insert it,
 * silently throwing away the storyboard images the moment a word was corrected.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { createHarness, OWNER, wirePlatform, type D1Like } from "./helpers/d1";

let db: Database;
let fakeD1: D1Like;

beforeEach(() => {
  const harness = createHarness();
  db = harness.db;
  fakeD1 = harness.d1;
  wirePlatform(fakeD1);
});

const SCRIPT = JSON.stringify({
  title: "A Table for Me",
  hook: "A quiet dinner alone.",
  cta: "",
  musicMood: "cinematic, emotional",
  colorGrade: "warm cinematic",
  scenes: [
    { description: "She checks herself in the mirror.", camera: "slow push in", dialogue: "", onScreenText: "" },
    { description: "She crosses the lobby.", camera: "tracking", dialogue: "", onScreenText: "" },
    { description: "She waits under the awning in the same outfit.", camera: "static", dialogue: "", onScreenText: "" },
  ],
});

/** A story sitting at the storyboard step with three finished images. */
function seedStoryboardStory(): string[] {
  const storyId = "story-preserve";
  db.run(
    "INSERT INTO stories (id, owner_key, status, current_step, title, script_json, scene_count, duration_sec, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [storyId, OWNER, "storyboard", "storyboard", "A Table for Me", SCRIPT, 3, 15, "2026-09-28 10:00:00", "2026-09-28 10:00:00"],
  );
  const ids = ["scene-1", "scene-2", "scene-3"];
  ids.forEach((id, idx) => {
    db.run(
      `INSERT INTO story_scenes (id, story_id, idx, description, camera, dialogue, on_screen_text, status, image_job_id, image_url, location_name, location_description, location_source, dialogue_enabled)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        storyId,
        idx,
        `description ${idx + 1}`,
        "camera",
        "",
        "",
        "image_ready",
        `job-${idx + 1}`,
        `https://cdn.example/scene-${idx + 1}.png`,
        "Luxury hotel",
        "Marble lobby, warm light.",
        "proposed",
        1,
      ],
    );
  });
  return ids;
}

function sceneRow(id: string): {
  idx: number;
  description: string;
  status: string;
  image_job_id: string | null;
  image_url: string | null;
  location_name: string | null;
  location_source: string | null;
  dialogue_enabled: number;
} {
  return db
    .query(
      "SELECT idx, description, status, image_job_id, image_url, location_name, location_source, dialogue_enabled FROM story_scenes WHERE id = ?",
    )
    .get(id) as never;
}

describe("editing the script after the storyboard exists", () => {
  test("correcting a scene's wording keeps its generated image", async () => {
    const ids = seedStoryboardStory();
    const { updateScript } = await import("@/lib/story-engine.server");

    // The user fixes scene 3's "in the same outfit" wording.
    await updateScript("story-preserve", {
      title: "A Table for Me",
      hook: "A quiet dinner alone.",
      cta: "",
      scenes: [
        { id: ids[0], idx: 0, description: "description 1", camera: "camera", dialogue: "", onScreenText: "" },
        { id: ids[1], idx: 1, description: "description 2", camera: "camera", dialogue: "", onScreenText: "" },
        {
          id: ids[2],
          idx: 2,
          description: "She waits under the awning wearing an ivory coat and black ankle boots.",
          camera: "camera",
          dialogue: "",
          onScreenText: "",
        },
      ],
    });

    const scene3 = sceneRow(ids[2]);
    expect(scene3.description).toContain("ivory coat");
    // The image and everything the scene needs to keep generating are untouched.
    expect(scene3.image_url).toBe("https://cdn.example/scene-3.png");
    expect(scene3.image_job_id).toBe("job-3");
    expect(scene3.status).toBe("image_ready");
    // The set is preserved too — a wording fix must not cost a set either.
    expect(scene3.location_name).toBe("Luxury hotel");
    expect(scene3.location_source).toBe("proposed");
    expect(scene3.dialogue_enabled).toBe(1);
  });

  test("every scene keeps its own row, image and identity", async () => {
    const ids = seedStoryboardStory();
    const { updateScript } = await import("@/lib/story-engine.server");

    await updateScript("story-preserve", {
      title: "A Table for Me",
      hook: "A quiet dinner alone.",
      cta: "",
      scenes: [
        { id: ids[0], idx: 0, description: "rewritten one", camera: "camera", dialogue: "", onScreenText: "" },
        { id: ids[1], idx: 1, description: "rewritten two", camera: "camera", dialogue: "", onScreenText: "" },
        { id: ids[2], idx: 2, description: "rewritten three", camera: "camera", dialogue: "", onScreenText: "" },
      ],
    });

    expect(sceneRow(ids[0]).image_url).toBe("https://cdn.example/scene-1.png");
    expect(sceneRow(ids[1]).image_url).toBe("https://cdn.example/scene-2.png");
    expect(sceneRow(ids[2]).image_url).toBe("https://cdn.example/scene-3.png");

    const count = db.query("SELECT COUNT(*) AS n FROM story_scenes WHERE story_id = ?").get("story-preserve") as { n: number };
    expect(count.n).toBe(3);
  });

  test("adding a scene inserts a pendng row and leaves the others intact", async () => {
    const ids = seedStoryboardStory();
    const { updateScript } = await import("@/lib/story-engine.server");

    await updateScript("story-preserve", {
      title: "A Table for Me",
      hook: "A quiet dinner alone.",
      cta: "",
      scenes: [
        { id: ids[0], idx: 0, description: "one", camera: "camera", dialogue: "", onScreenText: "" },
        { id: ids[1], idx: 1, description: "two", camera: "camera", dialogue: "", onScreenText: "" },
        { id: ids[2], idx: 2, description: "three", camera: "camera", dialogue: "", onScreenText: "" },
        { idx: 3, description: "the new beat", camera: "slow pan", dialogue: "", onScreenText: "" },
      ],
    });

    const rows = db
      .query("SELECT id, idx, status, image_url FROM story_scenes WHERE story_id = ? ORDER BY idx")
      .all("story-preserve") as { id: string; idx: number; status: string; image_url: string | null }[];

    expect(rows).toHaveLength(4);
    expect(rows[3].status).toBe("pending");
    expect(rows[3].image_url).toBeNull();
    expect(rows[0].image_url).toBe("https://cdn.example/scene-1.png");
  });

  test("removing a scene deletes only that scene", async () => {
    const ids = seedStoryboardStory();
    const { updateScript } = await import("@/lib/story-engine.server");

    await updateScript("story-preserve", {
      title: "A Table for Me",
      hook: "A quiet dinner alone.",
      cta: "",
      scenes: [
        { id: ids[0], idx: 0, description: "one", camera: "camera", dialogue: "", onScreenText: "" },
        { id: ids[2], idx: 1, description: "three", camera: "camera", dialogue: "", onScreenText: "" },
      ],
    });

    const remaining = db
      .query("SELECT id, idx FROM story_scenes WHERE story_id = ? ORDER BY idx")
      .all("story-preserve") as { id: string; idx: number }[];

    expect(remaining.map((r) => r.id)).toEqual([ids[0], ids[2]]);
    expect(remaining[1].idx).toBe(1);
    expect(sceneRow(ids[2]).image_url).toBe("https://cdn.example/scene-3.png");
  });

  test("the story keeps its own step — editing never rewinds production", async () => {
    const ids = seedStoryboardStory();
    const { updateScript } = await import("@/lib/story-engine.server");

    await updateScript("story-preserve", {
      title: "A Table for Me",
      hook: "A quiet dinner alone.",
      cta: "",
      scenes: [
        { id: ids[0], idx: 0, description: "one", camera: "camera", dialogue: "", onScreenText: "" },
        { id: ids[1], idx: 1, description: "two", camera: "camera", dialogue: "", onScreenText: "" },
        { id: ids[2], idx: 2, description: "three", camera: "camera", dialogue: "", onScreenText: "" },
      ],
    });

    const story = db.query("SELECT status, current_step FROM stories WHERE id = ?").get("story-preserve") as {
      status: string;
      current_step: string;
    };
    expect(story.status).toBe("storyboard");
    expect(story.current_step).toBe("storyboard");
  });

  test("a finished film is still protected from script edits", async () => {
    seedStoryboardStory();
    db.run("UPDATE stories SET status = 'ready', current_step = 'assembly' WHERE id = ?", ["story-preserve"]);
    const { updateScript } = await import("@/lib/story-engine.server");

    await expect(
      updateScript("story-preserve", {
        title: "late edit",
        hook: "",
        cta: "",
        scenes: [{ idx: 0, description: "too late", camera: "camera", dialogue: "", onScreenText: "" }],
      }),
    ).rejects.toThrow();
  });
});
