import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createStory, getStory, listStories } from "./story-engine.server";

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
