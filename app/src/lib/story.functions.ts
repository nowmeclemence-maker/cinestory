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
  setSceneDialogue,
  setSceneLocation,
  setStoryMusic,
  setStoryVoiceover,
  unlinkCharacter,
  updateScript,
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

/** Append one reference photo to a character (from an app upload). */
export const addCharacterImageFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      characterId: z.string().min(1),
      ref: z.any(),
      src: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { getCharacter, updateCharacter } = await import("./services/characters");
    const character = await getCharacter(data.characterId);
    const images = [...character.referenceImages, { ref: data.ref, src: data.src }];
    return updateCharacter(data.characterId, { referenceImages: images });
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
