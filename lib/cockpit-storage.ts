import { sql } from "@/lib/db";

export async function ensureIngestionBatchTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS ingestion_batch (
      ingestion_batch_id BIGSERIAL PRIMARY KEY,
      source_system      VARCHAR(80) NOT NULL,
      source_filename    VARCHAR(255),
      source_checksum    VARCHAR(128),
      source_as_of_date  DATE,
      started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at       TIMESTAMPTZ,
      notes              TEXT
    );
  `;
}

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

export async function ensureProductCatalogTables() {
  await ensureIngestionBatchTable();

  await sql`
    CREATE TABLE IF NOT EXISTS product (
      product_id                INT PRIMARY KEY,
      product_code              VARCHAR(60) UNIQUE,
      provider_name             VARCHAR(120) NOT NULL,
      product_name              VARCHAR(220) NOT NULL UNIQUE,
      product_family            VARCHAR(80)  NOT NULL,
      product_type              VARCHAR(80)  NOT NULL,
      vehicle_type              VARCHAR(80)  NOT NULL,
      comparison_group          VARCHAR(120) NOT NULL,
      risk_band                 VARCHAR(32)  NOT NULL,
      target_market             TEXT,
      minimum_investment        DECIMAL(18,2),
      minimum_debit_order       DECIMAL(18,2),
      default_phase             VARCHAR(20),
      initial_commission_pct    DECIMAL(10,6),
      recurring_commission_pct  DECIMAL(10,6),
      trail_commission_pct      DECIMAL(10,6),
      source_asof_date          DATE,
      eac_confidence            VARCHAR(16)  NOT NULL DEFAULT 'medium',
      active                    BOOLEAN      NOT NULL DEFAULT TRUE,
      source_system             VARCHAR(80),
      source_record_id          VARCHAR(120),
      ingestion_batch_id        BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
      ingested_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_cost_component (
      component_id          SERIAL PRIMARY KEY,
      product_id            INT REFERENCES product(product_id) ON DELETE CASCADE,
      component_type        VARCHAR(64) NOT NULL,
      charge_basis          VARCHAR(32) NOT NULL,
      value_min             DECIMAL(10,6),
      value_max             DECIMAL(10,6),
      frequency             VARCHAR(32) NOT NULL DEFAULT 'annual',
      notes                 TEXT,
      is_included_in_eac    BOOLEAN     NOT NULL DEFAULT TRUE,
      display_order         INT         NOT NULL DEFAULT 1,
      source_system         VARCHAR(80),
      source_record_id      VARCHAR(120),
      source_as_of_date     DATE,
      ingestion_batch_id    BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
      ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_feature (
      feature_id            SERIAL PRIMARY KEY,
      product_id            INT REFERENCES product(product_id) ON DELETE CASCADE,
      feature_key           VARCHAR(80) NOT NULL,
      feature_value         TEXT        NOT NULL,
      display_label         VARCHAR(120) NOT NULL,
      source_system         VARCHAR(80),
      source_record_id      VARCHAR(120),
      source_as_of_date     DATE,
      ingestion_batch_id    BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
      ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_source (
      source_id             SERIAL PRIMARY KEY,
      product_id            INT REFERENCES product(product_id) ON DELETE CASCADE,
      source_url            TEXT        NOT NULL,
      document_type         VARCHAR(32) NOT NULL,
      page_ref              VARCHAR(40),
      evidence_snippet      TEXT        NOT NULL,
      captured_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source_system         VARCHAR(80),
      source_record_id      VARCHAR(120),
      source_as_of_date     DATE,
      ingestion_batch_id    BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
      ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql.query(
    "CREATE INDEX IF NOT EXISTS product_comparison_group_idx ON product (comparison_group, active)",
  );
  await sql.query(
    "CREATE INDEX IF NOT EXISTS product_cost_component_product_idx ON product_cost_component (product_id, display_order)",
  );
  await sql.query(
    "CREATE INDEX IF NOT EXISTS product_feature_product_idx ON product_feature (product_id)",
  );
  await sql.query(
    "CREATE INDEX IF NOT EXISTS product_source_product_idx ON product_source (product_id)",
  );
}

export async function ensureCockpitTables() {
  await ensureDashboardInsightsTable();
  await ensureCommunicationDraftsTable();
  await ensureProductCatalogTables();
}
