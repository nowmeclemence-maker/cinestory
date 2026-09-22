import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createStory,
  getStory,
  listStories,
  regenerateSceneImage,
  regenerateScript,
  updateScript,
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
