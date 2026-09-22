-- CineStory Lot C: characters wired into the pipeline.
-- Additive; runs once via d1_migrations.

ALTER TABLE characters ADD COLUMN role TEXT;
ALTER TABLE characters ADD COLUMN portrait_job_id TEXT;
ALTER TABLE story_characters ADD COLUMN scene_indices TEXT;