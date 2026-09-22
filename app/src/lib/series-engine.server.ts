import type { D1Database } from "@cloudflare/workers-types";
import { ApiJobError } from "@higgsfield/fnf/errors";
import { createLlmClient } from "@higgsfield/fnf";
import { createStory, getStory } from "./story-engine.server";
import type { StoryDTO } from "./story-engine.server";
import { createServerFnf } from "./fnf.server";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BibleCharacter {
  name: string;
  role: string;
  biography: string;
  appearance: string;
  personality: string;
  clothing: string;
  /** Library character id, filled after the bible is persisted. */
  characterId?: string;
}

export interface BibleEpisode {
  title: string;
  logline: string;
  outline: string;
}

export interface Bible {
  title: string;
  logline: string;
  summary: string;
  characters: BibleCharacter[];
  settings: { name: string; description: string }[];
  arcs: string[];
  episodes: BibleEpisode[];
}

export interface SeriesDTO {
  id: string;
  title: string;
  episodeCount: number;
  createdAt: string;
  updatedAt: string;
  bible: Bible | null;
  episodes: { idx: number; title: string; logline: string; storyId: string | null; storyStatus: string | null }[];
}

interface SeriesRow {
  id: string;
  owner_key: string;
  title: string;
  manuscript: string | null;
  bible_json: string | null;
  episode_count: number;
  created_at: string;
  updated_at: string;
}

interface SeriesEpisodeRow {
  id: string;
  series_id: string;
  idx: number;
  logline: string | null;
  story_id: string | null;
}

const MAX_EPISODES = 5;

async function database(): Promise<D1Database | null> {
  try {
    const { bindings } = await import("./bindings.server");
    return bindings().DB ?? null;
  } catch {
    return null;
  }
}

async function ownerKey(): Promise<string> {
  try {
    const profile = createServerFnf().profile;
    const user = await profile.getUser();
    if (!user) throw new ApiJobError("auth_required", "Sign in required.", { status: 401 });
    const ws = await profile.getCurrentWorkspace().catch(() => null);
    return `user:${user.id}:workspace:${ws?.id ?? user.workspaceId ?? "personal"}`;
  } catch {
    if (import.meta.env.DEV) return "dev:local";
    throw new ApiJobError("auth_required", "Sign in required.", { status: 401 });
  }
}

function tryParseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

async function loadSeries(seriesId: string): Promise<{ db: D1Database; row: SeriesRow }> {
  const owner = await ownerKey();
  const db = await database();
  if (!db) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  const row = await db.prepare("SELECT * FROM series WHERE id = ? AND owner_key = ?").bind(seriesId, owner).first<SeriesRow>();
  if (!row) throw new ApiJobError("series_not_found", "This series no longer exists.", { status: 404 });
  return { db, row };
}

const BIBLE_INSTRUCTION = [
  "You are the showrunner for CineStory vertical series.",
  "From the manuscript, build a complete story bible as STRICT JSON, no markdown fences:",
  '{"title": string, "logline": string, "summary": string (3-5 sentences), "characters": [{"name": string, "role": string, "biography": string, "appearance": string, "personality": string, "clothing": string}], "settings": [{"name": string, "description": string}], "arcs": [string], "episodes": [{"title": string, "logline": string, "outline": string}]}',
  `Split the story into episodes (2-5, use ${MAX_EPISODES} max). Each episode outline: 2-4 concrete scenes a video studio can shoot (who, where, what happens, the turn).`,
  "characters: only the people who appear on screen (max 6); appearance = concrete physical description; clothing = what they wear. settings: recurring places with a cinematic description.",
].join("\n");

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) throw new ApiJobError("bible_parse_failed", "The showrunner's bible could not be parsed.");
  return JSON.parse(text.slice(start, end + 1));
}

