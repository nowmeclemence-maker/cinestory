import type { D1Database } from "@cloudflare/workers-types";
import { ApiJobError } from "@higgsfield/fnf/errors";
import { createLlmClient } from "@higgsfield/fnf";
import type { MediaRef } from "@higgsfield/fnf/media";
import { createServerFnf } from "./fnf.server";
import type { GenerationMediaRef, SceneAspectRatio } from "./generation/port";
import { getGenerationProvider } from "./generation/registry.server";
import { d1ClaimStore, inMemoryClaimStore, withClaim } from "./story-claims";
import { completeJsonWithRetry, extractJson, extractJsonArray, hasItems } from "./llm-json";
import {
  DEFAULT_DURATION_SECONDS,
  estimateFilmCost,
  getLocation,
  getTemplate,
  IMAGE_COST_CREDITS,
  sceneCountForDuration,
  sceneDurationSeconds,
  STORY_LOCATIONS,
  videoClipCostCredits,
} from "./story-templates";

/** Every CineStory scene is shot vertically. */
const SCENE_ASPECT_RATIO: SceneAspectRatio = "9:16";

// Phase 1: distributed claim store backing every paid submit path. With D1 the
// CAS goes through SQLite (atomic upsert); the in-memory store is a dev-only
// fallback when D1 is unavailable.
const devClaimStore = inMemoryClaimStore();
function claimStore(db: D1Database | null) {
  return db ? d1ClaimStore(db) : devClaimStore;
}

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
  // Lot D: per-scene set / location
  locationName: string | null;
  locationDescription: string | null;
  locationSource: string | null;
  locationImage: string | null;
  locationJobId: string | null;
  // Lot E: dialogue toggle
  dialogueEnabled: boolean;
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
  currentStep: string;
  estimatedCost: number;
  spentCost: number;
  title: string | null;
  hook: string | null;
  cta: string | null;
  musicMood: string | null;
  colorGrade: string | null;
  error: string | null;
  finalVideoUrl: string | null;
  finalPosterUrl: string | null;
  // Lot E: audio
  musicTrack: { name: string; url: string } | null;
  voiceoverUrl: string | null;
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
  current_step?: string;
  estimated_cost?: number;
  spent_cost?: number;
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
  music_track?: string | null;
  voiceover_url?: string | null;
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
  retry_count?: number;
  // Lot D: per-scene set / location
  location_name?: string | null;
  location_description?: string | null;
  location_ref?: string | null;
  location_source?: string | null;
  location_job_id?: string | null;
  // Lot E: dialogue toggle
  dialogue_enabled?: number;
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
    currentStep: story.current_step ?? "old",
    estimatedCost: Number(story.estimated_cost ?? 0),
    spentCost: Number(story.spent_cost ?? 0),
    title: story.title,
    hook: story.hook,
    cta: story.cta,
    musicMood: story.music_mood,
    colorGrade: story.color_grade,
    error: story.error,
    finalVideoUrl: story.final_video_key ? `${mediaBaseUrl}/${story.final_video_key}` : null,
    finalPosterUrl: story.final_poster_key ? `${mediaBaseUrl}/${story.final_poster_key}` : null,
    musicTrack: tryParseJson<{ name: string; url: string } | null>(story.music_track, null),
    voiceoverUrl: story.voiceover_url ?? null,
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
        locationName: scene.location_name ?? null,
        locationDescription: scene.location_description ?? null,
        locationSource: scene.location_source ?? null,
        locationImage: tryParseJson<StoredRef | null>(scene.location_ref, null)?.src ?? null,
        locationJobId: scene.location_job_id ?? null,
        dialogueEnabled: scene.dialogue_enabled !== 0,
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

