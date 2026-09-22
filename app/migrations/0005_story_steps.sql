-- CineStory Lot 0: foundations — step model, costs, retry tracking,
-- story↔character links. Additive; runs once via d1_migrations.

ALTER TABLE stories ADD COLUMN current_step TEXT NOT NULL DEFAULT 'old';
ALTER TABLE stories ADD COLUMN estimated_cost REAL NOT NULL DEFAULT 0;
ALTER TABLE stories ADD COLUMN spent_cost REAL NOT NULL DEFAULT 0;
ALTER TABLE story_scenes ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS story_characters (
  story_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  PRIMARY KEY (story_id, character_id),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_story_characters_story ON story_characters (story_id);