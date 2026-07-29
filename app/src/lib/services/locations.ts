import type { D1Database } from "@cloudflare/workers-types";
import { ApiJobError } from "@higgsfield/fnf/errors";
import { createServerFnf } from "../fnf.server";

export interface Location {
  id: string;
  name: string;
  description: string;
  mood: string;
  lighting: string;
  weather: string;
  architecture: string;
  promptPresets: string;
  referenceImages: string[];
  createdAt: string;
  updatedAt: string;
}

async function db(): Promise<D1Database | null> {
  try {
    const { bindings } = await import("../bindings.server");
    return bindings().DB ?? null;
  } catch { return null; }
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

export async function listLocations(): Promise<Location[]> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return [];
  const rows = await database
    .prepare("SELECT * FROM locations WHERE owner_key = ? ORDER BY updated_at DESC LIMIT 100")
    .bind(owner)
    .all();
  return (rows.results ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getLocation(id: string): Promise<Location> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("not_found", "Location not found.", { status: 404 });
  const row = await database
    .prepare("SELECT * FROM locations WHERE id = ? AND owner_key = ?")
    .bind(id, owner)
    .first();
  if (!row) throw new ApiJobError("not_found", "Location not found.", { status: 404 });
  return mapRow(row as Record<string, unknown>);
}

export async function createLocation(data: Partial<Location>): Promise<Location> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  const id = crypto.randomUUID();
  await database
    .prepare(
      `INSERT INTO locations (id, owner_key, name, description, mood, lighting, weather, architecture, prompt_presets, reference_images)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(id, owner, data.name ?? "New Location", data.description ?? "",
      data.mood ?? "", data.lighting ?? "", data.weather ?? "",
      data.architecture ?? "", data.promptPresets ?? "",
      JSON.stringify(data.referenceImages ?? []))
    .run();
  return getLocation(id);
}

export async function updateLocation(id: string, data: Partial<Location>): Promise<Location> {
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
      .prepare(`UPDATE locations SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ? AND owner_key = ?`)
      .bind(...values)
      .run();
  }
  return getLocation(id);
}

export async function deleteLocation(id: string): Promise<void> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return;
  await database
    .prepare("DELETE FROM locations WHERE id = ? AND owner_key = ?")
    .bind(id, owner)
    .run();
}

function mapRow(row: Record<string, unknown>): Location {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    mood: (row.mood as string) ?? "",
    lighting: (row.lighting as string) ?? "",
    weather: (row.weather as string) ?? "",
    architecture: (row.architecture as string) ?? "",
    promptPresets: (row.prompt_presets as string) ?? "",
    referenceImages: tryParseJson(row.reference_images as string, []),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function tryParseJson<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}