// JSON extraction lives in ./llm-json (pure + unit-tested). The old local
// helper sliced from the first "{" to the last "}", which broke every
// top-level ARRAY reply — see tests/llm-json.test.ts.

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

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: `The idea: ${input.idea}` },
  ];
  // One stricter retry on a parse failure (formatting drift, not capability).
  const parsed = (await completeJsonWithRetry(
    (extra) =>
      llm
        .complete({ model, messages: extra ? [...messages, { role: "user", content: extra }] : messages })
        .then((res) => String(res.content ?? "")),
    extractJson,
  )) as Partial<Script> | null;

  if (parsed == null) {
    throw new ApiJobError("script_parse_failed", "The director's script could not be parsed.");
  }
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
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

  // Estimated cost (before regenerations): images + videos at exact per-scene
  // duration (Lot B) — confirmed Higgsfield pricing.
  const estimatedCost = estimateFilmCost(durationSec, script.scenes.length);

  const row: StoryRow = {
    id,
    project_id: input.projectId ?? null,
    idea: input.idea,
    template_id: input.templateId,
    location_id: input.locationId,
    duration_sec: durationSec,
    scene_count: script.scenes.length,
    status: "draft",
    progress_label: null,
    current_step: "script",
    estimated_cost: estimatedCost,
    spent_cost: 0,
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
  const sceneRows: SceneRow[] = buildSceneRows(id, script);

  if (!db) {
    devState().stories.set(id, row);
    devState().scenes.set(id, sceneRows);
  } else {
    await db
      .prepare(
        `INSERT INTO stories (id, owner_key, project_id, idea, template_id, location_id, duration_sec, scene_count, status, progress_label, current_step, estimated_cost, spent_cost, title, hook, cta, music_mood, color_grade, script_json, selfie_ref, reference_ref)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
        row.current_step ?? "video",
        row.estimated_cost ?? 0,
        row.spent_cost ?? 0,
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

  // Lot A: a new story stops at the Script step. Nothing is generated until
  // the user validates the script (validateScript) — no silent generation chain.
  return getStory(id);
}

/** Build the file rows for a script (shared by create / regenerate / edits). */
function buildSceneRows(storyId: string, script: Script): SceneRow[] {
  return script.scenes.map((scene, idx) => ({
    id: crypto.randomUUID(),
    story_id: storyId,
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
}

function insertSceneStatement(db: D1Database, scene: SceneRow) {
  return db
    .prepare(
      `INSERT INTO story_scenes (id, story_id, idx, description, camera, dialogue, on_screen_text, status)
       VALUES (?,?,?,?,?,?,?,'pending')`,
    )
    .bind(scene.id, scene.story_id, scene.idx, scene.description, scene.camera, scene.dialogue, scene.on_screen_text);
}

async function loadScenes(db: D1Database | null, storyId: string): Promise<SceneRow[]> {
  if (!db) return devState().scenes.get(storyId) ?? [];
  const result = await db
    .prepare("SELECT * FROM story_scenes WHERE story_id = ? ORDER BY idx ASC")
    .bind(storyId)
    .all<SceneRow>();
  return result.results;
}

async function loadOwnedStory(storyId: string): Promise<{ db: D1Database | null; story: StoryRow }> {
  const owner = await ownerKey();
  const db = await database();
  if (!db) {
    const story = devState().stories.get(storyId);
    if (!story || story.owner_key !== owner) {
      throw new ApiJobError("story_not_found", "This story no longer exists.", { status: 404 });
    }
    return { db: null, story };
  }
  const story = await db
    .prepare("SELECT * FROM stories WHERE id = ? AND owner_key = ?")
    .bind(storyId, owner)
    .first<StoryRow>();
  if (!story) {
    throw new ApiJobError("story_not_found", "This story no longer exists.", { status: 404 });
  }
  return { db, story };
}

function scriptLockedError() {
  return new ApiJobError(
    "script_locked",
    "The script can only be edited while the story is still at the Script step.",
    { status: 409 },
  );
}

export interface ScriptSceneEdit {
  idx: number;
  description: string;
  camera: string;
  dialogue: string;
  onScreenText: string;
}

/**
 * Lot A — persist a user-edited script (title, hook, scenes). Only allowed at
 * the Script step, before any generation; scenes are rebuilt so reordering,
 * insertions and deletions stay index-consistent. Nothing is charged.
 */
export async function updateScript(
  storyId: string,
  edits: { title: string; hook: string; cta?: string; scenes: ScriptSceneEdit[] },
): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "draft") throw scriptLockedError();

  const scenes = edits.scenes.map((scene) => ({
    description: scene.description ?? "",
    camera: scene.camera ?? "",
    dialogue: scene.dialogue ?? "",
    onScreenText: scene.onScreenText ?? "",
  }));
  if (scenes.length === 0) {
    throw new ApiJobError("script_empty", "A script needs at least one scene.", { status: 400 });
  }

  let parsed: Partial<Script> | null;
  try {
    parsed = story.script_json ? (JSON.parse(story.script_json) as Partial<Script>) : null;
  } catch {
    parsed = null;
  }
  const nextScript: Script = {
    title: edits.title,
    hook: edits.hook,
    cta: edits.cta ?? parsed?.cta ?? "",
    musicMood: parsed?.musicMood ?? "cinematic, emotional",
    colorGrade: parsed?.colorGrade ?? "warm cinematic",
    scenes: scenes.map((scene) => ({
      description: scene.description,
      camera: scene.camera,
      dialogue: scene.dialogue,
      onScreenText: scene.onScreenText,
    })),
  };

  const sceneRows: SceneRow[] = scenes.map((scene, idx) => ({
    id: crypto.randomUUID(),
    story_id: storyId,
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
    const dev = devState().stories.get(storyId);
    if (dev) {
      Object.assign(dev, {
        title: nextScript.title,
        hook: nextScript.hook,
        cta: nextScript.cta,
        script_json: JSON.stringify(nextScript),
        scene_count: sceneRows.length,
        updated_at: new Date().toISOString(),
      });
    }
    devState().scenes.set(storyId, sceneRows);
  } else {
    await db.batch([
      db
        .prepare(
          "UPDATE stories SET title=?, hook=?, cta=?, script_json=?, scene_count=?, updated_at=datetime('now') WHERE id=?",
        )
        .bind(nextScript.title, nextScript.hook, nextScript.cta, JSON.stringify(nextScript), sceneRows.length, storyId),
      db.prepare("DELETE FROM story_scenes WHERE story_id = ?").bind(storyId),
      ...sceneRows.map((scene) => insertSceneStatement(db, scene)),
    ]);
  }
  return getStory(storyId);
}

/** Lot A — ask the AI to rewrite the script (same idea, template, location, duration). */
export async function regenerateScript(storyId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "draft") throw scriptLockedError();

  const template = getTemplate(story.template_id);
  const location = getLocation(story.location_id, template);
  const script = await generateScript({
    idea: story.idea,
    templateDirective: template.directive,
    templateTitle: template.title,
    locationDescription: location.description,
    sceneCount: story.scene_count,
  });
  const sceneRows = buildSceneRows(storyId, script);

  if (!db) {
    const dev = devState().stories.get(storyId);
    if (dev) {
      Object.assign(dev, {
        title: script.title,
        hook: script.hook,
        cta: script.cta,
        music_mood: script.musicMood,
        color_grade: script.colorGrade,
        script_json: JSON.stringify(script),
        scene_count: script.scenes.length,
        updated_at: new Date().toISOString(),
      });
    }
    devState().scenes.set(storyId, sceneRows);
  } else {
    await db.batch([
      db
        .prepare(
          "UPDATE stories SET title=?, hook=?, cta=?, music_mood=?, color_grade=?, script_json=?, scene_count=?, updated_at=datetime('now') WHERE id=?",
        )
        .bind(script.title, script.hook, script.cta, script.musicMood, script.colorGrade, JSON.stringify(script), script.scenes.length, storyId),
      db.prepare("DELETE FROM story_scenes WHERE story_id = ?").bind(storyId),
      ...sceneRows.map((scene) => insertSceneStatement(db, scene)),
    ]);
  }
  return getStory(storyId);
}

/**
 * Remaster — clone any existing story (e.g. an old pipeline story that failed
 * on credits) into the MODERN step pipeline at the Script step, preserving the
 * script, cast info, idea, template and settings. Nothing is generated: the
 * new draft runs through Script → Cast → Sets → … gates from scratch.
 */
export async function remasterStory(storyId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  const oldScenes = await loadScenes(db, storyId);

  const script: Script = tryParseJson<Script | null>(story.script_json, null) ?? {
    title: story.title ?? "Untitled story",
    hook: story.hook ?? "",
    cta: story.cta ?? "",
    musicMood: story.music_mood ?? "cinematic, emotional",
    colorGrade: story.color_grade ?? "warm cinematic",
    scenes: oldScenes.map((scene) => ({
      description: scene.description,
      camera: scene.camera ?? "",
      dialogue: scene.dialogue ?? "",
      onScreenText: scene.on_screen_text ?? "",
    })),
  };
  if (script.scenes.length === 0) {
    throw new ApiJobError("story_incomplete", "This story has no script to remaster.", { status: 400 });
  }

  const id = crypto.randomUUID();
  const durationSec = story.duration_sec > 0 ? story.duration_sec : DEFAULT_DURATION_SECONDS;
  const sceneRows = buildSceneRows(id, script);
  const estimatedCost = estimateFilmCost(durationSec, sceneRows.length);
  const now = new Date().toISOString();

  const row: StoryRow = {
    id,
    project_id: story.project_id,
    idea: story.idea,
    template_id: story.template_id,
    location_id: story.location_id,
    duration_sec: durationSec,
    scene_count: sceneRows.length,
    status: "draft",
    progress_label: null,
    current_step: "script",
    estimated_cost: estimatedCost,
    spent_cost: 0,
    title: script.title,
    hook: script.hook,
    cta: script.cta,
    music_mood: script.musicMood,
    color_grade: script.colorGrade,
    script_json: JSON.stringify(script),
    selfie_ref: story.selfie_ref,
    reference_ref: story.reference_ref,
    final_video_key: null,
    final_poster_key: null,
    error: null,
    created_at: now,
    updated_at: now,
  };

  if (!db) {
    devState().stories.set(id, row);
    devState().scenes.set(id, sceneRows);
  } else {
    await db
      .prepare(
        `INSERT INTO stories (id, owner_key, project_id, idea, template_id, location_id, duration_sec, scene_count, status, progress_label, current_step, estimated_cost, spent_cost, title, hook, cta, music_mood, color_grade, script_json, selfie_ref, reference_ref)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id, story.owner_key ?? "",
        row.project_id, row.idea, row.template_id, row.location_id, row.duration_sec,
        row.scene_count, row.status, row.progress_label, row.current_step,
        row.estimated_cost, row.spent_cost,
        row.title, row.hook, row.cta, row.music_mood, row.color_grade,
        row.script_json, row.selfie_ref, row.reference_ref,
      )
      .run();
    await db.batch(sceneRows.map((scene) => insertSceneStatement(db, scene)));
  }
  return getStory(id);
}
export async function validateScript(storyId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "draft") return getStory(storyId);

  await updateStory(db, storyId, {
    status: "characters",
    current_step: "characters",
    progress_label: "Cast your story…",
  });

  // Landing on an empty Characters screen was a dead end: the casting director
  // runs automatically on entry so the user arrives to a pre-filled cast. It is
  // best-effort by design — if the proposal fails, the step still offers the
  // manual paths (library, photo, portrait, skip), so nothing is blocked.
  try {
    await proposeCharacters(storyId);
  } catch {
    await updateStory(db, storyId, {
      progress_label: "Cast your story — propose with AI, add a photo, or skip.",
    });
  }
  return getStory(storyId);
}

