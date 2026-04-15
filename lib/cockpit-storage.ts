import { sql } from "@/lib/db";

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
  await sql`
    CREATE TABLE IF NOT EXISTS provider (
      provider_id     INT PRIMARY KEY,
      provider_name   VARCHAR(120) NOT NULL,
      provider_type   VARCHAR(32)  NOT NULL,
      website_url     TEXT,
      active          BOOLEAN      NOT NULL DEFAULT TRUE
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS provider_product (
      product_id            INT PRIMARY KEY,
      provider_id           INT REFERENCES provider(provider_id) ON DELETE CASCADE,
      reference_fund_id     INT REFERENCES fund(fund_id) ON DELETE SET NULL,
      product_name          VARCHAR(220) NOT NULL,
      product_family        VARCHAR(80)  NOT NULL,
      product_type          VARCHAR(80)  NOT NULL,
      vehicle_type          VARCHAR(80)  NOT NULL,
      comparison_group      VARCHAR(120) NOT NULL,
      risk_band             VARCHAR(32)  NOT NULL,
      target_market         TEXT,
      minimum_investment    DECIMAL(18,2),
      minimum_debit_order   DECIMAL(18,2),
      source_asof_date      DATE,
      eac_confidence        VARCHAR(16)  NOT NULL DEFAULT 'medium',
      active                BOOLEAN      NOT NULL DEFAULT TRUE
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_cost_component (
      component_id          SERIAL PRIMARY KEY,
      product_id            INT REFERENCES provider_product(product_id) ON DELETE CASCADE,
      component_type        VARCHAR(64) NOT NULL,
      charge_basis          VARCHAR(32) NOT NULL,
      value_min             DECIMAL(10,6),
      value_max             DECIMAL(10,6),
      frequency             VARCHAR(32) NOT NULL DEFAULT 'annual',
      notes                 TEXT,
      is_included_in_eac    BOOLEAN     NOT NULL DEFAULT TRUE,
      display_order         INT         NOT NULL DEFAULT 1
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_feature (
      feature_id            SERIAL PRIMARY KEY,
      product_id            INT REFERENCES provider_product(product_id) ON DELETE CASCADE,
      feature_key           VARCHAR(80) NOT NULL,
      feature_value         TEXT        NOT NULL,
      display_label         VARCHAR(120) NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_source (
      source_id             SERIAL PRIMARY KEY,
      product_id            INT REFERENCES provider_product(product_id) ON DELETE CASCADE,
      source_url            TEXT        NOT NULL,
      document_type         VARCHAR(32) NOT NULL,
      page_ref              VARCHAR(40),
      evidence_snippet      TEXT        NOT NULL,
      captured_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS client_product_mapping (
      mapping_id            SERIAL PRIMARY KEY,
      client_id             INT REFERENCES client(client_id) ON DELETE CASCADE,
      policy_id             INT REFERENCES policy(policy_id) ON DELETE CASCADE,
      wrapper_id            INT REFERENCES wrapper(wrapper_id) ON DELETE CASCADE,
      product_id            INT REFERENCES provider_product(product_id) ON DELETE CASCADE,
      mapping_method        VARCHAR(40) NOT NULL,
      mapping_confidence    VARCHAR(16) NOT NULL,
      notes                 TEXT,
      mapped_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (policy_id IS NOT NULL OR wrapper_id IS NOT NULL)
    );
  `;

  await sql.query(
    "CREATE INDEX IF NOT EXISTS provider_type_name_idx ON provider (provider_type, provider_name)",
  );
  await sql.query(
    "CREATE INDEX IF NOT EXISTS provider_product_provider_group_idx ON provider_product (provider_id, comparison_group, active)",
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
  await sql.query(
    "CREATE INDEX IF NOT EXISTS client_product_mapping_client_idx ON client_product_mapping (client_id, mapped_at DESC)",
  );
  await sql.query(
    "CREATE INDEX IF NOT EXISTS client_product_mapping_policy_idx ON client_product_mapping (policy_id)",
  );
  await sql.query(
    "CREATE INDEX IF NOT EXISTS client_product_mapping_wrapper_idx ON client_product_mapping (wrapper_id)",
  );
}

export async function ensureCockpitTables() {
  await ensureDashboardInsightsTable();
  await ensureCommunicationDraftsTable();
  await ensureProductCatalogTables();
}
