import type { D1Database } from "@cloudflare/workers-types";
import { ApiJobError } from "@higgsfield/fnf/errors";
import { createServerFnf } from "../fnf.server";

export type AssetType = "image" | "video" | "audio" | "music" | "voice" | "document";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  thumbnailUrl: string;
  fileSize: number;
  mimeType: string;
  folderId: string;
  tags: string[];
  description: string;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AssetFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
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

export async function listAssets(opts?: { type?: AssetType; folderId?: string; tag?: string; search?: string }): Promise<Asset[]> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return [];
  let sql = "SELECT * FROM assets WHERE owner_key = ?";
  const params: unknown[] = [owner];
  if (opts?.type) { sql += " AND type = ?"; params.push(opts.type); }
  if (opts?.folderId) { sql += " AND folder_id = ?"; params.push(opts.folderId); }
  if (opts?.tag) { sql += " AND tags LIKE ?"; params.push(`%${opts.tag}%`); }
  if (opts?.search) { sql += " AND (name LIKE ? OR description LIKE ?)"; params.push(`%${opts.search}%`, `%${opts.search}%`); }
  sql += " ORDER BY updated_at DESC LIMIT 100";
  const rows = await database.prepare(sql).bind(...params).all();
  return (rows.results ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function createAsset(data: { name: string; type: AssetType; url?: string; folderId?: string; tags?: string[]; description?: string }): Promise<Asset> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  const id = crypto.randomUUID();
  await database
    .prepare("INSERT INTO assets (id, owner_key, name, type, url, folder_id, tags, description) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, owner, data.name, data.type, data.url ?? "", data.folderId ?? "", JSON.stringify(data.tags ?? []), data.description ?? "")
    .run();
  return getAsset(id);
}

export async function getAsset(id: string): Promise<Asset> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("not_found", "Asset not found.", { status: 404 });
  const row = await database.prepare("SELECT * FROM assets WHERE id = ? AND owner_key = ?").bind(id, owner).first();
  if (!row) throw new ApiJobError("not_found", "Asset not found.", { status: 404 });
  return mapRow(row as Record<string, unknown>);
}

export async function deleteAsset(id: string): Promise<void> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return;
  await database.prepare("DELETE FROM assets WHERE id = ? AND owner_key = ?").bind(id, owner).run();
}

export async function listFolders(parentId?: string | null): Promise<AssetFolder[]> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return [];
  if (parentId === undefined) {
    const rows = await database.prepare("SELECT * FROM asset_folders WHERE owner_key = ? ORDER BY name").bind(owner).all();
    return (rows.results ?? []).map((r) => ({ id: r.id as string, name: r.name as string, parentId: (r.parent_id as string) ?? null, createdAt: r.created_at as string }));
  }
  const rows = await database.prepare("SELECT * FROM asset_folders WHERE owner_key = ? AND parent_id = ? ORDER BY name").bind(owner, parentId).all();
  return (rows.results ?? []).map((r) => ({ id: r.id as string, name: r.name as string, parentId: (r.parent_id as string) ?? null, createdAt: r.created_at as string }));
}

export async function createFolder(name: string, parentId?: string): Promise<AssetFolder> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  const id = crypto.randomUUID();
  await database.prepare("INSERT INTO asset_folders (id, owner_key, name, parent_id) VALUES (?,?,?,?)").bind(id, owner, name, parentId ?? null).run();
  return { id, name, parentId: parentId ?? null, createdAt: new Date().toISOString() };
}

function mapRow(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as AssetType,
    url: (row.url as string) ?? "",
    thumbnailUrl: (row.thumbnail_url as string) ?? "",
    fileSize: (row.file_size as number) ?? 0,
    mimeType: (row.mime_type as string) ?? "",
    folderId: (row.folder_id as string) ?? "",
    tags: tryParseJson((row.tags as string) ?? "", [] as string[]),
    description: (row.description as string) ?? "",
    meta: tryParseJson((row.meta_json as string) ?? "", {} as Record<string, unknown>),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function tryParseJson<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}