/**
 * Lot B — the PAID GATE: validating the storyboard shows the exact video cost
 * and checks the balance BEFORE launching any Seedance job (~94 % of a film's
 * cost). Idempotent; the story stays at Storyboard when credits are short so
 * the user can top up and retry (nothing was spent).
 */
export async function validateStoryboard(storyId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "storyboard") return getStory(storyId);

  const scenes = await loadScenes(db, storyId);
  const pending = scenes.filter((s) => s.status !== "image_ready");
  if (pending.length > 0) {
    throw new ApiJobError(
      "storyboard_pending",
      `${pending.length} storyboard image${pending.length === 1 ? "" : "s"} not ready yet. Regenerate or wait for them, then validate again.`,
      { status: 409 },
    );
  }

  const secondsPerScene = sceneDurationSeconds(story.duration_sec, story.scene_count);
  const videoCost = scenes.length * videoClipCostCredits(secondsPerScene);
  const available = await getDisplayCredits();
  if (available < videoCost) {
    throw new ApiJobError(
      "insufficient_credits",
      `Not enough credits for videos: ${videoCost} needed, ${Math.floor(available)} available. Add credits in Settings → Credits.`,
      { status: 402 },
    );
  }

  const template = getTemplate(story.template_id);
  const location = getLocation(story.location_id, template);
  // Phase 1: only the request that wins the claim may launch the paid video jobs.
  await withClaim(claimStore(db), `story:${storyId}:videos`, async () => {
    await updateStory(db, storyId, {
      status: "generating",
      current_step: "video",
      progress_label: `Recording scene 1 of ${scenes.length}…`,
    });
    const running = { ...story, status: "generating" as const };
    await Promise.all(
      scenes.map((scene) =>
        submitSceneVideo(db, running, scene, scene.image_url ?? "", template, location),
      ),
    );
  });
  return getStory(storyId);
}

/** Lot B — regenerate ONE storyboard image (1.5 credits) without touching the others. */
export async function regenerateSceneImage(storyId: string, sceneId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "storyboard") {
    throw new ApiJobError(
      "storyboard_locked",
      "Storyboard images can only be regenerated at the Storyboard step.",
      { status: 409 },
    );
  }
  const scenes = await loadScenes(db, storyId);
  const scene = scenes.find((s) => s.id === sceneId);
  if (!scene) {
    throw new ApiJobError("scene_not_found", "Scene not found.", { status: 404 });
  }
  // Phase 1: a scene already generating must not get a second job (double click).
  if (scene.status === "image_generating" && scene.image_job_id) {
    return getStory(storyId);
  }
  const template = getTemplate(story.template_id);
  const location = getLocation(story.location_id, template);
  // Claim is bound to the CURRENT job id, so a second click on the same state
  // cannot start a second job; once the winner advances the job id, the guard
  // above blocks further duplicates.
  await withClaim(
    claimStore(db),
    `scene:${storyId}:${sceneId}:image:${scene.image_job_id ?? "new"}`,
    async () => {
      await submitSceneImage(story.owner_key ?? "", db, storyId, scene, story, template, location);
    },
  );
  return getStory(storyId);
}

export const MAX_CAST = 3;

interface CastImage {
  ref: MediaRef;
  src: string;
}

interface CastRow {
  characterId: string;
  name: string;
  role: string;
  biography: string;
  appearance: string;
  personality: string;
  clothing: string;
  referenceImages: CastImage[];
  sceneIndices: number[] | null;
  portraitJobId: string | null;
}

