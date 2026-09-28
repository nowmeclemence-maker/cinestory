/**
 * ─── CineStory retail pricing (single source of truth) ──────────────────────
 *
 * Everything the customer is ever quoted — the landing page, /pricing,
 * /billing, /credits, and the per-step cost shown in the Studio — is derived
 * from the constants in this file. Nothing downstream hardcodes a price.
 *
 * The model is PREPAID CREDITS, not a monthly allowance. A subscription that
 * bundles N credits per month loses money on every heavy user, because the
 * supplier bill scales with usage while the revenue does not. Prepaid credits
 * make the two move together.
 *
 * ── How a price is built ──
 *   supplier cost (USD)  ×  RETAIL_MARKUP  ÷  USD_PER_CREDIT  =  credits
 * The markup has to cover more than the generation itself: Stripe (2.9% + 30¢),
 * R2 storage and egress for mirrored media, the LLM calls that write the
 * script, failed generations that are retried, and support.
 *
 * ── Where the supplier numbers come from ──
 * Higgsfield bills the API in its own credits. Two independently published
 * anchors fix the conversion:
 *   · docs.higgsfield.ai/docs/concepts/billing-and-retention — a 1.5-credit
 *     portrait estimate quoted at $0.094  →  $0.0627 per Higgsfield credit.
 *   · higgsfield.ai/blog — per-second USD rates per video model.
 * Kling 3.0 is corroborated by a second source at ~$0.11–0.12/s.
 *
 * ⚠️  VERIFY BEFORE CHARGING ANYONE. Published rates move and promotional
 * rates expire. The authority is the /estimate endpoint on the live API key:
 * run `bun run scripts/verify-supplier-rates.ts` and reconcile any drift here.
 * Never price against a promotional rate — the discount ends, the price stays.
 */

/** USD Higgsfield charges per one of its own API credits. */
export const USD_PER_HF_CREDIT = 0.0627;

/**
 * Gross markup over supplier cost. 2.0 leaves roughly 50% before Stripe fees,
 * storage, egress, script-writing LLM calls, retries, and support.
 */
export const RETAIL_MARKUP = 2.0;

/** What one CineStory credit costs the customer at list price. */
export const USD_PER_CREDIT = 0.1;

/** Credits granted once to a new account, so the first film costs nothing. */
export const SIGNUP_CREDIT_GRANT = 20;

/** Supplier cost of one storyboard image, portrait or set (1.5 HF credits). */
export const IMAGE_SUPPLIER_USD = 1.5 * USD_PER_HF_CREDIT;

export type EngineTier = "budget" | "standard" | "premium";

export interface VideoEngine {
  readonly id: string;
  readonly name: string;
  /** Supplier cost per second of finished clip, in USD. */
  readonly supplierUsdPerSecond: number;
  readonly tier: EngineTier;
  /** One line the customer reads when choosing. */
  readonly blurb: string;
}

/**
 * The engines a customer may pick per clip. Ordered cheapest first, which is
 * also the order they are offered in: the default should be the one that makes
 * a good film at the lowest cost, not the most expensive one available.
 */
export const VIDEO_ENGINES: readonly VideoEngine[] = [
  {
    id: "kling2_5",
    name: "Kling 2.5",
    supplierUsdPerSecond: 0.042,
    tier: "budget",
    blurb: "Fast and inexpensive. Best for drafts and rough cuts.",
  },
  {
    id: "seedance_2_5",
    name: "Seedance 2.5",
    supplierUsdPerSecond: 0.0738,
    tier: "budget",
    blurb: "Strong motion with native audio, at a draft-tier price.",
  },
  {
    id: "kling3_0",
    name: "Kling 3.0",
    supplierUsdPerSecond: 0.112,
    tier: "standard",
    blurb: "Multi-shot with synced audio. The best quality per credit.",
  },
  {
    id: "minimax_h3",
    name: "MiniMax H3",
    supplierUsdPerSecond: 0.13,
    tier: "standard",
    blurb: "2K output and reference-driven identity.",
  },
  {
    id: "seedance_2_0",
    name: "Seedance 2.0",
    supplierUsdPerSecond: 4.5 * USD_PER_HF_CREDIT,
    tier: "premium",
    blurb: "Highest identity consistency across scenes. The most expensive.",
  },
] as const;

