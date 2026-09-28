-- 0011_remove_incomplete_stories.sql
--
-- One-time, user-approved cleanup of production data.
--
-- Removes the 12 incomplete stories left over from the July build/QA rounds:
-- 11 stuck in 'failed' (they ran out of credits mid-pipeline) and 1 stuck in
-- 'generating'. Verified before writing: these carry 40 story_scenes but no
-- characters, no exports, no assembly jobs and no claim leases, and NONE of the
-- scenes ever produced an image or video (0 with media) -- so there are no
-- orphaned R2 objects to clean up.
--
-- Targets explicit story ids (not a status filter) so this can never touch a
-- story created after the cleanup was approved.
--
-- Child rows are deleted explicitly before the parent rows, so the outcome does
-- not depend on foreign-key enforcement being enabled.

DELETE FROM story_scenes WHERE story_id IN (
  '019974da-4215-42ac-857d-a303969e3ebc',
  '755ad385-3d88-458f-871b-50ad1de1aebb',
  '89defe1b-8f42-487c-ac6b-c70604301d77',
  'd5a97d2e-80a4-407b-98ff-abb668ca6dba',
  '017b1779-4125-41d6-91ba-d9b3d3eb1393',
  'e2b8de98-6c7e-409e-abf1-d51f368bbbad',
  'b83837b7-1fea-4a0a-a8fd-0b1c88abcc4a',
  '92ef1d9d-a7dc-4775-b931-f39a87a84068',
  '7d61e8e0-598b-4487-bdce-b8022a75a8f6',
  '11bf4f16-9416-451b-8e1e-e3f930b07ab4',
  '14b1740f-5007-4f1f-af9a-7d0971cd6e78',
  '55879c60-82d9-4d95-be8f-137888efabe3'
);

DELETE FROM story_characters WHERE story_id IN (
  '019974da-4215-42ac-857d-a303969e3ebc',
  '755ad385-3d88-458f-871b-50ad1de1aebb',
  '89defe1b-8f42-487c-ac6b-c70604301d77',
  'd5a97d2e-80a4-407b-98ff-abb668ca6dba',
  '017b1779-4125-41d6-91ba-d9b3d3eb1393',
  'e2b8de98-6c7e-409e-abf1-d51f368bbbad',
  'b83837b7-1fea-4a0a-a8fd-0b1c88abcc4a',
  '92ef1d9d-a7dc-4775-b931-f39a87a84068',
  '7d61e8e0-598b-4487-bdce-b8022a75a8f6',
  '11bf4f16-9416-451b-8e1e-e3f930b07ab4',
  '14b1740f-5007-4f1f-af9a-7d0971cd6e78',
  '55879c60-82d9-4d95-be8f-137888efabe3'
);

DELETE FROM exports WHERE story_id IN (
  '019974da-4215-42ac-857d-a303969e3ebc',
  '755ad385-3d88-458f-871b-50ad1de1aebb',
  '89defe1b-8f42-487c-ac6b-c70604301d77',
  'd5a97d2e-80a4-407b-98ff-abb668ca6dba',
  '017b1779-4125-41d6-91ba-d9b3d3eb1393',
  'e2b8de98-6c7e-409e-abf1-d51f368bbbad',
  'b83837b7-1fea-4a0a-a8fd-0b1c88abcc4a',
  '92ef1d9d-a7dc-4775-b931-f39a87a84068',
  '7d61e8e0-598b-4487-bdce-b8022a75a8f6',
  '11bf4f16-9416-451b-8e1e-e3f930b07ab4',
  '14b1740f-5007-4f1f-af9a-7d0971cd6e78',
  '55879c60-82d9-4d95-be8f-137888efabe3'
);

DELETE FROM stories WHERE id IN (
  '019974da-4215-42ac-857d-a303969e3ebc',
  '755ad385-3d88-458f-871b-50ad1de1aebb',
  '89defe1b-8f42-487c-ac6b-c70604301d77',
  'd5a97d2e-80a4-407b-98ff-abb668ca6dba',
  '017b1779-4125-41d6-91ba-d9b3d3eb1393',
  'e2b8de98-6c7e-409e-abf1-d51f368bbbad',
  'b83837b7-1fea-4a0a-a8fd-0b1c88abcc4a',
  '92ef1d9d-a7dc-4775-b931-f39a87a84068',
  '7d61e8e0-598b-4487-bdce-b8022a75a8f6',
  '11bf4f16-9416-451b-8e1e-e3f930b07ab4',
  '14b1740f-5007-4f1f-af9a-7d0971cd6e78',
  '55879c60-82d9-4d95-be8f-137888efabe3'
);