/** The story's cast (library characters linked via story_characters). */
async function loadCast(db: D1Database | null, storyId: string): Promise<CastRow[]> {
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.role, c.biography, c.appearance, c.personality, c.clothing,
              c.reference_images, c.portrait_job_id, sc.scene_indices
       FROM story_characters sc
       JOIN characters c ON c.id = sc.character_id
       WHERE sc.story_id = ?
       ORDER BY c.created_at ASC`,
    )
    .bind(storyId)
    .all();
  return (rows.results ?? []).map((row) => ({
    characterId: row.id as string,
    name: (row.name as string) ?? "Character",
    role: (row.role as string) ?? "",
    biography: (row.biography as string) ?? "",
    appearance: (row.appearance as string) ?? "",
    personality: (row.personality as string) ?? "",
    clothing: (row.clothing as string) ?? "",
    referenceImages: tryParseJson<CastImage[]>((row.reference_images as string) ?? "", []),
    sceneIndices: tryParseJson<number[] | null>((row.scene_indices as string | null) ?? null, null),
    portraitJobId: ((row.portrait_job_id as string | null) ?? null),
  }));
}

/** Reference media + prompt lines for ONE scene, from the scene's cast. */
function castForScene(cast: CastRow[], sceneIdx: number): { refs: GenerationMediaRef[]; lines: string[] } {
  const refs: GenerationMediaRef[] = [];
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const member of cast) {
    if (member.sceneIndices && !member.sceneIndices.includes(sceneIdx)) continue;
    for (const image of member.referenceImages) {
      const id = image.ref?.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        refs.push({ id, type: "media_input" });
      }
    }
    const looks = [member.appearance.trim(), member.clothing.trim() ? `wearing ${member.clothing.trim()}` : ""]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `${member.name}${member.role ? ` (${member.role})` : ""}${looks ? `: ${looks}` : ""}`,
    );
  }
  return { refs, lines };
}

export interface CastMemberDTO {
  characterId: string;
  name: string;
  role: string;
  biography: string;
  appearance: string;
  personality: string;
  clothing: string;
  portraitUrl: string | null;
  hasReference: boolean;
  portraitJobId: string | null;
  sceneIndices: number[] | null;
}

/** The story's cast, shaped for the casting screen. Resolves finished portraits first. */
export async function listStoryCharacters(storyId: string): Promise<CastMemberDTO[]> {
  const { db } = await loadOwnedStory(storyId);
  await pollCharacterPortraits(db, storyId);
  const cast = await loadCast(db, storyId);
  return cast.map((member) => ({
    characterId: member.characterId,
    name: member.name,
    role: member.role,
    biography: member.biography,
    appearance: member.appearance,
    personality: member.personality,
    clothing: member.clothing,
    portraitUrl: member.referenceImages[0]?.src ?? null,
    hasReference: member.referenceImages.length > 0,
    portraitJobId: member.portraitJobId,
    sceneIndices: member.sceneIndices,
  }));
}

async function linkCharacterRow(
  db: D1Database | null,
  storyId: string,
  characterId: string,
  sceneIndices: number[] | null,
): Promise<void> {
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO story_characters (story_id, character_id, scene_indices) VALUES (?,?,?)
       ON CONFLICT(story_id, character_id) DO UPDATE SET scene_indices = excluded.scene_indices`,
    )
    .bind(storyId, characterId, sceneIndices ? JSON.stringify(sceneIndices) : null)
    .run();
}

/** Link a library character to a story (sceneIndices null = appears in every scene). */
export async function linkCharacter(
  storyId: string,
  characterId: string,
  sceneIndices: number[] | null = null,
): Promise<CastMemberDTO[]> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "characters") {
    throw new ApiJobError("casting_locked", "The cast can only be edited at the Characters step.", { status: 409 });
  }
  const cast = await loadCast(db, storyId);
  if (cast.length >= MAX_CAST && !cast.some((c) => c.characterId === characterId)) {
    throw new ApiJobError("cast_limit", `A story can have at most ${MAX_CAST} characters.`, { status: 409 });
  }
  await linkCharacterRow(db, storyId, characterId, sceneIndices);
  return listStoryCharacters(storyId);
}

/** Remove a character from the story's cast. */
export async function unlinkCharacter(storyId: string, characterId: string): Promise<CastMemberDTO[]> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "characters") {
    throw new ApiJobError("casting_locked", "The cast can only be edited at the Characters step.", { status: 409 });
  }
  if (db) {
    await db
      .prepare("DELETE FROM story_characters WHERE story_id = ? AND character_id = ?")
      .bind(storyId, characterId)
      .run();
  }
  return listStoryCharacters(storyId);
}

/**
 * Lot C — the AI proposes 1–3 characters deduced from the script. They are
 * created in the reusable Character Library and linked to this story. The
 * protagonist (first proposal) inherits the user's selfie as its reference
 * photo, so the story stays centred on the user's face.
 */
export async function proposeCharacters(storyId: string): Promise<CastMemberDTO[]> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "characters") {
    throw new ApiJobError("casting_locked", "The cast can only be proposed at the Characters step.", { status: 409 });
  }
  const existing = await loadCast(db, storyId);
  if (existing.length > 0) {
    throw new ApiJobError("cast_not_empty", "The story already has a cast. Remove members to propose a new one.", { status: 409 });
  }

  const llm = createLlmClient({ baseUrl: "https://fnf.internal/llm" });
  const [model] = await llm.listModels();
  if (!model) throw new ApiJobError("llm_unavailable", "No script-writing model is currently available.");

  const system = [
    "You are the casting director for CineStory, an AI cinematic short-video studio.",
    "From the story's script, deduce the characters who appear on screen: 1 to 3 characters maximum.",
    "The FIRST character is the protagonist (the person the story follows); if the story is first-person (myself/me), name them after the story's subject.",
    "Respond with ONLY strict JSON, no markdown fences:",
    '[{"name": string, "role": string, "biography": string, "appearance": string, "personality": string, "clothing": string}]',
    "appearance: concrete physical description (age, build, hair, skin, face). clothing: what they wear. biography: one short paragraph.",
  ].join("\n");

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: `Idea: ${story.idea}\n\nScript: ${story.script_json ?? ""}` },
  ];
  // The casting director answers with a top-level ARRAY; extractJsonArray also
  // accepts a single-array wrapper ({"characters": [...]}).
  const items = await completeJsonWithRetry(
    (extra) =>
      llm
        .complete({ model, messages: extra ? [...messages, { role: "user", content: extra }] : messages })
        .then((res) => String(res.content ?? "")),
    (text) => {
      const parsed = extractJsonArray(text);
      return hasItems(parsed) ? parsed : null;
    },
  );
  const proposals = (items ?? []).slice(0, MAX_CAST) as Array<Record<string, unknown>>;
  if (proposals.length === 0) {
    throw new ApiJobError("cast_invalid", "The casting director returned no characters.", { status: 502 });
  }

  const selfie: StoredRef | null = story.selfie_ref ? (JSON.parse(story.selfie_ref) as StoredRef) : null;

  const created: CastMemberDTO[] = [];
  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    const { createCharacter } = await import("./services/characters");
    const character = await createCharacter({
      name: String(p.name ?? `Character ${i + 1}`),
      role: String(p.role ?? (i === 0 ? "Protagonist" : "")),
      biography: String(p.biography ?? ""),
      appearance: String(p.appearance ?? ""),
      personality: String(p.personality ?? ""),
      clothing: String(p.clothing ?? ""),
      // The protagonist inherits the user's selfie for scene-to-scene consistency.
      referenceImages: i === 0 && selfie ? [{ ref: selfie.ref, src: selfie.src }] : [],
    });
    await linkCharacterRow(db, storyId, character.id, null);
    created.push({
      characterId: character.id,
      name: character.name,
      role: character.role,
      biography: character.biography,
      appearance: character.appearance,
      personality: character.personality,
      clothing: character.clothing,
      portraitUrl: character.referenceImages[0]?.src ?? null,
      hasReference: character.referenceImages.length > 0,
      portraitJobId: character.portraitJobId,
      sceneIndices: null,
    });
  }
  await updateStory(db, storyId, { progress_label: "Cast proposed — add photos or generate portraits." });
  return created;
}

