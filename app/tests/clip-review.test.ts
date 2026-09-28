/**
 * The Video-step review gate.
 *
 * The storyboard is a checkpoint; the Video step must be one too, and the whole
 * point is that a film CANNOT reach Final cut with unreviewed clips. These tests
 * pin the gate itself: per-clip approval, the refusal while anything is
 * unreviewed, the accept step, and the fact that editing a scene invalidates its
 * clip rather than leaving a stale one approvable.
 */
import { beforeEach, describe, expect, test } from "bun:test";
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

const STORY_ID = "story-clips";

const SCRIPT = JSON.stringify({
  title: "A Table for Me",
  hook: "",
  cta: "",
  musicMood: "cinematic",
  colorGrade: "warm",
  scenes: [
    { description: "one", camera: "c", dialogue: "", onScreenText: "" },
    { description: "two", camera: "c", dialogue: "", onScreenText: "" },
    { description: "three", camera: "c", dialogue: "", onScreenText: "" },
  ],
});

/** A story whose clips have all finished recording, none approved yet. */
function seedRecordedStory(status = "generating"): string[] {
  db.run(
    "INSERT INTO stories (id, owner_key, status, current_step, title, script_json, scene_count, duration_sec, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [STORY_ID, OWNER, status, status === "ready" ? "assembly" : "video", "A Table for Me", SCRIPT, 3, 15, "2026-09-28 10:00:00", "2026-09-28 10:00:00"],
  );
  const ids = ["clip-1", "clip-2", "clip-3"];
  ids.forEach((id, idx) => {
    db.run(
      `INSERT INTO story_scenes (id, story_id, idx, description, camera, dialogue, on_screen_text, status, image_url, image_key, video_job_id, video_url, video_key, video_approved)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        STORY_ID,
        idx,
        `description ${idx + 1}`,
        "camera",
        "",
        "",
        "ready",
        `https://provider/still-${idx + 1}.png`,
        `stories/${STORY_ID}/scenes/${id}.png`,
        null,
        `https://provider/clip-${idx + 1}.mp4`,
        `stories/${STORY_ID}/scenes/${id}.mp4`,
        0,
      ],
    );
  });
  return ids;
}

function approveAll(): void {
  db.run("UPDATE story_scenes SET video_approved = 1 WHERE story_id = ?", [STORY_ID]);
}

describe("the Video step gate", () => {
  test("refuses to continue while any clip is unreviewed", async () => {
    seedRecordedStory();
    const { approveClipsAndContinue } = await import("@/lib/story-engine.server");

    // Nothing watched yet: the gate names how many are left.
    await expect(approveClipsAndContinue(STORY_ID)).rejects.toThrow(/still to review/);

    const story = db.query("SELECT status FROM stories WHERE id = ?").get(STORY_ID) as { status: string };
    expect(story.status).toBe("generating");
  });

  test("names the specific scenes still to review", async () => {
    const ids = seedRecordedStory();
    const { setSceneVideoApproval, approveClipsAndContinue } = await import("@/lib/story-engine.server");

    await setSceneVideoApproval(STORY_ID, ids[0], true);
    await setSceneVideoApproval(STORY_ID, ids[1], true);

    // Scene 3 is the only one left.
    await expect(approveClipsAndContinue(STORY_ID)).rejects.toThrow(/scene 3/);
  });

  test("moves to Audio only once every clip is approved", async () => {
    const ids = seedRecordedStory();
    const { setSceneVideoApproval, approveClipsAndContinue } = await import("@/lib/story-engine.server");

    for (const id of ids) await setSceneVideoApproval(STORY_ID, id, true);
    const story = await approveClipsAndContinue(STORY_ID);

    expect(story.status).toBe("audio");
    expect(story.currentStep).toBe("audio");
    // And the DTO reports every clip as reviewed.
    expect(story.scenes.every((scene) => scene.videoApproved)).toBe(true);
  });

  test("withdrawing approval closes the gate again", async () => {
    const ids = seedRecordedStory();
    const { setSceneVideoApproval, approveClipsAndContinue } = await import("@/lib/story-engine.server");

    for (const id of ids) await setSceneVideoApproval(STORY_ID, id, true);
    await setSceneVideoApproval(STORY_ID, ids[1], false);

    await expect(approveClipsAndContinue(STORY_ID)).rejects.toThrow(/scene 2/);
  });

  test("a clip that has not finished recording cannot be approved", async () => {
    const ids = seedRecordedStory();
    db.run("UPDATE story_scenes SET status = 'video_generating' WHERE id = ?", [ids[2]]);
    const { setSceneVideoApproval } = await import("@/lib/story-engine.server");

    await expect(setSceneVideoApproval(STORY_ID, ids[2], true)).rejects.toThrow(/not finished recording/);
  });

  test("approval is refused once the film is being or has been cut", async () => {
    const ids = seedRecordedStory("assembling");
    const { setSceneVideoApproval } = await import("@/lib/story-engine.server");

    await expect(setSceneVideoApproval(STORY_ID, ids[0], true)).rejects.toThrow(/Video step/);
  });

  test("a clip can still be approved at Audio — going back is not a dead end", async () => {
    const ids = seedRecordedStory("audio");
    const { setSceneVideoApproval } = await import("@/lib/story-engine.server");

    const story = await setSceneVideoApproval(STORY_ID, ids[0], true);
    expect(story.scenes[0].videoApproved).toBe(true);
  });

  test("an unknown scene is rejected", async () => {
    seedRecordedStory();
    const { setSceneVideoApproval } = await import("@/lib/story-engine.server");

    await expect(setSceneVideoApproval(STORY_ID, "no-such-scene", true)).rejects.toThrow(/not part of this story/);
  });
});

