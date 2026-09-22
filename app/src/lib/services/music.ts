import type { D1Database } from "@cloudflare/workers-types";
import { ApiJobError } from "@higgsfield/fnf/errors";
import { createServerFnf } from "../fnf.server";

export interface MusicTrack {
  id: string;
  name: string;
  genre: string;
  mood: string;
  durationSec: number;
  url: string;
  isFavorite: boolean;
  createdAt: string;
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

export async function listMusicTracks(): Promise<MusicTrack[]> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return [];
  const rows = await database
    .prepare("SELECT * FROM music_tracks WHERE owner_key = ? ORDER BY created_at DESC LIMIT 100")
    .bind(owner)
    .all();
  return (rows.results ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) ?? "Track",
    genre: (r.genre as string) ?? "",
    mood: (r.mood as string) ?? "",
    durationSec: Number(r.duration_sec ?? 0),
    url: (r.url as string) ?? "",
    isFavorite: Number(r.is_favorite ?? 0) === 1,
    createdAt: r.created_at as string,
  }));
}

export async function createMusicTrack(data: {
  name: string;
  url: string;
  genre?: string;
  mood?: string;
  durationSec?: number;
}): Promise<MusicTrack> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  const id = crypto.randomUUID();
  await database
    .prepare(
      "INSERT INTO music_tracks (id, owner_key, name, genre, mood, duration_sec, url) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(id, owner, data.name, data.genre ?? "", data.mood ?? "", data.durationSec ?? 0, data.url)
    .run();
  return listMusicTracks().then((tracks) => tracks.find((t) => t.id === id)!);
}

export async function deleteMusicTrack(id: string): Promise<void> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return;
  await database.prepare("DELETE FROM music_tracks WHERE id = ? AND owner_key = ?").bind(id, owner).run();
}