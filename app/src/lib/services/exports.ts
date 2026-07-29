import type { D1Database } from "@cloudflare/workers-types";
import { ApiJobError } from "@higgsfield/fnf/errors";
import { createServerFnf } from "../fnf.server";

export type ExportFormat = "mp4" | "tiktok" | "instagram" | "youtube_shorts" | "youtube" | "4k" | "storyboard" | "pdf";

export interface ExportJob {
  id: string;
  storyId: string;
  format: ExportFormat;
  platform: string;
  resolution: string;
  status: "pending" | "processing" | "completed" | "failed";
  url: string;
  fileSize: number;
  error: string;
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

export async function listExports(storyId?: string): Promise<ExportJob[]> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) return [];
  let sql = "SELECT * FROM exports WHERE owner_key = ?";
  const params: unknown[] = [owner];
  if (storyId) { sql += " AND story_id = ?"; params.push(storyId); }
  sql += " ORDER BY created_at DESC LIMIT 50";
  const rows = await database.prepare(sql).bind(...params).all();
  return (rows.results ?? []).map((r) => ({
    id: r.id as string,
    storyId: r.story_id as string,
    format: r.format as ExportFormat,
    platform: (r.platform as string) ?? "",
    resolution: (r.resolution as string) ?? "",
    status: r.status as ExportJob["status"],
    url: (r.url as string) ?? "",
    fileSize: (r.file_size as number) ?? 0,
    error: (r.error as string) ?? "",
    createdAt: r.created_at as string,
  }));
}

export async function createExport(storyId: string, format: ExportFormat, platform?: string, resolution?: string): Promise<ExportJob> {
  const owner = await ownerKey();
  const database = await db();
  if (!database) throw new ApiJobError("db_unavailable", "Database unavailable.", { status: 503 });
  const id = crypto.randomUUID();
  await database
    .prepare("INSERT INTO exports (id, owner_key, story_id, format, platform, resolution, status) VALUES (?,?,?,?,?,?,'pending')")
    .bind(id, owner, storyId, format, platform ?? "", resolution ?? "")
    .run();
  return listExports().then((list) => list.find((e) => e.id === id)!);
}