/**
 * Lot C — generate a portrait for one cast member from their appearance
 * (1.5 credits). The provider job runs async; pollCharacterPortraits (called on
 * every story read) stores the finished portrait as the member's reference.
 */
export async function generateCharacterPortrait(storyId: string, characterId: string): Promise<CastMemberDTO[]> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "characters") {
    throw new ApiJobError("casting_locked", "The cast can only be edited at the Characters step.", { status: 409 });
  }
  const cast = await loadCast(db, storyId);
  const member = cast.find((c) => c.characterId === characterId);
  if (!member) throw new ApiJobError("not_in_cast", "This character is not in the story's cast.", { status: 404 });
  // Phase 1: a portrait job already in flight must not be launched twice.
  if (member.portraitJobId) return listStoryCharacters(storyId);

  const appearance =
    [member.appearance.trim(), member.clothing.trim() ? `wearing ${member.clothing.trim()}` : ""]
      .filter(Boolean)
      .join(", ") || "a distinctive cinematic character";
  const instruction = `Photoreal 3:4 cinematic character portrait of ${member.name}: ${appearance}. ${member.personality ? `Personality: ${member.personality}. ` : ""}Studio lighting, shallow depth of field, neutral background, face clearly visible.`;

  // Phase 1: only the request that wins the claim submits the portrait job.
  await withClaim(claimStore(db), `character:${characterId}:portrait`, async () => {
    const job = await getGenerationProvider().submitSceneImage({
      instruction,
      references: [],
      aspectRatio: "3:4",
    });
    if (db) {
      await db
        .prepare("UPDATE characters SET portrait_job_id = ? WHERE id = ?")
        .bind(job.jobId, characterId)
        .run();
    }
  });
  return listStoryCharacters(storyId);
}

/** Resolve finished portrait jobs into persistent reference images. */
async function pollCharacterPortraits(db: D1Database | null, storyId: string): Promise<void> {
  if (!db) return;
  const rows = await db
    .prepare(
      `SELECT c.id, c.appearance, c.portrait_job_id, c.reference_images
       FROM story_characters sc JOIN characters c ON c.id = sc.character_id
       WHERE sc.story_id = ? AND c.portrait_job_id IS NOT NULL`,
    )
    .bind(storyId)
    .all();
  const provider = getGenerationProvider();
  for (const row of rows.results ?? []) {
    const jobId = row.portrait_job_id as string;
    const job = await provider.getSceneJob(jobId).catch(() => null);
    if (!job) continue;
    if (job.phase === "failed") {
      await db.prepare("UPDATE characters SET portrait_job_id = NULL WHERE id = ?").bind(row.id).run();
      continue;
    }
    if (job.phase !== "completed" || !job.rawUrl) continue;
    try {
      const bytes = new Uint8Array(await (await fetch(job.rawUrl)).arrayBuffer());
      const uploaded = await provider.uploadReference({ source: bytes, filename: `portrait-${row.id}.png` });
      if (!uploaded.ref) continue;
      const current = tryParseJson<CastImage[]>((row.reference_images as string) ?? "", []);
      current.push({ ref: uploaded.ref as unknown as MediaRef, src: uploaded.url ?? "" });
      await db
        .prepare("UPDATE characters SET portrait_job_id = NULL, reference_images = ? WHERE id = ?")
        .bind(JSON.stringify(current), row.id)
        .run();
    } catch {
      // transient fetch/upload failure — leave the job id set, retry next poll
    }
  }
}

/**
 * Append one reference photo to a library character (owner-scoped).
 * Shared by the selfie fallback and the explicit "use my photo" action.
 */
async function appendCharacterReference(characterId: string, image: { ref: unknown; src: string }): Promise<void> {
  // Delegates to the single shared write path (services/characters), which the
  // reference-photo tests drive directly for both surfaces.
  const characters = await import("./services/characters");
  await characters.appendCharacterReference(characterId, image);
}

/**
 * Fix 3 — one click fills a cast member's reference from the story's own photo.
 * Free: it reuses the selfie already uploaded with the story, no new media.
 */
export async function applySelfieReference(storyId: string, characterId: string): Promise<CastMemberDTO[]> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "characters") {
    throw new ApiJobError("casting_locked", "The cast can only be edited at the Characters step.", { status: 409 });
  }
  const selfie: StoredRef | null = story.selfie_ref ? (JSON.parse(story.selfie_ref) as StoredRef) : null;
  if (!selfie?.ref) {
    throw new ApiJobError(
      "no_story_photo",
      "This story has no photo of you yet. Add a photo, pick one from the library, or generate a portrait.",
      { status: 409 },
    );
  }
  const cast = await loadCast(db, storyId);
  const member = cast.find((c) => c.characterId === characterId);
  if (!member) throw new ApiJobError("not_in_cast", "This character is not in the story's cast.", { status: 404 });

  await appendCharacterReference(characterId, { ref: selfie.ref, src: selfie.src });
  return listStoryCharacters(storyId);
}

/**
 * Lot C — the gate out of casting. VISITING this step is optional: the cast may
 * be empty, or members may still be without a photo. Rather than blocking the
 * pipeline (the old behaviour refused to advance), any member still missing a
 * reference silently inherits the story's own photo, and the story proceeds to
 * Sets. The storyboard already passes that photo to the image model as the
 * identity reference, so the film stays centred on the same face either way.
 */
export async function validateCharacters(storyId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "characters") return getStory(storyId);

  const cast = await loadCast(db, storyId);
  const selfie: StoredRef | null = story.selfie_ref ? (JSON.parse(story.selfie_ref) as StoredRef) : null;

  // Selfie fallback: fill anyone still without a reference or a portrait in
  // flight. Best-effort — a failure here must never stop the storyboard.
  if (selfie?.ref) {
    const missing = cast.filter((c) => c.referenceImages.length === 0 && !c.portraitJobId);
    for (const member of missing) {
      try {
        await appendCharacterReference(member.characterId, { ref: selfie.ref, src: selfie.src });
      } catch {
        // The scene-level selfie reference keeps identity consistent regardless.
      }
    }
  }

  await updateStory(db, storyId, {
    status: "locations",
    current_step: "locations",
    progress_label: "Set the scenes…",
  });
  return getStory(storyId);
}

/**
 * Lot D — the AI proposes one set per scene, deduced from the script and
 * matched against the preset location gallery. Stored on each scene (free /
 * proposed); the user can swap any scene to a preset, free text, photo or
 * generated set before validating.
 */
