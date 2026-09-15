import type { D1Database } from "@cloudflare/workers-types";
import { ApiJobError } from "@higgsfield/fnf/errors";
import { createLlmClient } from "@higgsfield/fnf";
import type { MediaRef } from "@higgsfield/fnf/media";
import { createServerFnf } from "./fnf.server";
import type { SceneAspectRatio } from "./generation/port";
import { getGenerationProvider } from "./generation/registry.server";
import {
  DEFAULT_DURATION_SECONDS,
  getLocation,
  getTemplate,
  sceneCountForDuration,
} from "./story-templates";

/** Every CineStory scene is shot vertically. */
const SCENE_ASPECT_RATIO: SceneAspectRatio = "9:16";

export interface StoredRef {
  ref: MediaRef;
  src: string;
}

export interface SceneDTO {
  id: string;
  idx: number;
  description: string;
  camera: string | null;
  dialogue: string | null;
  onScreenText: string | null;
  status: string;
  imageUrl: string | null;
  videoUrl: string | null;
  error: string | null;
}

export interface StoryDTO {
  id: string;
  projectId: string | null;
  idea: string;
  templateId: string;
  templateTitle: string;
  locationId: string;
  locationTitle: string;
  durationSec: number;
  sceneCount: number;
  status: string;
  progressLabel: string | null;
  title: string | null;
  hook: string | null;
  cta: string | null;
  musicMood: string | null;
  colorGrade: string | null;
  error: string | null;
  finalVideoUrl: string | null;
  finalPosterUrl: string | null;
  createdAt: string;
  updatedAt: string;
  scenes: SceneDTO[];
}

