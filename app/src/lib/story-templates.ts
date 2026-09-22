/**
 * CineStory's storytelling catalog: the story "genres" (templates) and
 * cinematic locations the user picks from, plus the duration ladder. This is
 * pure data + prompt-building — no fnf/D1 imports — so it's safe to import
 * from both server and browser code.
 */

export type StoryTemplateGroup = "story" | "ad" | "drama" | "real";

export interface StoryTemplate {
  id: string;
  title: string;
  subtitle: string;
  group: StoryTemplateGroup;
  /** Creative-director guidance folded into the script system prompt. */
  directive: string;
  /** Default location id suggested by this template (user can override). */
  defaultLocationId: string;
}

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: "storytime",
    title: "Storytime",
    subtitle: "Personal storytelling, straight to camera",
    group: "story",
    directive:
      "An intimate, first-person storytime confession. Warm, conversational, vulnerable. The hook admits something surprising in the first line.",
    defaultLocationId: "coffee-shop",
  },
  {
    id: "ugc-ad",
    title: "UGC Ad",
    subtitle: "Authentic creator content",
    group: "ad",
    directive:
      "Handheld, authentic creator-style UGC ad. Casual energy, direct address to camera, a real problem solved by the product, no polish.",
    defaultLocationId: "office",
  },
  {
    id: "product-commercial",
    title: "Product Commercial",
    subtitle: "Professional advertising",
    group: "ad",
    directive:
      "A polished, professional product commercial. Hero shots of the product/subject, confident voiceover, premium pacing.",
    defaultLocationId: "studio",
  },
  {
    id: "luxury-lifestyle",
    title: "Luxury Brand",
    subtitle: "Premium cinematic lifestyle",
    group: "ad",
    directive:
      "Opulent, slow-motion luxury lifestyle film. Glossy lighting, expensive textures, restrained voiceover, aspirational tone.",
    defaultLocationId: "private-jet",
  },
  {
    id: "micro-drama",
    title: "Micro Drama",
    subtitle: "Short emotional films",
    group: "drama",
    directive:
      "A tight emotional micro-drama with a clear turn: setup, rising tension, a twist or release in the final beat.",
    defaultLocationId: "restaurant",
  },
  {
    id: "motivational",
    title: "Motivational",
    subtitle: "Personal growth",
    group: "story",
    directive:
      "High-energy motivational speech over cinematic visuals. Short punchy lines, a rising crescendo, an empowering final beat.",
    defaultLocationId: "gym",
  },
  {
    id: "life-lesson",
    title: "Life Lesson",
    subtitle: "Lessons learned",
    group: "story",
    directive:
      "A reflective story about a hard-won lesson. Begins with the mistake, ends with the wisdom gained.",
    defaultLocationId: "african-village",
  },
  {
    id: "entrepreneur-journey",
    title: "Entrepreneur Journey",
    subtitle: "Business storytelling",
    group: "real",
    directive:
      "The founder's journey: the leap, the grind, the breakthrough. Confident, real, a little raw.",
    defaultLocationId: "new-york-rooftop",
  },
  {
    id: "movie-trailer",
    title: "Movie Trailer",
    subtitle: "Hollywood style trailer",
    group: "drama",
    directive:
      "A Hollywood-trailer cut: booming, portentous narration, dramatic stakes, a title-card CTA feel at the end.",
    defaultLocationId: "new-york-rooftop",
  },
  {
    id: "fashion-campaign",
    title: "Fashion Campaign",
    subtitle: "Luxury fashion film",
    group: "ad",
    directive:
      "High-fashion campaign film: editorial poses, bold color grade, confident minimal voiceover or none at all.",
    defaultLocationId: "paris",
  },
  {
    id: "future-me",
    title: "Future Me",
    subtitle: "My life after achieving my goal",
    group: "story",
    directive:
      "Show the subject living their achieved future self: the life, the confidence, the proof it worked. Reflective, second-person-to-self narration.",
    defaultLocationId: "luxury-hotel",
  },
  {
    id: "before-vs-after",
    title: "Before vs After",
    subtitle: "Transformation stories",
    group: "story",
    directive:
      "A clear before/after transformation arc: the struggle, the turning point, the visible change.",
    defaultLocationId: "gym",
  },
];

export interface StoryLocation {
  id: string;
  title: string;
  /** Visual/atmospheric description folded into every scene prompt. */
  description: string;
}

