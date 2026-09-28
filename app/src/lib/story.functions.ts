import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createStory,
  generateCharacterPortrait,
  generateSceneLocation,
  getStory,
  linkCharacter,
  listStories,
  listStoryCharacters,
  proposeCharacters,
  proposeLocations,
  regenerateSceneImage,
  regenerateScript,
  remasterStory,
  setSceneDialogue,
  setSceneLocation,
  setStoryMusic,
  setStoryVoiceover,
  unlinkCharacter,
  updateScript,
  applySelfieReference,
  acceptFinalCut,
  approveClipsAndContinue,
  regenerateSceneVideo,
  setSceneVideoApproval,
  updateSceneDescription,
  validateAudio,
  validateCharacters,
  validateLocations,
  validateScript,
  validateStoryboard,
} from "./story-engine.server";

const storedRefSchema = z
  .object({ ref: z.any(), src: z.string() })
  .optional();

export const createStoryFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      idea: z.string().trim().min(1).max(2000),
      templateId: z.string().min(1),
      locationId: z.string().min(1),
      durationSec: z.number().int().positive().max(300),
      projectId: z.string().optional(),
      selfieRef: storedRefSchema,
      referenceRef: storedRefSchema,
    }),
  )
  .handler(({ data }) =>
    createStory({
      idea: data.idea,
      templateId: data.templateId,
      locationId: data.locationId,
      durationSec: data.durationSec,
      projectId: data.projectId,
      selfieRef: data.selfieRef as never,
      referenceRef: data.referenceRef as never,
    }),
  );

export const getStoryFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => getStory(data.storyId));

export const listStoriesFn = createServerFn({ method: "POST" })
  .validator(z.object({ projectId: z.string().optional() }))
  .handler(({ data }) => listStories(data.projectId));

const sceneEditSchema = z.object({
  /** Existing scene row this edit targets; omitted for a newly added scene. */
  id: z.string().optional(),
  idx: z.number().int().nonnegative(),
  description: z.string(),
  camera: z.string(),
  dialogue: z.string(),
  onScreenText: z.string(),
});

export const updateScriptFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      storyId: z.string().min(1),
      title: z.string().trim().max(120),
      hook: z.string().max(500),
      cta: z.string().max(240).optional(),
      scenes: z.array(sceneEditSchema).min(1),
    }),
  )
  .handler(({ data }) =>
    updateScript(data.storyId, {
      title: data.title,
      hook: data.hook,
      cta: data.cta,
      scenes: data.scenes,
    }),
  );

export const regenerateScriptFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => regenerateScript(data.storyId));

export const validateScriptFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => validateScript(data.storyId));

export const validateStoryboardFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => validateStoryboard(data.storyId));

export const regenerateSceneImageFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), sceneId: z.string().min(1) }))
  .handler(({ data }) => regenerateSceneImage(data.storyId, data.sceneId));

// ─── Lot C: casting ──────────────────────────────────────────────────────────

export const listStoryCharactersFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => listStoryCharacters(data.storyId));

export const proposeCharactersFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => proposeCharacters(data.storyId));

export const linkCharacterFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      storyId: z.string().min(1),
      characterId: z.string().min(1),
      sceneIndices: z.array(z.number().int().nonnegative()).nullable().optional(),
    }),
  )
  .handler(({ data }) => linkCharacter(data.storyId, data.characterId, data.sceneIndices ?? null));

export const unlinkCharacterFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), characterId: z.string().min(1) }))
  .handler(({ data }) => unlinkCharacter(data.storyId, data.characterId));

export const generateCharacterPortraitFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), characterId: z.string().min(1) }))
  .handler(({ data }) => generateCharacterPortrait(data.storyId, data.characterId));

export const validateCharactersFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => validateCharacters(data.storyId));

/** Fill one cast member's reference photo from the story's own photo (free). */
export const applySelfieReferenceFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), characterId: z.string().min(1) }))
  .handler(({ data }) => applySelfieReference(data.storyId, data.characterId));

/** Edit a character sheet (appearance etc.) from the cast screen (owner-scoped). */
export const updateCharacterSheetFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      characterId: z.string().min(1),
      data: z.record(z.string(), z.any()),
    }),
  )
  .handler(async ({ data }) => {
    const { updateCharacter } = await import("./services/characters");
    return updateCharacter(data.characterId, data.data);
  });

/** Append (or replace) a character's reference photo from an upload or library pick. */
export const addCharacterImageFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      characterId: z.string().min(1),
      ref: z.any(),
      src: z.string(),
      /** "Replace photo" semantics: the picked photo becomes THE reference. */
      replace: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { appendCharacterReference } = await import("./services/characters");
    return appendCharacterReference(data.characterId, { ref: data.ref, src: data.src }, { replace: data.replace });
  });

/** The user's Character Library (server-side only — never bunded to the client). */
export const listLibraryCharactersFn = createServerFn({ method: "POST" }).handler(async () => {
  const { listCharacters } = await import("./services/characters");
  return listCharacters();
});