export async function proposeLocations(storyId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "locations") {
    throw new ApiJobError("locations_locked", "Sets can only be proposed at the Locations step.", { status: 409 });
  }
  const scenes = await loadScenes(db, storyId);

  const presets = STORY_LOCATIONS.map((l) => `${l.id}: ${l.title} — ${l.description}`).join("\n");
  const llm = createLlmClient({ baseUrl: "https://fnf.internal/llm" });
  const [model] = await llm.listModels();
  if (!model) throw new ApiJobError("llm_unavailable", "No script-writing model is currently available.");

  const system = [
    "You are the set designer for CineStory, an AI cinematic short-video studio.",
    "For EVERY scene of the script choose one set/location: either one of the presets below (use its exact title) or a fitting free description.",
    `Preset locations:\n${presets}`,
    "Respond with ONLY strict JSON, no markdown fences, one object per scene in script order:",
    '[{"name": string, "description": string}]',
    "name: the place (e.g. \"NYC rooftop\", \"Neo-Tokyo alley\"). description: 1-2 concrete cinematic sentences usable as a generation setting (space, light, time of day, mood).",
  ].join("\n");

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: `Idea: ${story.idea}\n\nScript: ${story.script_json ?? ""}` },
  ];
  // Same array shape as casting — and the same tolerant parser.
  const items = await completeJsonWithRetry(
    (extra) =>
      llm
        .complete({ model, messages: extra ? [...messages, { role: "user", content: extra }] : messages })
        .then((res) => String(res.content ?? "")),
    (text) => {
      const parsed = extractJsonArray(text);
      return hasItems(parsed) ? parsed : null;
    },
  );
  const proposals = (items ?? []) as Array<Record<string, unknown>>;
  if (proposals.length === 0) {
    throw new ApiJobError("locations_invalid", "The set designer returned no locations.", { status: 502 });
  }

  for (let i = 0; i < scenes.length; i++) {
    const proposal = proposals[i] ?? proposals[0];
    await updateScene(db, storyId, scenes[i].id, {
      location_name: String(proposal?.name ?? `Set ${i + 1}`).slice(0, 120),
      location_description: String(proposal?.description ?? "").slice(0, 600),
      location_source: "proposed",
    });
  }
  await updateStory(db, storyId, { progress_label: "Sets proposed — adjust any scene, then validate." });
  return getStory(storyId);
}

/** Lot D — set one scene's set: preset | free | photo (with an optional ref). */
export async function setSceneLocation(
  storyId: string,
  sceneId: string,
  input: {
    name: string;
    description: string;
    source: "preset" | "free" | "photo" | "proposed";
    ref?: { ref: MediaRef; src: string } | null;
  },
): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "locations") {
    throw new ApiJobError("locations_locked", "Sets can only be edited at the Locations step.", { status: 409 });
  }
  const scenes = await loadScenes(db, storyId);
  if (!scenes.some((s) => s.id === sceneId)) {
    throw new ApiJobError("scene_not_found", "Scene not found.", { status: 404 });
  }
  if (!input.description?.trim()) {
    throw new ApiJobError("location_missing", "Every scene needs a set description.", { status: 400 });
  }
  await updateScene(db, storyId, sceneId, {
    location_name: input.name?.trim() ? input.name.trim().slice(0, 120) : "Set",
    location_description: input.description.trim().slice(0, 600),
    location_source: input.source,
    ...(input.ref && input.ref.ref?.id
      ? { location_ref: JSON.stringify({ ref: input.ref.ref, src: input.ref.src }) }
      : {}),
  });
  return getStory(storyId);
}

/**
 * Lot D — generate a set image for one scene from its location description
 * (1.5 credits). Runs async; pollSceneLocations (called on every story read)
 * stores the finished image as the scene's location reference.
 */
export async function generateSceneLocation(storyId: string, sceneId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "locations") {
    throw new ApiJobError("locations_locked", "Sets can only be edited at the Locations step.", { status: 409 });
  }
  const scenes = await loadScenes(db, storyId);
  const scene = scenes.find((s) => s.id === sceneId);
  if (!scene) throw new ApiJobError("scene_not_found", "Scene not found.", { status: 404 });
  // Phase 1: a set-image job already in flight must not be launched twice.
  if (scene.location_job_id) return getStory(storyId);
  const description = scene.location_description ?? getLocation(story.location_id, getTemplate(story.template_id)).description;

  // Phase 1: only the request that wins the claim submits the set job.
  await withClaim(claimStore(db), `scene:${storyId}:${sceneId}:set`, async () => {
    const instruction = `Dark-free cinematic 9:16 establishing shot of the set, NO people or characters: ${description}. Consistent location for a ${getTemplate(story.template_id).title} short film.`;
    const job = await getGenerationProvider().submitSceneImage({
      instruction,
      references: [],
      aspectRatio: SCENE_ASPECT_RATIO,
    });
    await updateScene(db, storyId, sceneId, { location_job_id: job.jobId });
  });
  return getStory(storyId);
}

/** Resolve finished set-image jobs into persistent location references. */
async function pollSceneLocations(db: D1Database | null, storyId: string): Promise<void> {
  if (!db) return;
  const rows = await db
    .prepare("SELECT id, location_description, location_job_id FROM story_scenes WHERE story_id = ? AND location_job_id IS NOT NULL")
    .bind(storyId)
    .all();
  const provider = getGenerationProvider();
  for (const row of rows.results ?? []) {
    const job = await provider.getSceneJob(row.location_job_id as string).catch(() => null);
    if (!job) continue;
    if (job.phase === "failed") {
      await db.prepare("UPDATE story_scenes SET location_job_id = NULL WHERE id = ?").bind(row.id).run();
      continue;
    }
    if (job.phase !== "completed" || !job.rawUrl) continue;
    try {
      const bytes = new Uint8Array(await (await fetch(job.rawUrl)).arrayBuffer());
      const uploaded = await provider.uploadReference({ source: bytes, filename: `set-${row.id}.png` });
      if (!uploaded.ref) continue;
      await db
        .prepare("UPDATE story_scenes SET location_job_id = NULL, location_ref = ?, location_source = 'generated' WHERE id = ?")
        .bind(JSON.stringify({ ref: uploaded.ref as unknown as MediaRef, src: uploaded.url ?? "" }), row.id)
        .run();
    } catch {
      // transient fetch/upload failure — retry next poll
    }
  }
}

/**
 * Lot D — the last gate before images: every scene needs a set description,
 * then the storyboard cost is checked against the balance before the per-scene
 * images start (nothing spent if short).
 */
export async function validateLocations(storyId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "locations") return getStory(storyId);

  const scenes = await loadScenes(db, storyId);
  const missing = scenes.filter((s) => !(s.location_description ?? "").trim());
  if (missing.length > 0) {
    throw new ApiJobError(
      "locations_incomplete",
      `Every scene needs a set before filming. Missing: ${missing.map((s) => `Scene ${s.idx + 1}`).join(", ")}.`,
      { status: 409 },
    );
  }

  const imageCost = scenes.length * IMAGE_COST_CREDITS;
  const available = await getDisplayCredits();
  if (available < imageCost) {
    throw new ApiJobError(
      "insufficient_credits",
      `Not enough credits for the storyboard: ${imageCost} needed, ${Math.floor(available)} available. Add credits in Settings → Credits.`,
      { status: 402 },
    );
  }

  const template = getTemplate(story.template_id);
  const location = getLocation(story.location_id, template);
  // Phase 1: only the request that wins the claim may launch the paid image jobs.
  await withClaim(claimStore(db), `story:${storyId}:images`, async () => {
    await updateStory(db, storyId, {
      status: "storyboard",
      current_step: "storyboard",
      progress_label: "Storyboarding scene 1…",
    });
    const running = { ...story, status: "storyboard" as const };
    await Promise.all(
      scenes.map((scene) =>
        submitSceneImage(running.owner_key ?? "", db, storyId, scene, running, template, location),
      ),
    );
  });
  return getStory(storyId);
}

