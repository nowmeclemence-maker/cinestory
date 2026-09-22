-- CineStory Lot F: vertical series — manuscript import, story bible, episodes.
-- Additive; runs once via d1_migrations.

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  title TEXT NOT NULL,
  manuscript TEXT,
  bible_json TEXT,
  episode_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_series_owner ON series (owner_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS series_episodes (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  logline TEXT,
  story_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_series_episodes_series ON series_episodes (series_id, idx);