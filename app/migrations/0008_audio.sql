-- CineStory Lot E: audio — per-scene dialogue toggles, story music track, voiceover.
-- Additive; runs once via d1_migrations.

ALTER TABLE story_scenes ADD COLUMN dialogue_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE stories ADD COLUMN music_track TEXT;
ALTER TABLE stories ADD COLUMN voiceover_url TEXT;