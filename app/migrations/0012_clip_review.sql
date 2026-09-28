-- 0012_clip_review.sql
--
-- Two things:
--
-- 1. Durable media. Provider URLs (Higgsfield scene clips) expire after roughly
--    seven days. Reviewing a film whose clips vanish mid-review is useless, so
--    every finished scene image/clip is mirrored into this app's own R2 bucket
--    and served owner-gated through /api/story-media. `image_key` / `video_key`
--    hold the R2 object key; the provider URL stays in image_url / video_url
--    because the assembly container fetches those directly.
--
-- 2. The clip review gate. The Video step is a checkpoint like the storyboard:
--    each clip must be looked at and approved before the story can move on to
--    Audio, and a story cannot reach Final cut with unreviewed clips.
--    `final_approved` records that the finished film was accepted.

ALTER TABLE story_scenes ADD COLUMN image_key TEXT;
ALTER TABLE story_scenes ADD COLUMN video_key TEXT;
ALTER TABLE story_scenes ADD COLUMN video_approved INTEGER NOT NULL DEFAULT 0;

ALTER TABLE stories ADD COLUMN final_approved INTEGER NOT NULL DEFAULT 0;
