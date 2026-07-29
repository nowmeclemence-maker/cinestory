-- CineStory: the story pipeline. Additive migration; ONE shared D1 database
-- (preview + prod), so keep every future change additive too.

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  project_id TEXT,
  idea TEXT NOT NULL,
  template_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  scene_count INTEGER NOT NULL,
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS stories_owner_updated_idx ON stories (owner_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS stories_owner_project_idx ON stories (owner_key, project_id);

CREATE TABLE IF NOT EXISTS story_scenes (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  description TEXT NOT NULL,
  camera TEXT,
  dialogue TEXT,
  on_screen_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  image_job_id TEXT,
  image_url TEXT,
  video_job_id TEXT,
  video_url TEXT,
  error TEXT,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS story_scenes_story_idx ON story_scenes (story_id, idx);

-- Mirrors the container assembly job (one per story). Written by the
-- container Durable Object's monitor loop; see src/server.ts (AppContainer).
CREATE TABLE IF NOT EXISTS story_assembly_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued',
  output_video_key TEXT,
  output_poster_key TEXT,
  error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