// ─── Lot E: audio ────────────────────────────────────────────────────────────

/** Turn a scene's native dialogue on/off. Applies at the Audio step and to future video regenerations. */
export async function setSceneDialogue(
  storyId: string,
  sceneId: string,
  enabled: boolean,
): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "audio") {
    throw new ApiJobError("audio_locked", "Dialogue toggles are available at the Audio step.", { status: 409 });
  }
  const scenes = await loadScenes(db, storyId);
  if (!scenes.some((s) => s.id === sceneId)) {
    throw new ApiJobError("scene_not_found", "Scene not found.", { status: 404 });
  }
  await updateScene(db, storyId, sceneId, { dialogue_enabled: enabled ? 1 : 0 });
  return getStory(storyId);
}

/** Select the story's music track (from the music library or a preset). */
export async function setStoryMusic(
  storyId: string,
  track: { name: string; url: string } | null,
): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "audio") {
    throw new ApiJobError("audio_locked", "Music is selected at the Audio step.", { status: 409 });
  }
  await updateStory(db, storyId, {
    music_track: track && track.url ? JSON.stringify({ name: track.name, url: track.url }) : null,
  });
  return getStory(storyId);
}

/** Attach an imported voiceover recording to the story (mixed at assembly). */
export async function setStoryVoiceover(storyId: string, url: string | null): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "audio") {
    throw new ApiJobError("audio_locked", "Voiceover is set at the Audio step.", { status: 409 });
  }
  await updateStory(db, storyId, { voiceover_url: url });
  return getStory(storyId);
}

/**
 * Lot E — validating the mix moves the story to assembly (the container
 * stitches clips, mixes music + voiceover and burns captions). No extra credit
 * cost: assembly runs in the CineStory container.
 */
