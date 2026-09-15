/**
 * CineStory's generation port.
 *
 * The Story Engine talks to THIS interface and nothing else. It never names a
 * model, a batch size or a wire setting; those belong to an implementation.
 * Today there is exactly one implementation, Higgsfield/FNF, in
 * ./fnf-provider.server.ts, and it reproduces the previous inline behaviour
 * exactly.
 *
 * The vocabulary here is CineStory's: a scene needs a still, then a clip
 * animated from that still.
 */

/**
 * Opaque handle to media held by the generation provider. Structurally
 * compatible with what is already persisted in `stories.selfie_ref` /
 * `reference_ref` and returned by /api/media/upload, so nothing stored or sent
 * changes shape.
 */
export interface GenerationMediaRef {
  id: string;
  type: string;
  url?: string;
  role?: string;
}

/**
 * Frame shapes CineStory can shoot in. A product vocabulary, deliberately
 * narrower than what any one provider happens to accept. Only "9:16" is used
 * today; the rest are here so widening the product is a one-line change with
 * no cast at the provider boundary.
 */
export type SceneAspectRatio = "9:16" | "16:9" | "1:1" | "4:3" | "3:4";

/**
 * Collapsed lifecycle of one scene job. Anything neither finished nor failed is
 * "pending", which is exactly how the Story Engine already treated every
 * non-terminal provider status.
 */
export type SceneJobPhase = "pending" | "completed" | "failed";

export interface SceneImageRequest {
  /** Fully assembled prompt. Prompt writing stays in the Story Engine. */
  instruction: string;
  /** Identity and style references, in priority order. May be empty. */
  references: GenerationMediaRef[];
  aspectRatio: SceneAspectRatio;
}

export interface SceneVideoRequest {
  instruction: string;
  /** First frame of the clip, already put through uploadReference(). */
  startImage: GenerationMediaRef;
  aspectRatio: SceneAspectRatio;
  durationSeconds: number;
}

export interface SubmittedSceneJob {
  /** Which provider owns `jobId`. Persisted per scene in a later phase. */
  provider: string;
  jobId: string;
}

export interface SceneJob {
  jobId: string;
  phase: SceneJobPhase;
  /** Playable URL once `phase` is "completed", otherwise null. */
  rawUrl: string | null;
}

export interface ReferenceUpload {
  source: Uint8Array;
  filename: string;
  contentType?: string;
}

export interface UploadedReference {
  ref: GenerationMediaRef;
  url: string | null;
}

export type SceneCostRequest =
  | { kind: "image"; request: SceneImageRequest }
  | { kind: "video"; request: SceneVideoRequest };

export interface GenerationProvider {
  readonly id: string;

  /** Submit the still for one scene. */
  submitSceneImage: (request: SceneImageRequest) => Promise<SubmittedSceneJob>;

  /** Submit the clip for one scene, animated from its still. */
  submitSceneVideo: (request: SceneVideoRequest) => Promise<SubmittedSceneJob>;

  /**
   * Read one scene job. Returns null when the provider could not be reached,
   * which the Story Engine treats as "try again on the next poll".
   */
  getSceneJob: (jobId: string) => Promise<SceneJob | null>;

  /** Put bytes into the provider's media store and get a usable reference. */
  uploadReference: (upload: ReferenceUpload) => Promise<UploadedReference>;

  /**
   * Price one scene job in provider credits. Nothing calls this yet: credits
   * are deliberately untouched in this phase.
   */
  estimateSceneCost: (request: SceneCostRequest) => Promise<number | null>;
}
