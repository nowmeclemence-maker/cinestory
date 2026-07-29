/**
 * AI Provider abstraction layer — CineStory's plugin architecture for
 * pluggable AI backends. Every AI operation goes through this interface;
 * providers register themselves and the system routes by capability.
 *
 * To add a new provider: implement AiProvider, add it to AiProviderRegistry.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type AiCapability =
  | "text-generation"      // LLM chat / completion
  | "image-generation"     // text-to-image
  | "video-generation"     // text-to-video / image-to-video
  | "audio-generation"     // TTS / music / SFX
  | "image-to-video"
  | "voice-clone"
  | "upscale"
  | "remove-background"
  | "lipsync";

export interface AiProviderConfig {
  id: string;
  name: string;
  capabilities: AiCapability[];
  baseUrl?: string;
  apiKey?: string; // set at runtime, never serialized
  settings?: Record<string, unknown>;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionRequest {
  model: string;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AiCompletionResult {
  content: string;
  finishReason: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AiImageRequest {
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  resolution?: string;
  referenceImages?: string[];
  quality?: string;
  count?: number;
}

export interface AiVideoRequest {
  model: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  startImage?: string;
  endImage?: string;
  referenceImages?: string[];
  audioTrack?: string;
  generateAudio?: boolean;
}

export interface AiAudioRequest {
  model: string;
  text: string;
  voice?: string;
  duration?: number;
  style?: string;
}

// ─── Provider interface ──────────────────────────────────────────────────────

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AiCapability[];

  initialize(config: AiProviderConfig): Promise<void>;
  complete?(req: AiCompletionRequest): Promise<AiCompletionResult>;
  streamComplete?(req: AiCompletionRequest): Promise<ReadableStream>;
  generateImage?(req: AiImageRequest): Promise<{ urls: string[] }>;
  generateVideo?(req: AiVideoRequest): Promise<{ urls: string[]; jobIds: string[] }>;
  generateAudio?(req: AiAudioRequest): Promise<{ url: string }>;
  transcribe?(audio: Blob): Promise<{ text: string }>;
}

// ─── Registry ────────────────────────────────────────────────────────────────

class AiProviderRegistry {
  private providers = new Map<string, AiProvider>();
  private defaultProviderId: string | null = null;

  register(provider: AiProvider, makeDefault = false): void {
    this.providers.set(provider.id, provider);
    if (makeDefault || this.providers.size === 1) {
      this.defaultProviderId = provider.id;
    }
  }

  getProvider(id: string): AiProvider | undefined {
    return this.providers.get(id);
  }

  getDefault(): AiProvider | undefined {
    return this.defaultProviderId ? this.providers.get(this.defaultProviderId) : undefined;
  }

  getCapable(capability: AiCapability): AiProvider[] {
    return Array.from(this.providers.values()).filter((p) =>
      p.capabilities.includes(capability),
    );
  }

  listProviders(): AiProvider[] {
    return Array.from(this.providers.values());
  }
}

export const aiRegistry = new AiProviderRegistry();

// ─── Higgsfield provider (default) ───────────────────────────────────────────

import { createJobClient, getJobPhase, getRawUrl } from "@higgsfield/fnf/client";
import { createLlmClient } from "@higgsfield/fnf";
import { createMediaClient } from "@higgsfield/fnf/media";
import { createWorkflowPlatformAdapter } from "@higgsfield/fnf/workflow-platform";
import {
  nanoBanana2,
  seedance2_0,
  gptImage2,
  seedreamV4_5,
  kling3_0,
} from "@higgsfield/fnf/jobs";

export class HiggsfieldAiProvider implements AiProvider {
  readonly id = "higgsfield";
  readonly name = "Higgsfield";
  readonly capabilities: AiCapability[] = [
    "text-generation",
    "image-generation",
    "video-generation",
    "image-to-video",
    "upscale",
    "remove-background",
    "lipsync",
  ];

  private adapter = createWorkflowPlatformAdapter({ baseUrl: "https://fnf.internal" });
  private jobs = createJobClient({ adapter: this.adapter, jobs: [nanoBanana2, seedance2_0, gptImage2, seedreamV4_5, kling3_0] });
  private media = createMediaClient({ mediaAdapter: this.adapter });
  private llm = createLlmClient({ baseUrl: "https://fnf.internal/llm" });

  async initialize(_config: AiProviderConfig): Promise<void> {
    // Already initialized via platform auth
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const [model] = await this.llm.listModels();
    const res = await this.llm.complete({
      model: model ?? req.model,
      messages: req.messages.map((msg) => ({ role: msg.role, content: msg.content })),
    });
    return {
      content: res.content,
      finishReason: res.finishReason,
      usage: res.usage,
    };
  }

  async generateImage(req: AiImageRequest): Promise<{ urls: string[] }> {
    const result = await this.jobs.submit({
      model: "gpt_image_2",
      prompt: { instruction: req.prompt },
      settings: {
        aspectRatio: req.aspectRatio ?? "1:1",
        batchSize: req.count ?? 1,
      },
    } as never);
    const done = await this.jobs.wait(result.generations);
    return { urls: done.map((g) => getRawUrl(g) ?? "") };
  }

  async generateVideo(req: AiVideoRequest): Promise<{ urls: string[]; jobIds: string[] }> {
    const media: Record<string, unknown> = {};
    if (req.startImage) media.image = [{ id: req.startImage, type: "media_input" }];
    const result = await this.jobs.submit({
      model: "seedance_2_0",
      prompt: { instruction: req.prompt },
      media: Object.keys(media).length > 0 ? media : undefined,
      settings: {
        aspectRatio: req.aspectRatio ?? "9:16",
        duration: req.duration ?? 5,
        mode: "std",
        batchSize: 1,
      },
    } as never);
    const jobIds = result.generations.map((g) => g.id);
    return { urls: [], jobIds };
  }

  async generateAudio(_req: AiAudioRequest): Promise<{ url: string }> {
    throw new Error("Higgsfield audio generation not available via SDK");
  }

  async transcribe(_audio: Blob): Promise<{ text: string }> {
    throw new Error("Transcription not available via SDK");
  }
}

// Register the default provider
aiRegistry.register(new HiggsfieldAiProvider(), true);

// ─── Utility ─────────────────────────────────────────────────────────────────

export async function executeWithBestProvider<T>(
  capability: AiCapability,
  fn: (provider: AiProvider) => Promise<T>,
): Promise<T> {
  const provider = aiRegistry.getCapable(capability)[0] ?? aiRegistry.getDefault();
  if (!provider) throw new Error(`No AI provider available for capability: ${capability}`);
  return fn(provider);
}