import type { GenerationProvider } from "./port";
import { createFnfGenerationProvider } from "./fnf-provider.server";

/**
 * Resolves CineStory's generation provider. Higgsfield/FNF is the only one, and
 * this function is the single seam where that could ever change.
 */
let provider: GenerationProvider | null = null;

export function getGenerationProvider(): GenerationProvider {
  provider ??= createFnfGenerationProvider();
  return provider;
}