// ─── Lot D: per-scene sets/locations ─────────────────────────────────────────

export const proposeLocationsFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => proposeLocations(data.storyId));

export const setSceneLocationFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      storyId: z.string().min(1),
      sceneId: z.string().min(1),
      name: z.string().max(120),
      description: z.string().max(600),
      source: z.enum(["preset", "free", "photo", "proposed"]),
      ref: z.object({ ref: z.any(), src: z.string() }).nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    setSceneLocation(data.storyId, data.sceneId, {
      name: data.name,
      description: data.description,
      source: data.source,
      ref: data.ref ?? undefined,
    }),
  );

export const generateSceneLocationFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), sceneId: z.string().min(1) }))
  .handler(({ data }) => generateSceneLocation(data.storyId, data.sceneId));

export const validateLocationsFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => validateLocations(data.storyId));

// ─── Lot E: audio ────────────────────────────────────────────────────────────

export const setSceneDialogueFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), sceneId: z.string().min(1), enabled: z.boolean() }))
  .handler(({ data }) => setSceneDialogue(data.storyId, data.sceneId, data.enabled));

export const setStoryMusicFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      storyId: z.string().min(1),
      track: z.object({ name: z.string().max(120), url: z.string().url() }).nullable(),
    }),
  )
  .handler(({ data }) => setStoryMusic(data.storyId, data.track));

export const setStoryVoiceoverFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), url: z.string().url().nullable() }))
  .handler(({ data }) => setStoryVoiceover(data.storyId, data.url));

export const validateAudioFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => validateAudio(data.storyId));

// ─── Clip review gate (Video step) ───────────────────────────────────────────

/** Approve (or withdraw approval from) one clip. */
export const setSceneVideoApprovalFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), sceneId: z.string().min(1), approved: z.boolean() }))
  .handler(({ data }) => setSceneVideoApproval(data.storyId, data.sceneId, data.approved));

/** THE GATE into Audio: every clip must have been reviewed. */
export const approveClipsAndContinueFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => approveClipsAndContinue(data.storyId));

/** Edit one scene's description (video review → fix the scene first). */
export const updateSceneDescriptionFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), sceneId: z.string().min(1), description: z.string().max(2000) }))
  .handler(({ data }) => updateSceneDescription(data.storyId, data.sceneId, data.description));

/** Re-record one clip (the review screen's "Redo"). */
export const regenerateSceneVideoFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1), sceneId: z.string().min(1) }))
  .handler(({ data }) => regenerateSceneVideo(data.storyId, data.sceneId));

/** Accept the finished film at the Final cut review. */
export const acceptFinalCutFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => acceptFinalCut(data.storyId));

export const remasterStoryFn = createServerFn({ method: "POST" })
  .validator(z.object({ storyId: z.string().min(1) }))
  .handler(({ data }) => remasterStory(data.storyId));

export const listMusicTracksFn = createServerFn({ method: "POST" }).handler(async () => {
  const { listMusicTracks } = await import("./services/music");
  return listMusicTracks();
});

export const createMusicTrackFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1).max(120),
      url: z.string().url(),
      genre: z.string().max(60).optional(),
      mood: z.string().max(120).optional(),
      durationSec: z.number().int().nonnegative().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { createMusicTrack } = await import("./services/music");
    return createMusicTrack(data);
  });

export const deleteMusicTrackFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { deleteMusicTrack } = await import("./services/music");
    return deleteMusicTrack(data.id);
  });

// ─── Lot F: series ───────────────────────────────────────────────────────────

export const listSeriesFn = createServerFn({ method: "POST" }).handler(async () => {
  const { listSeries } = await import("./series-engine.server");
  return listSeries();
});

export const getSeriesFn = createServerFn({ method: "POST" })
  .validator(z.object({ seriesId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { getSeries } = await import("./series-engine.server");
    return getSeries(data.seriesId);
  });

export const createSeriesFn = createServerFn({ method: "POST" })
  .validator(z.object({ title: z.string().trim().min(1).max(120), manuscript: z.string().min(50).max(60000) }))
  .handler(async ({ data }) => {
    const { createSeries } = await import("./series-engine.server");
    return createSeries(data.title, data.manuscript);
  });

export const startEpisodeFn = createServerFn({ method: "POST" })
  .validator(z.object({ seriesId: z.string().min(1), idx: z.number().int().nonnegative() }))
  .handler(async ({ data }) => {
    const { startEpisode } = await import("./series-engine.server");
    return startEpisode(data.seriesId, data.idx);
  });

export const deleteSeriesFn = createServerFn({ method: "POST" })
  .validator(z.object({ seriesId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { deleteSeries } = await import("./series-engine.server");
    return deleteSeries(data.seriesId);
  });

// ─── Subscriptions / pricing ─────────────────────────────────────────────────

export const getSubscriptionFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getSubscription } = await import("./services/credits");
  return getSubscription();
});

export const selectPlanFn = createServerFn({ method: "POST" })
  .validator(z.object({ planId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { selectPlan } = await import("./services/credits");
    return selectPlan(data.planId);
  });
