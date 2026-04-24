-- Migration: 002_allow_meeting_summary_drafts
-- Summary:
--   Extend communication_drafts so meeting-summary notes can be stored as a
--   first-class draft type for the meeting workflow.

BEGIN;

ALTER TABLE communication_drafts
  DROP CONSTRAINT IF EXISTS communication_drafts_draft_type_check;

ALTER TABLE communication_drafts
  ADD CONSTRAINT communication_drafts_draft_type_check
  CHECK (draft_type IN ('email', 'meeting_request', 'meeting_summary'));

COMMIT;