interface StoryRow {
  id: string;
  owner_key?: string;
  project_id: string | null;
  idea: string;
  template_id: string;
  location_id: string;
  duration_sec: number;
  scene_count: number;
  status: string;
  progress_label: string | null;
  title: string | null;
  hook: string | null;
  cta: string | null;
  music_mood: string | null;
  color_grade: string | null;
  script_json: string | null;
  selfie_ref: string | null;
  reference_ref: string | null;
  final_video_key: string | null;
  final_poster_key: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface SceneRow {
  id: string;
  story_id: string;
  idx: number;
  description: string;
  camera: string | null;
  dialogue: string | null;
  on_screen_text: string | null;
  status: string;
  image_job_id: string | null;
  image_url: string | null;
  video_job_id: string | null;
  video_url: string | null;
  error: string | null;
}

interface DevState {
  stories: Map<string, StoryRow>;
  scenes: Map<string, SceneRow[]>;
}

const devGlobal = globalThis as typeof globalThis & { __cineStoryDevState?: DevState };
function devState(): DevState {
  return (devGlobal.__cineStoryDevState ??= { stories: new Map(), scenes: new Map() });
}

async function database(): Promise<D1Database | null> {
  try {
    const { bindings } = await import("./bindings.server");
    const db = bindings().DB;
    if (db) return db;
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
  }
  if (import.meta.env.DEV) return null;
  throw new ApiJobError("story_database_unavailable", "The story database is not configured.", {
    status: 503,
  });
}

export async function ownerKey(): Promise<string> {
  try {
    const profile = createServerFnf().profile;
    const user = await profile.getUser();
    if (!user) {
      throw new ApiJobError("authentication_required", "Sign in to create a story.", {
        status: 401,
      });
    }
    const workspace = await profile.getCurrentWorkspace().catch(() => null);
    return `user:${user.id}:workspace:${workspace?.id ?? user.workspaceId ?? "personal"}`;
  } catch (error) {
    if (import.meta.env.DEV) return "development:local";
    throw error;
  }
}

function toDTO(story: StoryRow, scenes: SceneRow[], mediaBaseUrl: string): StoryDTO {
  const template = getTemplate(story.template_id);
  const location = getLocation(story.location_id, template);
  return {
    id: story.id,
    projectId: story.project_id,
    idea: story.idea,
    templateId: story.template_id,
    templateTitle: template.title,
    locationId: story.location_id,
    locationTitle: location.title,
    durationSec: story.duration_sec,
    sceneCount: story.scene_count,
    status: story.status,
    progressLabel: story.progress_label,
    title: story.title,
    hook: story.hook,
    cta: story.cta,
    musicMood: story.music_mood,
    colorGrade: story.color_grade,
    error: story.error,
    finalVideoUrl: story.final_video_key ? `${mediaBaseUrl}/${story.final_video_key}` : null,
    finalPosterUrl: story.final_poster_key ? `${mediaBaseUrl}/${story.final_poster_key}` : null,
    createdAt: story.created_at,
    updatedAt: story.updated_at,
    scenes: scenes
      .slice()
      .sort((a, b) => a.idx - b.idx)
      .map((scene) => ({
        id: scene.id,
        idx: scene.idx,
        description: scene.description,
        camera: scene.camera,
        dialogue: scene.dialogue,
        onScreenText: scene.on_screen_text,
        status: scene.status,
        imageUrl: scene.image_url,
        videoUrl: scene.video_url,
        error: scene.error,
      })),
  };
}

interface ScriptScene {
  description: string;
  camera: string;
  dialogue: string;
  onScreenText: string;
}
interface Script {
  title: string;
  hook: string;
  cta: string;
  musicMood: string;
  colorGrade: string;
  scenes: ScriptScene[];
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new ApiJobError("script_parse_failed", "The director's script could not be parsed.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function generateScript(input: {
  idea: string;
  templateDirective: string;
  templateTitle: string;
  locationDescription: string;
  sceneCount: number;
}): Promise<Script> {
  const llm = createLlmClient({ baseUrl: "https://fnf.internal/llm" });
  const [model] = await llm.listModels();
  if (!model) {
    throw new ApiJobError("llm_unavailable", "No script-writing model is currently available.");
  }

  const system = [
    "You are the creative director and screenwriter for CineStory, an AI cinematic short-video studio.",
    "You turn one simple idea into a tight, emotionally engineered short-form vertical video script.",
    `Story template: ${input.templateTitle}. Creative direction: ${input.templateDirective}`,
    `Setting: ${input.locationDescription}.`,
    `Write EXACTLY ${input.sceneCount} scenes, each a distinct visual beat that reads as a continuous story arc: hook, build, turn, payoff/CTA.`,
    "Every scene must feature the SAME main subject (the user's own photo will be used as their likeness) for full visual continuity — describe wardrobe, expression and pose so they stay consistent scene to scene.",
    "Dialogue/narration lines must be short (under 18 words) — they will be spoken on camera or read as voiceover.",
    "Respond with ONLY strict JSON, no markdown fences, matching exactly this shape:",
    '{"title": string, "hook": string, "cta": string, "musicMood": string, "colorGrade": string, "scenes": [{"description": string, "camera": string, "dialogue": string, "onScreenText": string}]}',
  ].join("\n");

  const res = await llm.complete({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `The idea: ${input.idea}` },
    ],
  });

  const content = res.content ?? "";
  const parsed = extractJson(String(content)) as Partial<Script>;
  if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new ApiJobError("script_invalid", "The director's script was empty.");
  }
  return {
    title: String(parsed.title ?? "Untitled story"),
    hook: String(parsed.hook ?? ""),
    cta: String(parsed.cta ?? ""),
    musicMood: String(parsed.musicMood ?? "cinematic, emotional"),
    colorGrade: String(parsed.colorGrade ?? "warm cinematic"),
    scenes: parsed.scenes.slice(0, input.sceneCount).map((scene) => ({
      description: String(scene.description ?? ""),
      camera: String(scene.camera ?? "slow push in"),
      dialogue: String(scene.dialogue ?? ""),
      onScreenText: String(scene.onScreenText ?? ""),
    })),
  };
}

