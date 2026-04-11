import { sql } from "@vercel/postgres";

export async function ensureDashboardInsightsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_insights (
      insight_key  VARCHAR(200) PRIMARY KEY,
      advisor_id   INT,
      data         JSONB       NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE dashboard_insights ADD COLUMN IF NOT EXISTS advisor_id INT;`;
  await sql.query(
    "CREATE INDEX IF NOT EXISTS dashboard_insights_advisor_generated_idx ON dashboard_insights (advisor_id, generated_at DESC)",
  );
}

export async function ensureCommunicationDraftsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS communication_drafts (
      draft_id             SERIAL PRIMARY KEY,
      client_id            INT REFERENCES client(client_id) ON DELETE CASCADE,
      advisor_id           INT REFERENCES advisor(advisor_id) ON DELETE CASCADE,
      draft_type           VARCHAR(32)  NOT NULL,
      status               VARCHAR(20)  NOT NULL DEFAULT 'draft',
      subject              TEXT         NOT NULL,
      body                 TEXT         NOT NULL,
      attachment_metadata  JSONB        NOT NULL DEFAULT '[]'::jsonb,
      created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `;

  await sql.query(
    "CREATE INDEX IF NOT EXISTS communication_drafts_client_updated_idx ON communication_drafts (client_id, updated_at DESC)",
  );
  await sql.query(
    "CREATE INDEX IF NOT EXISTS communication_drafts_advisor_status_idx ON communication_drafts (advisor_id, status)",
  );
}

export async function ensureCockpitTables() {
  await ensureDashboardInsightsTable();
  await ensureCommunicationDraftsTable();
}
