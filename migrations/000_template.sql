-- Migration: NNN_short_description
-- Author:   <your name>
-- Date:     YYYY-MM-DD
--
-- Summary:
--   One or two sentences describing what this migration changes and why.
--
-- Rollback:
--   Describe how to reverse this (the SQL, or "write a new migration that ...").
--
-- Notes:
--   - Rename this file to NNN_<description>.sql where NNN is the next
--     zero-padded sequence number in the migrations/ directory.
--   - This file (000_template.sql) is skipped by the runner.
--   - Wrap DDL + DML in BEGIN / COMMIT so the whole migration is atomic.
--   - For statements that cannot run inside a transaction (e.g.
--     CREATE INDEX CONCURRENTLY), omit BEGIN/COMMIT entirely; the runner
--     detects their absence and runs the file outside a transaction.

BEGIN;

-- Your DDL / DML goes here.
--
-- Examples:
--
--   ALTER TABLE client
--     ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE;
--
--   ALTER TABLE wrapper
--     RENAME COLUMN drawdown_rate_pct TO drawdown_fraction;
--
--   CREATE INDEX IF NOT EXISTS policy_client_status_idx
--     ON policy (client_id, status);

COMMIT;