export async function createStory(input: {
  idea: string;
  templateId: string;
  locationId: string;
  durationSec: number;
  projectId?: string;
  selfieRef?: StoredRef;
  referenceRef?: StoredRef;
}): Promise<StoryDTO> {
  const owner = await ownerKey();
  const db = await database();
  const template = getTemplate(input.templateId);
  const location = getLocation(input.locationId, template);
  const durationSec = input.durationSec > 0 ? input.durationSec : DEFAULT_DURATION_SECONDS;
  const sceneCount = sceneCountForDuration(durationSec);

  const script = await generateScript({
    idea: input.idea,
    templateDirective: template.directive,
    templateTitle: template.title,
    locationDescription: location.description,
    sceneCount,
  });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: StoryRow = {
    id,
    project_id: input.projectId ?? null,
    idea: input.idea,
    template_id: input.templateId,
    location_id: input.locationId,
    duration_sec: durationSec,
    scene_count: script.scenes.length,
    status: "generating",
    progress_label: "Casting your scenes…",
    title: script.title,
    hook: script.hook,
    cta: script.cta,
    music_mood: script.musicMood,
    color_grade: script.colorGrade,
    script_json: JSON.stringify(script),
    selfie_ref: input.selfieRef ? JSON.stringify(input.selfieRef) : null,
    reference_ref: input.referenceRef ? JSON.stringify(input.referenceRef) : null,
    final_video_key: null,
    final_poster_key: null,
    error: null,
    created_at: now,
    updated_at: now,
  };
  const sceneRows: SceneRow[] = script.scenes.map((scene, idx) => ({
    id: crypto.randomUUID(),
    story_id: id,
    idx,
    description: scene.description,
    camera: scene.camera,
    dialogue: scene.dialogue,
    on_screen_text: scene.onScreenText,
    status: "pending",
    image_job_id: null,
    image_url: null,
    video_job_id: null,
    video_url: null,
    error: null,
  }));

  if (!db) {
    devState().stories.set(id, row);
    devState().scenes.set(id, sceneRows);
  } else {
    await db
      .prepare(
        `INSERT INTO stories (id, owner_key, project_id, idea, template_id, location_id, duration_sec, scene_count, status, progress_label, title, hook, cta, music_mood, color_grade, script_json, selfie_ref, reference_ref)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id,
        owner,
        row.project_id,
        row.idea,
        row.template_id,
        row.location_id,
        row.duration_sec,
        row.scene_count,
        row.status,
        row.progress_label,
        row.title,
        row.hook,
        row.cta,
        row.music_mood,
        row.color_grade,
        row.script_json,
        row.selfie_ref,
        row.reference_ref,
      )
      .run();
    await db.batch(
      sceneRows.map((scene) =>
        db
          .prepare(
            `INSERT INTO story_scenes (id, story_id, idx, description, camera, dialogue, on_screen_text, status)
             VALUES (?,?,?,?,?,?,?,?)`,
          )
          .bind(
            scene.id,
            scene.story_id,
            scene.idx,
            scene.description,
            scene.camera,
            scene.dialogue,
            scene.on_screen_text,
            scene.status,
          ),
      ),
    );
  }

  // Kick off every scene's image generation in parallel — fire-and-forget,
  // the poll/advance loop in getStory() picks up completion.
  await Promise.all(
    sceneRows.map((scene) => submitSceneImage(owner, db, id, scene, row, template, location)),
  );

  return getStory(id);
}

async function submitSceneImage(
  owner: string,
  db: D1Database | null,
  storyId: string,
  scene: SceneRow,
  story: StoryRow,
  template: ReturnType<typeof getTemplate>,
  location: ReturnType<typeof getLocation>,
): Promise<void> {
  try {
    const selfie: StoredRef | null = story.selfie_ref ? JSON.parse(story.selfie_ref) : null;
    const reference: StoredRef | null = story.reference_ref ? JSON.parse(story.reference_ref) : null;
    const images = [selfie?.ref, reference?.ref].filter((ref): ref is MediaRef => Boolean(ref));

    const instruction = [
      `Cinematic still frame for a ${template.title} short film.`,
      `Setting: ${location.description}.`,
      scene.description,
      scene.camera ? `Camera: ${scene.camera}.` : "",
      "Photoreal, color-graded, professional cinematography. Keep the same person's face, wardrobe and identity consistent with the reference photo.",
    ]
      .filter(Boolean)
      .join(" ");

    const job = await getGenerationProvider().submitSceneImage({
      instruction,
      references: images,
      aspectRatio: SCENE_ASPECT_RATIO,
    });
    await updateScene(db, storyId, scene.id, { status: "image_generating", image_job_id: job.jobId });
  } catch (error) {
    await updateScene(db, storyId, scene.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Image generation failed to start.",
    });
  }
}

async function updateScene(
  db: D1Database | null,
  storyId: string,
  sceneId: string,
  patch: Partial<SceneRow>,
): Promise<void> {
  if (!db) {
    const scenes = devState().scenes.get(storyId) ?? [];
    const scene = scenes.find((s) => s.id === sceneId);
    if (scene) Object.assign(scene, patch);
    return;
  }
  const fields = Object.keys(patch);
  if (fields.length === 0) return;
  const setClause = fields.map((field) => `${field} = ?`).join(", ");
  await db
    .prepare(`UPDATE story_scenes SET ${setClause} WHERE id = ? AND story_id = ?`)
    .bind(...fields.map((field) => (patch as Record<string, unknown>)[field]), sceneId, storyId)
    .run();
}

async function updateStory(
  db: D1Database | null,
  storyId: string,
  patch: Partial<StoryRow>,
): Promise<void> {
  if (!db) {
    const story = devState().stories.get(storyId);
    if (story) Object.assign(story, patch, { updated_at: new Date().toISOString() });
    return;
  }
  const fields = Object.keys(patch);
  const setClause = [...fields.map((field) => `${field} = ?`), "updated_at = datetime('now')"].join(
    ", ",
  );
  await db
    .prepare(`UPDATE stories SET ${setClause} WHERE id = ?`)
    .bind(...fields.map((field) => (patch as Record<string, unknown>)[field]), storyId)
    .run();
}

/** Advance every in-flight scene one step (image done -> submit video; video done -> ready). */
async function advanceScenes(db: D1Database | null, story: StoryRow, scenes: SceneRow[]): Promise<SceneRow[]> {
  const template = getTemplate(story.template_id);
  const location = getLocation(story.location_id, template);
  const provider = getGenerationProvider();
  const next: SceneRow[] = [];

  for (const scene of scenes) {
    if (scene.status === "image_generating" && scene.image_job_id) {
      const job = await provider.getSceneJob(scene.image_job_id);
      if (!job) {
        next.push(scene);
        continue;
      }
      if (job.phase === "completed") {
        const imageUrl = job.rawUrl ?? "";
        await submitSceneVideo(db, story, scene, imageUrl, template, location);
        next.push({ ...scene, status: "video_generating", image_url: imageUrl });
      } else if (job.phase === "failed") {
        await updateScene(db, story.id, scene.id, { status: "failed", error: "Scene image failed to generate." });
        next.push({ ...scene, status: "failed" });
      } else {
        next.push(scene);
      }
    } else if (scene.status === "video_generating" && scene.video_job_id) {
      const job = await provider.getSceneJob(scene.video_job_id);
      if (!job) {
        next.push(scene);
        continue;
      }
      if (job.phase === "completed") {
        const videoUrl = job.rawUrl ?? "";
        await updateScene(db, story.id, scene.id, { status: "ready", video_url: videoUrl });
        next.push({ ...scene, status: "ready", video_url: videoUrl });
      } else if (job.phase === "failed") {
        await updateScene(db, story.id, scene.id, { status: "failed", error: "Scene video failed to generate." });
        next.push({ ...scene, status: "failed" });
      } else {
        next.push(scene);
      }
    } else {
      next.push(scene);
    }
  }
  return next;
}

async function submitSceneVideo(
  db: D1Database | null,
  story: StoryRow,
  scene: SceneRow,
  startImageUrl: string,
  template: ReturnType<typeof getTemplate>,
  location: ReturnType<typeof getLocation>,
): Promise<void> {
  try {
    const provider = getGenerationProvider();
    const imageBytes = new Uint8Array(await (await fetch(startImageUrl)).arrayBuffer());
    const { ref: startImageRef } = await provider.uploadReference({
      source: imageBytes,
      filename: `scene-${scene.idx}.png`,
    });
    const targetSceneSeconds = Math.max(3, Math.min(10, Math.round(story.duration_sec / story.scene_count)));
    const clipDuration = targetSceneSeconds <= 7 ? 5 : 10;

    const instruction = [
      `${template.title} short film scene.`,
      `Setting: ${location.description}.`,
      scene.description,
      scene.camera ? `Camera movement: ${scene.camera}.` : "",
      scene.dialogue ? `The subject says: "${scene.dialogue}"` : "Natural ambient motion and sound.",
    ]
      .filter(Boolean)
      .join(" ");

    const job = await provider.submitSceneVideo({
      instruction,
      startImage: startImageRef,
      aspectRatio: SCENE_ASPECT_RATIO,
      durationSeconds: clipDuration,
    });
    await updateScene(db, story.id, scene.id, { status: "video_generating", video_job_id: job.jobId });
  } catch (error) {
    await updateScene(db, story.id, scene.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Video generation failed to start.",
    });
  }
}

/**
 * Advance one story's in-flight generation and return the updated story/scenes.
 * Shared by getStory (single) and listStories (feed) so the pipeline progresses
 * on every poll — otherwise the feed never submits the video jobs.
 * A module-level guard prevents two concurrent polls from double-submitting
 * the same video job (which would waste credits).
 */
const advancingStories = new Set<string>();

async function resolveStory(
  db: D1Database | null,
  story: StoryRow,
  scenes: SceneRow[],
): Promise<{ story: StoryRow; scenes: SceneRow[] }> {
  if (story.status !== "generating" || advancingStories.has(story.id)) {
    return { story, scenes };
  }
  advancingStories.add(story.id);
  try {
    scenes = await advanceScenes(db, story, scenes);
    const allReady = scenes.every((s) => s.status === "ready");
    const anyFailed = scenes.some((s) => s.status === "failed");
    if (allReady) {
      await updateStory(db, story.id, { status: "assembling", progress_label: "Cutting the final film…" });
      story = { ...story, status: "assembling" };
    } else if (anyFailed && scenes.every((s) => s.status === "ready" || s.status === "failed")) {
      await updateStory(db, story.id, {
        status: "failed",
        error: "One or more scenes could not be generated.",
      });
      story = { ...story, status: "failed" };
    } else {
      const done = scenes.filter((s) => s.status === "ready").length;
      const label = `Filming scene ${Math.min(done + 1, scenes.length)} of ${scenes.length}…`;
      await updateStory(db, story.id, { progress_label: label });
      story = { ...story, progress_label: label };
    }
    return { story, scenes };
  } finally {
    advancingStories.delete(story.id);
  }
}

export async function getStory(storyId: string, mediaBaseUrl = "/api/story-media"): Promise<StoryDTO> {
  const owner = await ownerKey();
  const db = await database();
  let story: StoryRow | undefined;
  let scenes: SceneRow[];
  if (!db) {
    story = devState().stories.get(storyId);
    scenes = devState().scenes.get(storyId) ?? [];
  } else {
    const storyResult = await db
      .prepare("SELECT * FROM stories WHERE id = ? AND owner_key = ?")
      .bind(storyId, owner)
      .first<StoryRow>();
    story = storyResult ?? undefined;
    const sceneResult = await db
      .prepare("SELECT * FROM story_scenes WHERE story_id = ? ORDER BY idx ASC")
      .bind(storyId)
      .all<SceneRow>();
    scenes = sceneResult.results;
  }
  if (!story) {
    throw new ApiJobError("story_not_found", "This story no longer exists.", { status: 404 });
  }

  const resolved = await resolveStory(db, story, scenes);
  return toDTO(resolved.story, resolved.scenes, mediaBaseUrl);
}

export async function listStories(projectId?: string): Promise<StoryDTO[]> {
  const owner = await ownerKey();
  const db = await database();
  if (!db) {
    const all = Array.from(devState().stories.values()).filter((s) => !projectId || s.project_id === projectId);
    return all
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((story) => toDTO(story, devState().scenes.get(story.id) ?? [], "/api/story-media"));
  }
  const query = projectId
    ? db
        .prepare(
          "SELECT * FROM stories WHERE owner_key = ? AND project_id = ? ORDER BY updated_at DESC LIMIT 60",
        )
        .bind(owner, projectId)
    : db.prepare("SELECT * FROM stories WHERE owner_key = ? ORDER BY updated_at DESC LIMIT 60").bind(owner);
  const storyRows = await query.all<StoryRow>();
  const results: StoryDTO[] = [];
  for (const story of storyRows.results) {
    const sceneResult = await db
      .prepare("SELECT * FROM story_scenes WHERE story_id = ? ORDER BY idx ASC")
      .bind(story.id)
      .all<SceneRow>();
    const resolved = await resolveStory(db, story, sceneResult.results);
    results.push(toDTO(resolved.story, resolved.scenes, "/api/story-media"));
  }
  return results;
}

export async function markAssemblyStarted(storyId: string): Promise<void> {
  const db = await database();
  await updateStory(db, storyId, { status: "assembling", progress_label: "Cutting the final film…" });
  if (db) {
    await db
      .prepare(
        "INSERT INTO story_assembly_jobs (id, status) VALUES (?, 'running') ON CONFLICT(id) DO UPDATE SET status='running', error=NULL",
      )
      .bind(storyId)
      .run();
  }
}

export async function finalizeStory(
  storyId: string,
  videoKey: string,
  posterKey: string | null,
): Promise<void> {
  const db = await database();
  await updateStory(db, storyId, {
    status: "ready",
    progress_label: null,
    final_video_key: videoKey,
    final_poster_key: posterKey,
  });
  if (db) {
    await db
      .prepare(
        "UPDATE story_assembly_jobs SET status='done', output_video_key=?, output_poster_key=? WHERE id=?",
      )
      .bind(videoKey, posterKey, storyId)
      .run();
  }
}

export async function failStory(storyId: string, message: string): Promise<void> {
  const db = await database();
  await updateStory(db, storyId, { status: "failed", error: message, progress_label: null });
  if (db) {
    await db
      .prepare("UPDATE story_assembly_jobs SET status='error', error=? WHERE id=?")
      .bind(message, storyId)
      .run();
  }
}

export async function getStoryOwnerAndClips(
  storyId: string,
): Promise<{ story: StoryRow; scenes: SceneRow[] } | null> {
  const db = await database();
  if (!db) {
    const story = devState().stories.get(storyId);
    if (!story) return null;
    return { story, scenes: devState().scenes.get(storyId) ?? [] };
  }
  const story = await db.prepare("SELECT * FROM stories WHERE id = ?").bind(storyId).first<StoryRow>();
  if (!story) return null;
  const scenes = await db
    .prepare("SELECT * FROM story_scenes WHERE story_id = ? ORDER BY idx ASC")
    .bind(storyId)
    .all<SceneRow>();
  return { story, scenes: scenes.results };
}
