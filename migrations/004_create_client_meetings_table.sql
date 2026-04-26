-- Migration: 004_create_client_meetings_table
-- Summary:
--   Create client_meetings as a first-class record for each advisor-client meeting.
--   Each row stores the raw transcript, AI-generated summary, and action items
--   separately from the communication_drafts formatted note.
--   Backfill existing meeting_summary drafts as client_meetings rows.

BEGIN;

CREATE TABLE IF NOT EXISTS client_meetings (
  meeting_id        SERIAL      PRIMARY KEY,
  client_id         INT         NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
  advisor_id        INT         NOT NULL REFERENCES advisor(advisor_id) ON DELETE CASCADE,
  draft_id          INT         REFERENCES communication_drafts(draft_id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ,
  duration_seconds  INT,
  transcript        TEXT        NOT NULL DEFAULT '',
  summary           TEXT        NOT NULL DEFAULT '',
  action_items      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_meetings_client_advisor_idx
  ON client_meetings (advisor_id, client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS client_meetings_draft_idx
  ON client_meetings (draft_id);

-- Backfill: create a client_meeting row for every existing meeting_summary draft.
-- Extract the transcript and summary sections using split_part on the known body format.
-- Body format produced by buildMeetingDraftBody:
--   [Meeting captured: {date}\nDuration: {dur}\n\n]Meeting Summary\n\n{summary}\n\n[Action Items\n\n...\n\n]Transcript\n\n{transcript}
INSERT INTO client_meetings (
  client_id,
  advisor_id,
  draft_id,
  transcript,
  summary,
  created_at,
  updated_at
)
SELECT
  client_id,
  advisor_id,
  draft_id,
  CASE
    WHEN body LIKE ('%' || chr(10) || chr(10) || 'Transcript' || chr(10) || chr(10) || '%')
    THEN split_part(body, chr(10) || chr(10) || 'Transcript' || chr(10) || chr(10), 2)
    ELSE ''
  END AS transcript,
  CASE
    WHEN body LIKE ('%Meeting Summary' || chr(10) || chr(10) || '%')
    THEN split_part(
      split_part(body, 'Meeting Summary' || chr(10) || chr(10), 2),
      chr(10) || chr(10),
      1
    )
    ELSE subject
  END AS summary,
  created_at,
  updated_at
FROM communication_drafts
WHERE draft_type = 'meeting_summary';

COMMIT;
