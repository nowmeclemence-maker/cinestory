import { createJobClient, getJobPhase, getRawUrl } from "@higgsfield/fnf/client";
import type { JobClient, JobPhase, SubmitInputFor } from "@higgsfield/fnf/client";
import { nanoBanana2, seedance2_0 } from "@higgsfield/fnf/jobs";
import { createServerFnf } from "../fnf.server";
import type {
  GenerationProvider,
  ReferenceUpload,
  SceneCostRequest,
  SceneImageRequest,
  SceneJob,
  SceneJobPhase,
  SceneVideoRequest,
  SubmittedSceneJob,
  UploadedReference,
} from "./port";

/**
 * Higgsfield/FNF implementation of the generation port. This is the ONLY place
 * in CineStory that knows a model name or a wire setting. Every value below was
 * previously inline in story-engine.server.ts and is reproduced unchanged.
 */

/** Stored next to a job id so a later provider can be told apart. */
export const FNF_PROVIDER_ID = "fnf";

const IMAGE_MODEL = "nano_banana_2";
const VIDEO_MODEL = "seedance_2_0";
const IMAGE_BATCH_SIZE = 1;
const VIDEO_BATCH_SIZE = 1;
const VIDEO_MODE = "std";

const STORY_JOBS = [nanoBanana2, seedance2_0] as const;
type StoryJobInput = SubmitInputFor<typeof STORY_JOBS>;

// Built on first use rather than at module load, so importing this file never
// touches the platform adapter.
let client: JobClient<typeof STORY_JOBS> | null = null;
function jobs(): JobClient<typeof STORY_JOBS> {
  client ??= createJobClient({ adapter: createServerFnf().adapter, jobs: STORY_JOBS });
  return client;
}

function imageInput(request: SceneImageRequest): StoryJobInput {
  if (request.references.length > 0) {
    return {
      model: IMAGE_MODEL,
      prompt: { instruction: request.instruction },
      media: { image: request.references },
      settings: { aspectRatio: request.aspectRatio, batchSize: IMAGE_BATCH_SIZE },
    };
  }
  return {
    model: IMAGE_MODEL,
    prompt: { instruction: request.instruction },
    settings: { aspectRatio: request.aspectRatio, batchSize: IMAGE_BATCH_SIZE },
  };
}

function videoInput(request: SceneVideoRequest): StoryJobInput {
  return {
    model: VIDEO_MODEL,
    prompt: { instruction: request.instruction },
    media: { image: [request.startImage] },
    settings: {
      mode: VIDEO_MODE,
      duration: request.durationSeconds,
      aspectRatio: request.aspectRatio,
      batchSize: VIDEO_BATCH_SIZE,
    },
  };
}

function toScenePhase(phase: JobPhase): SceneJobPhase {
  if (phase === "completed") return "completed";
  if (phase === "failed") return "failed";
  return "pending";
}

async function submitSceneImage(request: SceneImageRequest): Promise<SubmittedSceneJob> {
  const result = await jobs().submit(imageInput(request));
  const generation = result.generations[0];
  return { provider: FNF_PROVIDER_ID, jobId: generation.id };
}

async function submitSceneVideo(request: SceneVideoRequest): Promise<SubmittedSceneJob> {
  const result = await jobs().submit(videoInput(request));
  const generation = result.generations[0];
  return { provider: FNF_PROVIDER_ID, jobId: generation.id };
}

async function getSceneJob(jobId: string): Promise<SceneJob | null> {
  // The swallowed error is the previous behaviour: an unreachable provider
  // leaves the scene untouched so the next poll retries it.
  const generation = await jobs()
    .get(jobId)
    .catch(() => null);
  if (!generation) return null;
  return {
    jobId,
    phase: toScenePhase(getJobPhase(generation)),
    rawUrl: getRawUrl(generation) ?? null,
  };
}

async function uploadReference(upload: ReferenceUpload): Promise<UploadedReference> {
  const result = await createServerFnf().media.upload({
    source: upload.source,
    filename: upload.filename,
    type: "image",
    forceIpCheck: true,
    ...(upload.contentType !== undefined ? { contentType: upload.contentType } : {}),
  });
  return { ref: result.ref, url: result.url ?? result.ref.url ?? null };
}

async function estimateSceneCost(request: SceneCostRequest): Promise<number | null> {
  const input = request.kind === "image" ? imageInput(request.request) : videoInput(request.request);
  const estimate = await jobs().cost(input);
  return estimate.credits;
}

export function createFnfGenerationProvider(): GenerationProvider {
  return {
    id: FNF_PROVIDER_ID,
    submitSceneImage,
    submitSceneVideo,
    getSceneJob,
    uploadReference,
    estimateSceneCost,
  };
}
