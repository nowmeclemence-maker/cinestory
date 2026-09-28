/**
 * A D1 shim over bun:sqlite, plus the platform mocks, so tests can drive the
 * REAL server code (services + story engine) against a real database.
 *
 * Why: the deployed app needs a Higgsfield sign-in, which no test has. Mocking
 * only the two platform seams (the DB binding and the fnf profile) keeps every
 * line under test — SQL, JSON columns, step transitions — genuinely exercised,
 * with no new dependencies.
 */
import { mock } from "bun:test";
import { Database } from "bun:sqlite";

export interface D1Like {
  prepare: (sql: string) => {
    bind: (...params: unknown[]) => unknown;
    first: <T>() => Promise<T | null>;
    all: <T>() => Promise<{ results: T[] }>;
    run: () => Promise<{ success: true }>;
  };
}

/** The owner key the mocked profile resolves to. */
export const OWNER = "user:user-1:workspace:ws-1";

/** Every table the story engine and the services touch. */
export const SCHEMA = `
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'New Character',
  role TEXT DEFAULT '',
  biography TEXT DEFAULT '',
  appearance TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  clothing TEXT DEFAULT '',
  voice_id TEXT DEFAULT '',
  age TEXT DEFAULT '',
  ethnicity TEXT DEFAULT '',
  relationships TEXT DEFAULT '',
  reference_images TEXT DEFAULT '[]',
  reusable_prompts TEXT DEFAULT '',
  portrait_job_id TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  project_id TEXT,
  idea TEXT DEFAULT '',
  template_id TEXT DEFAULT '',
  location_id TEXT DEFAULT '',
  duration_sec INTEGER DEFAULT 15,
  scene_count INTEGER DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'scripting',
  progress_label TEXT,
  title TEXT,
  hook TEXT,
  cta TEXT,
  music_mood TEXT,
  color_grade TEXT,
  script_json TEXT,
  selfie_ref TEXT,
  reference_ref TEXT,
  final_video_key TEXT,
  final_poster_key TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  current_step TEXT NOT NULL DEFAULT 'old',
  estimated_cost REAL NOT NULL DEFAULT 0,
  spent_cost REAL NOT NULL DEFAULT 0,
  music_track TEXT,
  voiceover_url TEXT
);
CREATE TABLE story_scenes (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  description TEXT DEFAULT '',
  camera TEXT,
  dialogue TEXT,
  on_screen_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  image_job_id TEXT,
  image_url TEXT,
  video_job_id TEXT,
  video_url TEXT,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  location_name TEXT,
  location_description TEXT,
  location_ref TEXT,
  location_source TEXT,
  location_job_id TEXT,
  dialogue_enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE story_characters (
  story_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  scene_indices TEXT,
  PRIMARY KEY (story_id, character_id)
);
`;

class FakeStatement {
  constructor(
    private readonly db: Database,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): FakeStatement {
    return new FakeStatement(this.db, this.sql, params);
  }

  async first<T>(): Promise<T | null> {
    const row = this.db.query(this.sql).get(...(this.params as never[]));
    return (row ?? null) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rows = this.db.query(this.sql).all(...(this.params as never[]));
    return { results: rows as T[] };
  }

  async run(): Promise<{ success: true }> {
    this.db.query(this.sql).run(...(this.params as never[]));
    return { success: true };
  }
}

class FakeD1 implements D1Like {
  constructor(private readonly db: Database) {}
  prepare(sql: string): FakeStatement {
    return new FakeStatement(this.db, sql);
  }
  /** D1Database.batch — the engine writes scripts through it. */
  async batch(statements: FakeStatement[]): Promise<{ success: true }[]> {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

export interface Harness {
  /** Raw handle, for asserting what is really in the database. */
  db: Database;
  d1: D1Like;
}

export function createHarness(): Harness {
  const db = new Database(":memory:");
  db.run(SCHEMA);
  return { db, d1: new FakeD1(db) };
}

/** Register the two platform mocks. Call BEFORE importing the code under test.
 *
 * Specifiers use the "@/…" alias: a relative path here would resolve against
 * THIS file's directory (tests/helpers/…) and silently miss the real modules. */
export function wirePlatform(d1: D1Like): void {
  mock.module("@/lib/bindings.server", () => ({ bindings: () => ({ DB: d1 }) }));
  mock.module("@/lib/fnf.server", () => ({
    createServerFnf: () => ({
      profile: {
        getUser: async () => ({ id: "user-1", workspaceId: "ws-1" }),
        getCurrentWorkspace: async () => ({ id: "ws-1" }),
      },
    }),
  }));
}