/** Generate the story bible from a manuscript (characters go into the library). */
async function generateBible(title: string, manuscript: string): Promise<Bible> {
  const llm = createLlmClient({ baseUrl: "https://fnf.internal/llm" });
  const [model] = await llm.listModels();
  if (!model) throw new ApiJobError("llm_unavailable", "No script-writing model is currently available.");

  const res = await llm.complete({
    model,
    messages: [
      { role: "system", content: BIBLE_INSTRUCTION },
      { role: "user", content: `Series title: ${title}\n\nManuscript:\n${manuscript}` },
    ],
  });
  const parsed = extractJson(String(res.content ?? "")) as Partial<Bible>;
  const characters = Array.isArray(parsed.characters)
    ? parsed.characters.slice(0, 6).map((c: BibleCharacter) => ({
        name: String(c.name ?? "Character"),
        role: String(c.role ?? ""),
        biography: String(c.biography ?? ""),
        appearance: String(c.appearance ?? ""),
        personality: String(c.personality ?? ""),
        clothing: String(c.clothing ?? ""),
      }))
    : [];
  const episodes = Array.isArray(parsed.episodes)
    ? parsed.episodes.slice(0, MAX_EPISODES).map((e: BibleEpisode) => ({
        title: String(e.title ?? `Episode`),
        logline: String(e.logline ?? ""),
        outline: String(e.outline ?? ""),
      }))
    : [];
  if (episodes.length === 0) {
    throw new ApiJobError("bible_invalid", "The showrunner returned no episodes.", { status: 502 });
  }
  return {
    title: String(parsed.title ?? title),
    logline: String(parsed.logline ?? ""),
    summary: String(parsed.summary ?? ""),
    characters,
    settings: Array.isArray(parsed.settings)
      ? parsed.settings.slice(0, 6).map((s: { name: string; description: string }) => ({
          name: String(s.name ?? ""),
          description: String(s.description ?? ""),
        }))
      : [],
    arcs: Array.isArray(parsed.arcs) ? parsed.arcs.map((a) => String(a)) : [],
    episodes,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

export async function listSeries(): Promise<SeriesDTO[]> {
  const owner = await ownerKey();
  const db = await database();
  if (!db) return [];
  const rows = await db.prepare("SELECT * FROM series WHERE owner_key = ? ORDER BY updated_at DESC LIMIT 50").bind(owner).all<SeriesRow>();
  const result: SeriesDTO[] = [];
  for (const row of rows.results) {
    result.push(await toDTO(db, row));
  }
  return result;
}

export async function getSeries(seriesId: string): Promise<SeriesDTO> {
  const { db, row } = await loadSeries(seriesId);
  return toDTO(db, row);
}

export async function createSeries(title: string, manuscript: string): Promise<SeriesDTO> {
  const owner = await ownerKey();
  const db = await database();
  if (!db) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  if (!manuscript.trim()) throw new ApiJobError("manuscript_empty", "The manuscript is empty.", { status: 400 });

  const bible = await generateBible(title || "Untitled series", manuscript);

  // Recurring characters live in the reusable Character Library.
  const { createCharacter } = await import("./services/characters");
  const withIds: BibleCharacter[] = [];
  for (const character of bible.characters) {
    try {
      const created = await createCharacter({
        name: character.name,
        role: character.role,
        biography: character.biography,
        appearance: character.appearance,
        personality: character.personality,
        clothing: character.clothing,
      });
      withIds.push({ ...character, characterId: created.id });
    } catch {
      withIds.push(character);
    }
  }
  const bibleWithIds: Bible = { ...bible, characters: withIds, episodes: bible.episodes.slice(0, MAX_EPISODES) };

  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO series (id, owner_key, title, manuscript, bible_json, episode_count) VALUES (?,?,?,?,?,?)")
    .bind(id, owner, bibleWithIds.title, manuscript, JSON.stringify(bibleWithIds), bibleWithIds.episodes.length)
    .run();

  return toDTO(db, { id, owner_key: owner, title: bibleWithIds.title, manuscript, bible_json: JSON.stringify(bibleWithIds), episode_count: bibleWithIds.episodes.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
}

/**
 * Lot F — start an episode: it becomes a normal story that flows through the
 * full pipeline (script → cast → sets → storyboard → video → audio → final).
 * The series cast (recurring characters) is pre-linked, so their existing
 * reference photos carry over between episodes.
 */
export async function startEpisode(seriesId: string, idx: number): Promise<StoryDTO> {
  const { db, row } = await loadSeries(seriesId);
  const bible = tryParseJson<Bible | null>(row.bible_json, null);
  if (!bible || !bible.episodes[idx]) throw new ApiJobError("episode_not_found", "Episode not found.", { status: 404 });

  const existing = await db
    .prepare("SELECT story_id FROM series_episodes WHERE series_id = ? AND idx = ?")
    .bind(seriesId, idx)
    .first<{ story_id: string }>();
  if (existing?.story_id) return getStory(existing.story_id);

  const episode = bible.episodes[idx];
  const idea = [
    `Series "${bible.title}" — Episode ${idx + 1}: ${episode.title}.`,
    `Logline: ${episode.logline || "—"}`,
    `Outline: ${episode.outline}`,
    bible.summary ? `Series summary: ${bible.summary}` : "",
    "Write this episode as a complete short film with its own hook, arc and ending, while staying consistent with the series.",
  ]
    .filter(Boolean)
    .join("\n");

  const story = await createStory({ idea, templateId: "micro-drama", locationId: "match-template", durationSec: 60 });

  // Pre-cast the recurring characters.
  for (const character of bible.characters) {
    if (!character.characterId) continue;
    await db
      .prepare(`INSERT INTO story_characters (story_id, character_id) VALUES (?, ?) ON CONFLICT(story_id, character_id) DO NOTHING`)
      .bind(story.id, character.characterId)
      .run();
  }

  await db
    .prepare("INSERT INTO series_episodes (id, series_id, idx, logline, story_id) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(), seriesId, idx, episode.logline, story.id)
    .run();
  await db.prepare("UPDATE series SET updated_at = datetime('now') WHERE id = ?").bind(seriesId).run();

  return getStory(story.id);
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const owner = await ownerKey();
  const db = await database();
  if (!db) return;
  await db.batch([
    db.prepare("DELETE FROM series_episodes WHERE series_id = ?").bind(seriesId),
    db.prepare("DELETE FROM series WHERE id = ? AND owner_key = ?").bind(seriesId, owner),
  ]);
}

async function toDTO(db: D1Database, row: SeriesRow): Promise<SeriesDTO> {
  const bible = tryParseJson<Bible | null>(row.bible_json, null);
  const episodeRows = await db.prepare("SELECT * FROM series_episodes WHERE series_id = ? ORDER BY idx ASC").bind(row.id).all<SeriesEpisodeRow>();
  const episodeCount = episodeRows.results.length > 0 ? episodeRows.results.length : row.episode_count;

  const episodes: SeriesDTO["episodes"] = Array.from({ length: episodeCount }, (_, idx) => {
    const stored = episodeRows.results.find((e) => e.idx === idx);
    const title = bible?.episodes[idx]?.title ?? `Episode ${idx + 1}`;
    const logline = stored?.logline ?? bible?.episodes[idx]?.logline ?? "";
    return { idx, title, logline, storyId: stored?.story_id ?? null, storyStatus: null };
  });

  return {
    id: row.id,
    title: row.title,
    episodeCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    bible,
    episodes,
  };
}