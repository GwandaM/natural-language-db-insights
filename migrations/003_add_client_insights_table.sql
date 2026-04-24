-- Migration: 003_add_client_insights_table
-- Summary:
--   Introduce a dedicated table for per-client AI insight payloads so they
--   are no longer colocated with the advisor-level dashboard_insights rows.
--   Keyed by (advisor_id, client_id) with cascading deletes.
--
-- Rollback:
--   DROP TABLE IF EXISTS client_insights;

BEGIN;

CREATE TABLE IF NOT EXISTS client_insights (
  advisor_id   INT         NOT NULL REFERENCES advisor(advisor_id) ON DELETE CASCADE,
  client_id    INT         NOT NULL REFERENCES client(client_id)   ON DELETE CASCADE,
  data         JSONB       NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (advisor_id, client_id)
);

CREATE INDEX IF NOT EXISTS client_insights_client_idx
  ON client_insights (client_id);

CREATE INDEX IF NOT EXISTS client_insights_generated_idx
  ON client_insights (generated_at DESC);

COMMIT;