describe("final cut acceptance", () => {
  test("accepting the film records the approval", async () => {
    seedRecordedStory("ready");
    const { acceptFinalCut } = await import("@/lib/story-engine.server");

    const story = await acceptFinalCut(STORY_ID);
    expect(story.finalApproved).toBe(true);

    const row = db.query("SELECT final_approved FROM stories WHERE id = ?").get(STORY_ID) as { final_approved: number };
    expect(row.final_approved).toBe(1);
  });

  test("a story that is not finished cannot be accepted", async () => {
    seedRecordedStory();
    const { acceptFinalCut } = await import("@/lib/story-engine.server");

    const story = await acceptFinalCut(STORY_ID);
    expect(story.finalApproved).toBe(false);
  });
});

describe("fixing a scene invalidates its clip", () => {
  test("editing the description drops the clip and its approval", async () => {
    const ids = seedRecordedStory();
    approveAll();
    const { updateSceneDescription } = await import("@/lib/story-engine.server");

    await updateSceneDescription(STORY_ID, ids[2], "She waits under the awning wearing an ivory coat.");

    const row = db
      .query("SELECT description, video_url, video_key, video_approved FROM story_scenes WHERE id = ?")
      .get(ids[2]) as { description: string; video_url: string | null; video_key: string | null; video_approved: number };

    expect(row.description).toContain("ivory coat");
    // A clip that no longer matches the words must not be approvable.
    expect(row.video_url).toBeNull();
    expect(row.video_key).toBeNull();
    expect(row.video_approved).toBe(0);
  });

  test("the edit is mirrored into the stored script", async () => {
    const ids = seedRecordedStory();
    const { updateSceneDescription } = await import("@/lib/story-engine.server");

    await updateSceneDescription(STORY_ID, ids[1], "A corrected second scene.");

    const row = db.query("SELECT script_json FROM stories WHERE id = ?").get(STORY_ID) as { script_json: string };
    const script = JSON.parse(row.script_json) as { scenes: { description: string }[] };
    // The Script step reads script_json, so a video-step correction must land there too.
    expect(script.scenes[1].description).toBe("A corrected second scene.");
    expect(script.scenes[0].description).toBe("one");
  });

  test("other scenes are untouched by the edit", async () => {
    const ids = seedRecordedStory();
    approveAll();
    const { updateSceneDescription } = await import("@/lib/story-engine.server");

    await updateSceneDescription(STORY_ID, ids[0], "new words");

    const other = db
      .query("SELECT video_url, video_approved FROM story_scenes WHERE id = ?")
      .get(ids[1]) as { video_url: string | null; video_approved: number };
    expect(other.video_url).toBe("https://provider/clip-2.mp4");
    expect(other.video_approved).toBe(1);
  });
});