/** The engine used when the customer expresses no preference. */
export const DEFAULT_VIDEO_ENGINE_ID = "kling3_0";

export function findEngine(id: string): VideoEngine | undefined {
  return VIDEO_ENGINES.find((engine) => engine.id === id);
}

export function defaultEngine(): VideoEngine {
  const engine = findEngine(DEFAULT_VIDEO_ENGINE_ID);
  // The id is a literal from the list above, so this is unreachable in practice.
  if (!engine) throw new Error(`Unknown default engine: ${DEFAULT_VIDEO_ENGINE_ID}`);
  return engine;
}

/**
 * Retail credits for a supplier cost. Rounded up so a rounding error can never
 * be charged to CineStory, and computed on the WHOLE job rather than per
 * second — rounding each second up would overcharge a long clip.
 */
export function creditsForSupplierUsd(supplierUsd: number): number {
  return Math.ceil((supplierUsd * RETAIL_MARKUP) / USD_PER_CREDIT);
}

/** Retail credits for one storyboard image, character portrait or set. */
export function imageCredits(): number {
  return creditsForSupplierUsd(IMAGE_SUPPLIER_USD);
}

/** Retail credits for one clip of `seconds` on `engine`. */
export function clipCredits(engine: VideoEngine, seconds: number): number {
  return creditsForSupplierUsd(engine.supplierUsdPerSecond * seconds);
}

export function creditsToUsd(credits: number): number {
  return credits * USD_PER_CREDIT;
}

export interface FilmEstimate {
  readonly credits: number;
  readonly usd: number;
  readonly supplierUsd: number;
}

/**
 * What a whole film costs: one image per scene plus one clip per scene.
 * The landing page and the Studio both quote from this, so the number a
 * customer sees before signing up is the number they are charged after.
 */
export function estimateFilm(
  scenes: number,
  secondsPerScene: number,
  engine: VideoEngine = defaultEngine(),
): FilmEstimate {
  const credits = scenes * (imageCredits() + clipCredits(engine, secondsPerScene));
  const supplierUsd = scenes * (IMAGE_SUPPLIER_USD + engine.supplierUsdPerSecond * secondsPerScene);
  return { credits, usd: creditsToUsd(credits), supplierUsd };
}

export interface CreditPack {
  readonly id: string;
  readonly name: string;
  readonly usd: number;
  /** Credits delivered, including any volume bonus. */
  readonly credits: number;
  readonly description: string;
  readonly highlight: boolean;
}

/**
 * Prepaid packs. Larger packs carry a bonus, which lowers the effective price
 * per credit — so the markup shrinks with volume and must stay above 1.0.
 * `packMarkup` below is what the tests assert.
 */
export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    usd: 9,
    credits: 100,
    description: "Enough for a first short film with a few retakes.",
    highlight: false,
  },
  {
    id: "creator",
    name: "Creator",
    usd: 29,
    credits: 350,
    description: "For creators publishing every week. 8% bonus credits.",
    highlight: true,
  },
  {
    id: "studio",
    name: "Studio",
    usd: 79,
    credits: 1000,
    description: "Series work and client volume. 12% bonus credits.",
    highlight: false,
  },
] as const;

/** Effective USD a customer pays per credit in a pack, after the bonus. */
export function packUsdPerCredit(pack: CreditPack): number {
  return pack.usd / pack.credits;
}

/**
 * Gross markup actually realised on a pack, once its bonus is accounted for.
 * Must stay comfortably above 1.0 or the pack sells credits below cost.
 */
export function packMarkup(pack: CreditPack): number {
  return (packUsdPerCredit(pack) / USD_PER_CREDIT) * RETAIL_MARKUP;
}
