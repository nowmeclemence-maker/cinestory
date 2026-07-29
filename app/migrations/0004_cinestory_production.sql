-- CineStory production schema. All future features as additive migrations.

-- 1. Core stories (existing, extended)
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  project_id TEXT,
  idea TEXT NOT NULL,
  template_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  scene_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
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
CREATE INDEX IF NOT EXISTS idx_stories_owner ON stories (owner_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_project ON stories (owner_key, project_id);

CREATE TABLE IF NOT EXISTS story_scenes (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  act INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  camera TEXT,
  dialogue TEXT,
  narration TEXT,
  on_screen_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  image_job_id TEXT,
  image_url TEXT,
  video_job_id TEXT,
  video_url TEXT,
  error TEXT,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scenes_story ON story_scenes (story_id, idx);

CREATE TABLE IF NOT EXISTS story_assembly_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued',
  output_video_key TEXT,
  output_poster_key TEXT,
  error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Projects (existing)
CREATE TABLE IF NOT EXISTS studio_projects (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON studio_projects (owner_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS studio_generation_projects (
  owner_key TEXT NOT NULL,
  generation_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_key, generation_id),
  FOREIGN KEY (project_id) REFERENCES studio_projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gen_projects ON studio_generation_projects (owner_key, project_id);

-- 3. Characters
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  biography TEXT,
  appearance TEXT,
  personality TEXT,
  clothing TEXT,
  voice_id TEXT,
  age TEXT,
  ethnicity TEXT,
  relationships TEXT,
  reference_images TEXT,
  reusable_prompts TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters (owner_key, updated_at DESC);

-- 4. Locations
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  mood TEXT,
  lighting TEXT,
  weather TEXT,
  architecture TEXT,
  prompt_presets TEXT,
  reference_images TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_locations_owner ON locations (owner_key, updated_at DESC);

-- 5. Assets (unified media library)
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image','video','audio','music','voice','document')),
  url TEXT,
  thumbnail_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  folder_id TEXT,
  tags TEXT,
  description TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets (owner_key, type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_folder ON assets (owner_key, folder_id);

CREATE TABLE IF NOT EXISTS asset_folders (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_folders_owner ON asset_folders (owner_key, parent_id);

-- 6. Templates (user templates + system presets)
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  owner_key TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'user',
  config_json TEXT,
  thumbnail_url TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_templates_owner ON templates (owner_key, category);

-- 7. Exports
CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  story_id TEXT NOT NULL,
  format TEXT NOT NULL,
  platform TEXT,
  resolution TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  url TEXT,
  file_size INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_exports_owner ON exports (owner_key, created_at DESC);

-- 8. Credits & billing
CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('grant','spend','refund','purchase')),
  description TEXT,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_credits_owner ON credit_transactions (owner_key, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. Prompts library
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prompts_owner ON prompts (owner_key, updated_at DESC);

-- 10. Voice library
CREATE TABLE IF NOT EXISTS voices (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  settings_json TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_voices_owner ON voices (owner_key, name);

-- 11. Music library
CREATE TABLE IF NOT EXISTS music_tracks (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  genre TEXT,
  mood TEXT,
  duration_sec INTEGER,
  url TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_music_owner ON music_tracks (owner_key, name);