export const STORY_LOCATIONS: StoryLocation[] = [
  {
    id: "match-template",
    title: "Match template",
    description: "the location that best fits the chosen story template",
  },
  {
    id: "new-york-rooftop",
    title: "New York rooftop",
    description: "a sleek Manhattan rooftop at golden hour, skyline behind, city glow",
  },
  {
    id: "luxury-hotel",
    title: "Luxury hotel",
    description: "a five-star luxury hotel suite or lobby, marble and warm brass, soft ambient light",
  },
  {
    id: "african-village",
    title: "African village",
    description: "a sunlit African village, warm earth tones, real community life in the background",
  },
  {
    id: "paris",
    title: "Paris",
    description: "romantic Parisian streets, wrought-iron balconies, the Eiffel Tower in soft focus",
  },
  {
    id: "private-jet",
    title: "Private jet",
    description: "the cream leather cabin of a private jet, soft cabin light, clouds through the window",
  },
  {
    id: "beach",
    title: "Beach",
    description: "a quiet golden-hour beach, gentle waves, warm backlight",
  },
  {
    id: "office",
    title: "Office",
    description: "a bright modern office, clean desks, natural window light",
  },
  {
    id: "restaurant",
    title: "Restaurant",
    description: "an intimate restaurant at night, candlelight, soft bokeh",
  },
  {
    id: "gym",
    title: "Gym",
    description: "a moody modern gym, hard directional light, chalk dust in the air",
  },
  {
    id: "coffee-shop",
    title: "Coffee shop",
    description: "a cozy coffee shop, warm window light, shallow depth of field",
  },
  {
    id: "studio",
    title: "Studio",
    description: "a clean seamless studio backdrop, soft controlled key light",
  },
];

export const DURATION_OPTIONS = [
  { value: "15", title: "15s", seconds: 15 },
  { value: "30", title: "30s", seconds: 30 },
  { value: "45", title: "45s", seconds: 45 },
  { value: "60", title: "1 min", seconds: 60 },
  { value: "90", title: "1.5 min", seconds: 90 },
  { value: "120", title: "2 min", seconds: 120 },
] as const;

export const DEFAULT_DURATION_SECONDS = 30;
const SECONDS_PER_SCENE = 6;
const MAX_SCENES = 14;

/**
 * The 8-step production journey (MVP v2 spec). A story advances step by step,
 * only when the user validates the current one — the engine never chains past
 * a step on its own. current_step on a story names the step that is due.
 */
export interface StoryStep {
  id: string;
  label: string;
}

export const STORY_STEPS: StoryStep[] = [
  { id: "idea", label: "Idea" },
  { id: "script", label: "Script" },
  { id: "characters", label: "Characters" },
  { id: "locations", label: "Locations" },
  { id: "storyboard", label: "Storyboard" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "assembly", label: "Final cut" },
];

/** Index of a step id in STORY_STEPS (-1 when unknown, e.g. legacy "old"). */
export function stepIndex(stepId: string | undefined | null): number {
  if (!stepId) return -1;
  return STORY_STEPS.findIndex((s) => s.id === stepId);
}

export function stepLabel(stepId: string | undefined | null): string {
  const idx = stepIndex(stepId);
  return idx >= 0 ? STORY_STEPS[idx].label : "Old format";
}

// ─── Cost model (confirmed Higgsfield pricing, 21 Sep 2026) ──────────────────
// Image (Nano Banana 2): 1.5 credits. Video (Seedance 2.0): 4.5 credits/second,
// any integer duration 4–15 s. Lot B fixes the old 5/10 s snap with the exact
// per-scene duration, so requested length and delivered length match.

export const IMAGE_COST_CREDITS = 1.5;
export const VIDEO_COST_PER_SECOND = 4.5;
export const MIN_CLIP_SECONDS = 4;
export const MAX_CLIP_SECONDS = 15;

/** Exact seconds per scene: requested duration spread evenly, clamped to 4–15. */
export function sceneDurationSeconds(durationSec: number, sceneCount: number): number {
  return Math.max(
    MIN_CLIP_SECONDS,
    Math.min(MAX_CLIP_SECONDS, Math.round(durationSec / Math.max(1, sceneCount))),
  );
}

export function videoClipCostCredits(durationSec: number): number {
  return durationSec * VIDEO_COST_PER_SECOND;
}

/** Full estimated cost of a film (before regenerations): storyboard + videos. */
export function estimateFilmCost(durationSec: number, sceneCount: number): number {
  const clipCost = videoClipCostCredits(sceneDurationSeconds(durationSec, sceneCount));
  return sceneCount * IMAGE_COST_CREDITS + sceneCount * clipCost;
}

export function getTemplate(id: string): StoryTemplate {
  return STORY_TEMPLATES.find((template) => template.id === id) ?? STORY_TEMPLATES[0];
}

export function getLocation(id: string, template: StoryTemplate): StoryLocation {
  if (id === "match-template" || !id) {
    return (
      STORY_LOCATIONS.find((location) => location.id === template.defaultLocationId) ??
      STORY_LOCATIONS[1]
    );
  }
  return STORY_LOCATIONS.find((location) => location.id === id) ?? STORY_LOCATIONS[1];
}

export function sceneCountForDuration(durationSec: number): number {
  const count = Math.round(durationSec / SECONDS_PER_SCENE);
  return Math.min(MAX_SCENES, Math.max(1, count));
}