export async function validateAudio(storyId: string): Promise<StoryDTO> {
  const { db, story } = await loadOwnedStory(storyId);
  if (story.status !== "audio") return getStory(storyId);
  // Phase 1: validateAudio only transitions the story; the RUN is claimed by
  // the dispatch route (markAssemblyStarted CAS) so exactly one container
  // dispatch happens per film.
  await updateStory(db, storyId, { status: "assembling", progress_label: "Cutting the final film…" });
  return getStory(storyId);
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

    // Lot C: scene references = the cast for this scene, then the user's
    // selfie (if no protagonist inherited it), then the product/logo ref.
    const cast = await loadCast(db, storyId);
    const sceneCast = castForScene(cast, scene.idx);
    const seen = new Set(sceneCast.refs.map((r) => r.id).filter(Boolean));
    const images: GenerationMediaRef[] = [...sceneCast.refs];
    if (selfie?.ref && !seen.has(selfie.ref.id)) images.push(selfie.ref as GenerationMediaRef);
    if (reference?.ref) images.push(reference.ref as GenerationMediaRef);

    const castLine = sceneCast.lines.length
      ? `Cast on screen: ${sceneCast.lines.join("; ")}. Keep every cast member's face, wardrobe and identity consistent with the reference photos.`
      : "Keep the same person's face, wardrobe and identity consistent with the reference photo.";

    // Lot D: the scene's own set overrides the template default, and a set
    // reference photo (uploaded or generated) is passed to the image model.
    const sceneLocationName = scene.location_name?.trim();
    const sceneLocationDescription = scene.location_description?.trim() || location.description;
    const sceneLocationRef = scene.location_ref
      ? (tryParseJson<StoredRef | null>(scene.location_ref, null) ?? null)
      : null;
    const locationLine = sceneLocationName
      ? `Setting (${sceneLocationName}): ${sceneLocationDescription}.`
      : `Setting: ${sceneLocationDescription}.`;
    if (sceneLocationRef?.ref?.id && !seen.has(sceneLocationRef.ref.id)) {
      images.push(sceneLocationRef.ref as GenerationMediaRef);
    }

    const instruction = [
      `Cinematic still frame for a ${template.title} short film.`,
      locationLine,
      scene.description,
      scene.camera ? `Camera: ${scene.camera}.` : "",
      castLine,
      "Photoreal, color-graded, professional cinematography.",
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

/** Max polls before a missing job is treated as permanently lost (no infinite spinner). */
const MAX_JOB_POLLS = 6;

function tryParseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/** Best-effort display-credit balance; fail-open so a wallet API change never blocks a story. */
async function getDisplayCredits(): Promise<number> {
  try {
    const profile = createServerFnf().profile;
    const credits = await profile.getCredits();
    // ProfileCredits may be a plain display number or { credits: number }.
    const value =
      typeof credits === "number"
        ? credits
        : (credits as { credits?: number } | null)?.credits;
    return typeof value === "number" && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** The generation port deliberately hides provider failure detail; give a clear contextual message. */
function jobError(_job: unknown, fallback: string): string {
  return fallback;
}

/**
 * Storyboard resolver (Lot B): polls the per-scene image jobs only. When an
 * image completes it lands on "image_ready" — the story WAITS there until the
 * user validates the storyboard; videos are never launched automatically.
 */
async function resolveStoryboard(db: D1Database | null, story: StoryRow, scenes: SceneRow[]): Promise<SceneRow[]> {
  const provider = getGenerationProvider();
  const next: SceneRow[] = [];

  for (const scene of scenes) {
    if (scene.status === "image_generating" && scene.image_job_id) {
      const job = await provider.getSceneJob(scene.image_job_id);
      if (!job) {
        const retries = (scene.retry_count ?? 0) + 1;
        await db?.prepare("UPDATE story_scenes SET retry_count=? WHERE id=? AND story_id=?")
          .bind(retries, scene.id, story.id)
          .run();
        if (retries >= MAX_JOB_POLLS) {
          const exact = "Image job not found (it was removed or expired). Regenerate this scene.";
          await updateScene(db, story.id, scene.id, { status: "failed", error: exact });
          next.push({ ...scene, status: "failed", error: exact });
        } else {
          next.push(scene);
        }
        continue;
      }
      if (job.phase === "completed") {
        const imageUrl = job.rawUrl ?? "";
        await updateScene(db, story.id, scene.id, { status: "image_ready", image_url: imageUrl, retry_count: 0 });
        next.push({ ...scene, status: "image_ready", image_url: imageUrl });
      } else if (job.phase === "failed") {
        const exact = jobError(job, "Scene image failed to generate. Regenerate it.");
        await updateScene(db, story.id, scene.id, { status: "failed", error: exact });
        next.push({ ...scene, status: "failed", error: exact });
      } else {
        next.push(scene);
      }
    } else {
      next.push(scene);
    }
  }

  const ready = next.filter((s) => s.status === "image_ready").length;
  const label =
    next.every((s) => s.status === "image_ready")
      ? "Storyboard ready — review each image, then validate the storyboard."
      : `Storyboarding scene ${Math.min(ready + 1, next.length)} of ${next.length}…`;
  await updateStory(db, story.id, { progress_label: label });
  return next;
}

/**
 * Video resolver (Lot B): polls the per-scene Seedance jobs that
 * validateStoryboard launched. "image_generating" scenes (legacy stories that
 * entered generating before the storyboard gate) are still advanced best-effort.
 */
async function resolveGeneration(db: D1Database | null, story: StoryRow, scenes: SceneRow[]): Promise<SceneRow[]> {
  const provider = getGenerationProvider();
  const template = getTemplate(story.template_id);
  const location = getLocation(story.location_id, template);
  const next: SceneRow[] = [];

  for (const scene of scenes) {
    if (scene.status === "image_generating" && scene.image_job_id) {
      // Legacy: image finished after the film already moved to video.
      const job = await provider.getSceneJob(scene.image_job_id);
      if (!job) { next.push(scene); continue; }
      if (job.phase === "completed") {
        const imageUrl = job.rawUrl ?? "";
        await submitSceneVideo(db, story, scene, imageUrl, template, location);
        next.push({ ...scene, status: "video_generating", image_url: imageUrl });
      } else if (job.phase === "failed") {
        await updateScene(db, story.id, scene.id, { status: "failed", error: jobError(job, "Scene image failed to generate.") });
        next.push({ ...scene, status: "failed" });
      } else {
        next.push(scene);
      }
    } else if (scene.status === "video_generating" && scene.video_job_id) {
      const job = await provider.getSceneJob(scene.video_job_id);
      if (!job) {
        const retries = (scene.retry_count ?? 0) + 1;
        await db?.prepare("UPDATE story_scenes SET retry_count=? WHERE id=? AND story_id=?")
          .bind(retries, scene.id, story.id)
          .run();
        if (retries >= MAX_JOB_POLLS) {
          const exact = "Video job not found (it was removed or expired). Regenerate this scene.";
          await updateScene(db, story.id, scene.id, { status: "failed", error: exact });
          next.push({ ...scene, status: "failed", error: exact });
        } else {
          next.push(scene);
        }
        continue;
      }
      if (job.phase === "completed") {
        const videoUrl = job.rawUrl ?? "";
        await updateScene(db, story.id, scene.id, { status: "ready", video_url: videoUrl });
        next.push({ ...scene, status: "ready", video_url: videoUrl });
      } else if (job.phase === "failed") {
        const exact = jobError(job, "Scene video failed to generate.");
        await updateScene(db, story.id, scene.id, { status: "failed", error: exact });
        next.push({ ...scene, status: "failed", error: exact });
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
    const clipDuration = sceneDurationSeconds(story.duration_sec, story.scene_count);

    const instruction = [
      `${template.title} short film scene.`,
      `Setting: ${location.description}.`,
      scene.description,
      scene.camera ? `Camera movement: ${scene.camera}.` : "",
      // Lot E: dialogue is generated only when the scene's dialogue toggle is on.
      scene.dialogue_enabled !== 0 && scene.dialogue
        ? `The subject says: "${scene.dialogue}"`
        : "Natural ambient motion and sound, no dialogue.",
    ]
      .filter(Boolean)
      .join(" ");

    const job = await provider.submitSceneVideo({
      instruction,
      startImage: startImageRef,
      aspectRatio: SCENE_ASPECT_RATIO,
      durationSeconds: clipDuration,
    });
    // Persist the storyboard image (it used to stay invisible in the app) so
    // the scene always shows what was generated, even if the video fails.
    await updateScene(db, story.id, scene.id, {
      status: "video_generating",
      video_job_id: job.jobId,
      image_url: startImageUrl,
      retry_count: 0,
    });
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
  if (advancingStories.has(story.id)) {
    return { story, scenes };
  }
  advancingStories.add(story.id);
  try {
    // Lot C + D: resolve any generated portraits and set images on every read.
    if (story.status === "characters" || story.status === "storyboard" || story.status === "locations") {
      await pollCharacterPortraits(db, story.id);
      await pollSceneLocations(db, story.id);
    }
    if (story.status === "storyboard") {
      scenes = await resolveStoryboard(db, story, scenes);
      return { story, scenes };
    }
    if (story.status !== "generating") {
      return { story, scenes };
    }
    scenes = await resolveGeneration(db, story, scenes);
    const allReady = scenes.every((s) => s.status === "ready");
    const anyFailed = scenes.some((s) => s.status === "failed");
    if (allReady) {
      // Lot E: videos done → the Audio step (dialogue toggles, music, voiceover).
      // The user validates the mix; validateAudio then starts assembly.
      await updateStory(db, story.id, { status: "audio", current_step: "audio", progress_label: "Mix your sound…" });
      story = { ...story, status: "audio", current_step: "audio", progress_label: "Mix your sound…" };
    } else if (anyFailed && scenes.every((s) => s.status === "ready" || s.status === "failed")) {
      // Surface the precise cause instead of a generic message.
      const firstFailure = scenes.find((s) => s.status === "failed" && s.error)?.error;
      const exactError = firstFailure ?? `Scene ${(scenes.find((s) => s.status === "failed")?.idx ?? 1) + 1} could not be generated.`;
      await updateStory(db, story.id, {
        status: "failed",
        error: exactError,
        progress_label: null,
      });
      story = { ...story, status: "failed", error: exactError, progress_label: null };
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

/**
 * Phase 1 — claim the assembly run with a conditional upsert: only the request
 * whose write CHANGES the job row (from absent/stopped to 'running') may
 * dispatch the container. Concurrent triggers return false and stay silent.
 */
export async function markAssemblyStarted(storyId: string): Promise<boolean> {
  const db = await database();
  if (db) {
    const result = await db
      .prepare(
        `INSERT INTO story_assembly_jobs (id, status) VALUES (?, 'running')
         ON CONFLICT(id) DO UPDATE SET status = 'running', error = NULL
         WHERE story_assembly_jobs.status NOT IN ('running', 'done')`,
      )
      .bind(storyId)
      .run();
    if (result.meta.changes === 0) return false;
  }
  await updateStory(db, storyId, { status: "assembling", progress_label: "Cutting the final film…" });
  return true;
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
