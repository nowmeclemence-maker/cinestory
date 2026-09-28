/**
 * Character service — CRUD and management for the Character Library.
 */
import type { D1Database } from "@cloudflare/workers-types";
import { ApiJobError } from "@higgsfield/fnf/errors";
import type { MediaRef } from "@higgsfield/fnf/media";
import { createServerFnf } from "../fnf.server";

/** A persisted reference photo: provider-compatible ref + display URL. */
export interface CharacterImage {
  ref: MediaRef;
  src: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  biography: string;
  appearance: string;
  personality: string;
  clothing: string;
  voiceId: string;
  age: string;
  ethnicity: string;
  relationships: string;
  referenceImages: CharacterImage[];
  reusablePrompts: string;
  portraitJobId: string;
  createdAt: string;
  updatedAt: string;
}

async function db(): Promise<D1Database | null> {
  try {
    const { bindings } = await import("../bindings.server");
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

export async function listCharacters(): Promise<Character[]> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return [];
  const rows = await database
    .prepare("SELECT * FROM characters WHERE owner_key = ? ORDER BY updated_at DESC LIMIT 100")
    .bind(owner)
    .all();
  return (rows.results ?? []).map(mapRow);
}

export async function getCharacter(id: string): Promise<Character> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("not_found", "Character not found.", { status: 404 });
  const row = await database
    .prepare("SELECT * FROM characters WHERE id = ? AND owner_key = ?")
    .bind(id, owner)
    .first();
  if (!row) throw new ApiJobError("not_found", "Character not found.", { status: 404 });
  return mapRow(row);
}

export async function createCharacter(data: Partial<Character>): Promise<Character> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  const id = crypto.randomUUID();
  await database
    .prepare(
      `INSERT INTO characters (id, owner_key, name, role, biography, appearance, personality, clothing, voice_id, age, ethnicity, relationships, reference_images, reusable_prompts)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id, owner, data.name ?? "New Character", data.role ?? "",
      data.biography ?? "", data.appearance ?? "", data.personality ?? "", data.clothing ?? "",
      data.voiceId ?? "", data.age ?? "", data.ethnicity ?? "",
      data.relationships ?? "", JSON.stringify(data.referenceImages ?? []),
      data.reusablePrompts ?? "",
    )
    .run();
  return getCharacter(id);
}

export async function updateCharacter(id: string, data: Partial<Character>): Promise<Character> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === "id" || key === "createdAt" || key === "updatedAt") continue;
    const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    fields.push(`${col} = ?`);
    values.push(key === "referenceImages" ? JSON.stringify(val) : val);
  }
  if (fields.length > 0) {
    values.push(id, owner);
    await database
      .prepare(`UPDATE characters SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ? AND owner_key = ?`)
      .bind(...values)
      .run();
  }
  return getCharacter(id);
}

/**
 * Append one reference photo to a character and persist it.
 *
 * The single write path for EVERY "attach a photo" action — the Character
 * Library form, the story cast step, and "use my photo" — so the automated
 * tests that cover this function cover all three surfaces.
 */
export async function appendCharacterReference(
  characterId: string,
  image: { ref: unknown; src: string },
  opts?: { replace?: boolean },
): Promise<Character> {
  const character = await getCharacter(characterId);
  const next = image as CharacterImage;
  // `replace` is what the UI's "Replace photo" means: the card shows one face,
  // so the new photo must become THE reference rather than an extra one.
  const images = opts?.replace ? [next] : [...character.referenceImages, next];
  return updateCharacter(characterId, { referenceImages: images });
}

/**
 * The user's own photo, taken from their most recent story (stories.selfie_ref).
 * Lets the Character Library offer "Use my photo" without needing a story context
 * — a library character is not tied to one story.
 */
export async function getLatestStorySelfie(): Promise<CharacterImage | null> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return null;
  const row = await database
    .prepare(
      "SELECT selfie_ref FROM stories WHERE owner_key = ? AND selfie_ref IS NOT NULL AND selfie_ref != '' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(owner)
    .first<{ selfie_ref: string }>();
  if (!row?.selfie_ref) return null;
  try {
    const parsed = JSON.parse(row.selfie_ref) as CharacterImage;
    return parsed?.ref && parsed?.src ? parsed : null;
  } catch {
    return null;
  }
}

export async function deleteCharacter(id: string): Promise<void> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return;
  await database
    .prepare("DELETE FROM characters WHERE id = ? AND owner_key = ?")
    .bind(id, owner)
    .run();
}

function mapRow(row: Record<string, unknown>): Character {
  return {
    id: row.id as string,
    name: row.name as string,
    role: (row.role as string) ?? "",
    biography: (row.biography as string) ?? "",
    appearance: (row.appearance as string) ?? "",
    personality: (row.personality as string) ?? "",
    clothing: (row.clothing as string) ?? "",
    voiceId: (row.voice_id as string) ?? "",
    age: (row.age as string) ?? "",
    ethnicity: (row.ethnicity as string) ?? "",
    relationships: (row.relationships as string) ?? "",
    referenceImages: tryParseJson<CharacterImage[]>(row.reference_images as string, []),
    reusablePrompts: (row.reusable_prompts as string) ?? "",
    portraitJobId: (row.portrait_job_id as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function tryParseJson<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}