-- CineStory Lot D: per-scene sets/locations wired into the storyboard.
-- Additive; runs once via d1_migrations.

ALTER TABLE story_scenes ADD COLUMN location_name TEXT;
ALTER TABLE story_scenes ADD COLUMN location_description TEXT;
ALTER TABLE story_scenes ADD COLUMN location_ref TEXT;
ALTER TABLE story_scenes ADD COLUMN location_source TEXT;
ALTER TABLE story_scenes ADD COLUMN location_job_id TEXT;