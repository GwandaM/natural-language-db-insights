-- Migration: 001_initial_db_tables
-- Author:   GwandaM
-- Date:     2026-04-23
--
-- Summary:
--   Reset the public schema and create the dashboard/client schema for the
--   Investment Advisor CRM. The core model is:
--     advisor -> client -> policy -> policy_fund_holding_snapshot
--   where a policy is now the client-held product/container that the UI used
--   to treat as a wrapper.
--
-- Rollback:
--   Forward-only. To undo, write a new migration that drops these tables
--   and restores the previous schema.
--
-- Notes:
--   - The GLOBAL RESET block drops all public tables except
--     schema_migrations so the migration runner can still record progress.
--   - This schema intentionally ignores the NL-query app path and instead
--     optimises for the existing dashboard and client pages.
--   - The provider table is removed. This app currently supports a single
--     provider, so provider display/config fields live on product.
--   - Ingestion metadata is built in via ingestion_batch plus per-row source
--     columns on imported tables.

BEGIN;

/* ==================================================================
   GLOBAL RESET
   ================================================================== */
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'schema_migrations'
  ) LOOP
    EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
  END LOOP;
END $$;

/* ==================================================================
   INGESTION METADATA
   ================================================================== */
CREATE TABLE ingestion_batch (
  ingestion_batch_id BIGSERIAL PRIMARY KEY,
  source_system      VARCHAR(80) NOT NULL,
  source_filename    VARCHAR(255),
  source_checksum    VARCHAR(128),
  source_as_of_date  DATE,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  notes              TEXT
);

/* ==================================================================
   FUND REFERENCE / ANALYTICS
   Keep the dashboard analytics model intact.
   ================================================================== */
CREATE TABLE sector (
  sector_id           SERIAL PRIMARY KEY,
  sector_name         VARCHAR(100) NOT NULL UNIQUE,
  asisa_category_name VARCHAR(100),
  source_system       VARCHAR(80),
  source_record_id    VARCHAR(120),
  source_as_of_date   DATE,
  ingestion_batch_id  BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE peer_group (
  peer_group_id       SERIAL PRIMARY KEY,
  peer_group_name     VARCHAR(200) NOT NULL UNIQUE,
  display_group_name  VARCHAR(200),
  sector_id           INT REFERENCES sector(sector_id) ON DELETE SET NULL,
  source_system       VARCHAR(80),
  source_record_id    VARCHAR(120),
  source_as_of_date   DATE,
  ingestion_batch_id  BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE period_definition (
  period_id           SERIAL PRIMARY KEY,
  period_code         VARCHAR(10) NOT NULL UNIQUE,
  period_type         VARCHAR(30) NOT NULL,
  end_date            DATE,
  is_annualized       BOOLEAN NOT NULL DEFAULT FALSE,
  display_order       INT NOT NULL DEFAULT 0,
  source_system       VARCHAR(80),
  source_record_id    VARCHAR(120),
  source_as_of_date   DATE,
  ingestion_batch_id  BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fund (
  fund_id                    SERIAL PRIMARY KEY,
  fund_name                  VARCHAR(300) NOT NULL,
  isin                       VARCHAR(20) UNIQUE,
  ticker                     VARCHAR(30),
  inception_date             DATE,
  management_fee             NUMERIC(10,6),
  net_expense_ratio          NUMERIC(10,6),
  fund_size                  NUMERIC(20,2),
  morningstar_rating_overall NUMERIC(4,2),
  peer_group_id              INT REFERENCES peer_group(peer_group_id) ON DELETE SET NULL,
  sector_id                  INT REFERENCES sector(sector_id) ON DELETE SET NULL,
  source_as_of_date          DATE,
  source_system              VARCHAR(80),
  source_record_id           VARCHAR(120),
  ingestion_batch_id         BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (management_fee IS NULL OR management_fee >= 0),
  CHECK (net_expense_ratio IS NULL OR net_expense_ratio >= 0),
  CHECK (fund_size IS NULL OR fund_size >= 0),
  CHECK (
    morningstar_rating_overall IS NULL
    OR (morningstar_rating_overall >= 0 AND morningstar_rating_overall <= 5)
  )
);

CREATE TABLE fund_performance_fact (
  fund_perf_id         SERIAL PRIMARY KEY,
  fund_id              INT NOT NULL REFERENCES fund(fund_id) ON DELETE CASCADE,
  period_id            INT NOT NULL REFERENCES period_definition(period_id) ON DELETE CASCADE,
  as_of_date           DATE NOT NULL,
  return_annualized    NUMERIC(10,6),
  return_cumulative    NUMERIC(10,6),
  best_month           NUMERIC(10,6),
  worst_month          NUMERIC(10,6),
  up_capture_ratio     NUMERIC(10,6),
  down_capture_ratio   NUMERIC(10,6),
  up_percent_ratio     NUMERIC(10,6),
  down_percent_ratio   NUMERIC(10,6),
  r_squared            NUMERIC(10,6),
  source_system        VARCHAR(80),
  source_record_id     VARCHAR(120),
  source_as_of_date    DATE,
  ingestion_batch_id   BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fund_id, period_id, as_of_date)
);

CREATE TABLE fund_risk_fact (
  fund_risk_id              SERIAL PRIMARY KEY,
  fund_id                   INT NOT NULL REFERENCES fund(fund_id) ON DELETE CASCADE,
  period_id                 INT NOT NULL REFERENCES period_definition(period_id) ON DELETE CASCADE,
  as_of_date                DATE NOT NULL,
  std_dev_annualized        NUMERIC(10,6),
  sharpe_ratio_annualized   NUMERIC(10,6),
  sortino_ratio_annualized  NUMERIC(10,6),
  treynor_ratio_annualized  NUMERIC(10,6),
  tracking_error_annualized NUMERIC(10,6),
  source_system             VARCHAR(80),
  source_record_id          VARCHAR(120),
  source_as_of_date         DATE,
  ingestion_batch_id        BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fund_id, period_id, as_of_date)
);

CREATE TABLE fund_flow_fact (
  fund_flow_id        SERIAL PRIMARY KEY,
  fund_id             INT NOT NULL REFERENCES fund(fund_id) ON DELETE CASCADE,
  period_id           INT NOT NULL REFERENCES period_definition(period_id) ON DELETE CASCADE,
  as_of_date          DATE NOT NULL,
  estimated_net_flow  NUMERIC(20,2),
  fund_size           NUMERIC(20,2),
  source_system       VARCHAR(80),
  source_record_id    VARCHAR(120),
  source_as_of_date   DATE,
  ingestion_batch_id  BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fund_id, period_id, as_of_date)
);

CREATE TABLE fund_ranking_fact (
  fund_ranking_id          SERIAL PRIMARY KEY,
  fund_id                  INT NOT NULL REFERENCES fund(fund_id) ON DELETE CASCADE,
  period_id                INT NOT NULL REFERENCES period_definition(period_id) ON DELETE CASCADE,
  peer_group_id            INT REFERENCES peer_group(peer_group_id) ON DELETE SET NULL,
  as_of_date               DATE NOT NULL,
  peer_group_rank          INT,
  peer_group_quartile      INT,
  investments_ranked_count INT,
  source_system            VARCHAR(80),
  source_record_id         VARCHAR(120),
  source_as_of_date        DATE,
  ingestion_batch_id       BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fund_id, period_id, as_of_date),
  CHECK (peer_group_rank IS NULL OR peer_group_rank > 0),
  CHECK (
    peer_group_quartile IS NULL
    OR peer_group_quartile BETWEEN 1 AND 4
  )
);

CREATE TABLE peer_group_stat_fact (
  peer_group_stat_id   SERIAL PRIMARY KEY,
  peer_group_id        INT NOT NULL REFERENCES peer_group(peer_group_id) ON DELETE CASCADE,
  period_id            INT NOT NULL REFERENCES period_definition(period_id) ON DELETE CASCADE,
  as_of_date           DATE NOT NULL,
  metric_name          VARCHAR(100) NOT NULL,
  stat_type            VARCHAR(50) NOT NULL,
  metric_value         NUMERIC(18,6) NOT NULL,
  source_system        VARCHAR(80),
  source_record_id     VARCHAR(120),
  source_as_of_date    DATE,
  ingestion_batch_id   BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (peer_group_id, period_id, as_of_date, metric_name, stat_type)
);

/* ==================================================================
   ADVISOR / CLIENT / PRODUCT / POLICY
   ================================================================== */
CREATE TABLE advisor (
  advisor_id           SERIAL PRIMARY KEY,
  advisor_code         VARCHAR(50) UNIQUE,
  advisor_name         VARCHAR(150) NOT NULL,
  email                VARCHAR(200),
  branch               VARCHAR(100),
  region               VARCHAR(100),
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  source_system        VARCHAR(80),
  source_record_id     VARCHAR(120),
  source_as_of_date    DATE,
  ingestion_batch_id   BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE client (
  client_id              SERIAL PRIMARY KEY,
  advisor_id             INT NOT NULL REFERENCES advisor(advisor_id) ON DELETE RESTRICT,
  client_ref             VARCHAR(60),
  first_name             VARCHAR(100) NOT NULL,
  last_name              VARCHAR(100) NOT NULL,
  email                  VARCHAR(200),
  phone                  VARCHAR(20),
  date_of_birth          DATE,
  risk_profile           VARCHAR(20),
  vitality_status        VARCHAR(50),
  client_since           DATE,
  status                 VARCHAR(20) NOT NULL DEFAULT 'active',
  id_number              VARCHAR(20),
  annual_income          NUMERIC(14,2),
  target_retirement_age  INT,
  annual_income_need     NUMERIC(14,2),
  source_system          VARCHAR(80),
  source_record_id       VARCHAR(120),
  source_as_of_date      DATE,
  ingestion_batch_id     BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    risk_profile IS NULL
    OR risk_profile IN ('conservative', 'moderate', 'aggressive')
  ),
  CHECK (status IN ('active', 'dormant', 'inactive')),
  CHECK (annual_income IS NULL OR annual_income >= 0),
  CHECK (annual_income_need IS NULL OR annual_income_need >= 0),
  CHECK (
    target_retirement_age IS NULL
    OR target_retirement_age BETWEEN 40 AND 85
  )
);

CREATE TABLE product (
  product_id                SERIAL PRIMARY KEY,
  product_code              VARCHAR(60) UNIQUE,
  provider_name             VARCHAR(120) NOT NULL,
  product_name              VARCHAR(220) NOT NULL UNIQUE,
  product_family            VARCHAR(80) NOT NULL,
  product_type              VARCHAR(80) NOT NULL,
  vehicle_type              VARCHAR(80) NOT NULL,
  comparison_group          VARCHAR(120) NOT NULL,
  risk_band                 VARCHAR(32) NOT NULL,
  target_market             TEXT,
  minimum_investment        NUMERIC(18,2),
  minimum_debit_order       NUMERIC(18,2),
  default_phase             VARCHAR(20),
  initial_commission_pct    NUMERIC(10,6),
  recurring_commission_pct  NUMERIC(10,6),
  trail_commission_pct      NUMERIC(10,6),
  source_asof_date          DATE,
  eac_confidence            VARCHAR(16) NOT NULL DEFAULT 'medium',
  active                    BOOLEAN NOT NULL DEFAULT TRUE,
  source_system             VARCHAR(80),
  source_record_id          VARCHAR(120),
  ingestion_batch_id        BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    default_phase IS NULL
    OR default_phase IN ('accumulation', 'drawdown')
  ),
  CHECK (
    risk_band IN ('conservative', 'moderate', 'aggressive', 'balanced', 'income')
  ),
  CHECK (minimum_investment IS NULL OR minimum_investment >= 0),
  CHECK (minimum_debit_order IS NULL OR minimum_debit_order >= 0),
  CHECK (initial_commission_pct IS NULL OR initial_commission_pct BETWEEN 0 AND 1),
  CHECK (recurring_commission_pct IS NULL OR recurring_commission_pct BETWEEN 0 AND 1),
  CHECK (trail_commission_pct IS NULL OR trail_commission_pct BETWEEN 0 AND 1),
  CHECK (eac_confidence IN ('high', 'medium', 'low'))
);

CREATE TABLE policy (
  policy_id                  SERIAL PRIMARY KEY,
  client_id                  INT NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
  product_id                 INT REFERENCES product(product_id) ON DELETE SET NULL,
  policy_number              VARCHAR(40) NOT NULL UNIQUE,
  policy_name                VARCHAR(220),
  policy_type                VARCHAR(80) NOT NULL,
  phase                      VARCHAR(20),
  status                     VARCHAR(20) NOT NULL DEFAULT 'active',
  inception_date             DATE,
  commence_date              DATE,
  anniversary_date           DATE,
  annuity_income_review_date DATE,
  initial_investment         NUMERIC(18,2),
  current_value              NUMERIC(18,2) NOT NULL DEFAULT 0,
  units_held                 NUMERIC(18,6),
  recurring_premium          NUMERIC(18,2),
  monthly_contribution       NUMERIC(18,2),
  single_premium             NUMERIC(18,2),
  monthly_income             NUMERIC(18,2),
  drawdown_rate_pct          NUMERIC(8,4),
  beneficiary_nominated      BOOLEAN NOT NULL DEFAULT TRUE,
  as_of_date                 DATE NOT NULL,
  source_system              VARCHAR(80),
  source_record_id           VARCHAR(120),
  source_as_of_date          DATE,
  ingestion_batch_id         BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    phase IS NULL
    OR phase IN ('accumulation', 'drawdown')
  ),
  CHECK (status IN ('active', 'paid_up', 'lapsed', 'matured', 'inactive')),
  CHECK (initial_investment IS NULL OR initial_investment >= 0),
  CHECK (current_value >= 0),
  CHECK (units_held IS NULL OR units_held >= 0),
  CHECK (recurring_premium IS NULL OR recurring_premium >= 0),
  CHECK (monthly_contribution IS NULL OR monthly_contribution >= 0),
  CHECK (single_premium IS NULL OR single_premium >= 0),
  CHECK (monthly_income IS NULL OR monthly_income >= 0),
  CHECK (
    drawdown_rate_pct IS NULL
    OR (drawdown_rate_pct >= 0 AND drawdown_rate_pct <= 1)
  )
);

/* ==================================================================
   POLICY HOLDINGS / ACTIVITY / DERIVED SNAPSHOTS
   ================================================================== */
CREATE TABLE policy_fund_holding_snapshot (
  holding_id            SERIAL PRIMARY KEY,
  policy_id             INT NOT NULL REFERENCES policy(policy_id) ON DELETE CASCADE,
  fund_id               INT NOT NULL REFERENCES fund(fund_id) ON DELETE CASCADE,
  allocation_pct        NUMERIC(8,6),
  current_value         NUMERIC(18,2) NOT NULL DEFAULT 0,
  units_held            NUMERIC(18,6),
  inception_date        DATE,
  as_of_date            DATE NOT NULL,
  source_system         VARCHAR(80),
  source_record_id      VARCHAR(120),
  source_as_of_date     DATE,
  ingestion_batch_id    BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_id, fund_id, as_of_date),
  CHECK (allocation_pct IS NULL OR (allocation_pct >= 0 AND allocation_pct <= 1)),
  CHECK (current_value >= 0),
  CHECK (units_held IS NULL OR units_held >= 0)
);

CREATE TABLE transaction (
  transaction_id        SERIAL PRIMARY KEY,
  policy_id             INT NOT NULL REFERENCES policy(policy_id) ON DELETE CASCADE,
  fund_id               INT REFERENCES fund(fund_id) ON DELETE SET NULL,
  transaction_type      VARCHAR(20) NOT NULL,
  transaction_date      DATE NOT NULL,
  amount                NUMERIC(18,2) NOT NULL,
  units                 NUMERIC(18,6),
  nav_price             NUMERIC(10,4),
  status                VARCHAR(20) NOT NULL DEFAULT 'settled',
  source_system         VARCHAR(80),
  source_record_id      VARCHAR(120),
  source_as_of_date     DATE,
  ingestion_batch_id    BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    transaction_type IN ('contribution', 'withdrawal', 'switch_in', 'switch_out', 'dividend', 'fee')
  ),
  CHECK (amount >= 0),
  CHECK (units IS NULL OR units >= 0),
  CHECK (status IN ('settled', 'pending', 'failed'))
);

CREATE TABLE advisor_aum (
  aum_id                SERIAL PRIMARY KEY,
  advisor_id            INT NOT NULL REFERENCES advisor(advisor_id) ON DELETE CASCADE,
  as_of_date            DATE NOT NULL,
  total_aum             NUMERIC(18,2) NOT NULL,
  total_clients         INT NOT NULL,
  active_policies       INT NOT NULL,
  monthly_revenue       NUMERIC(18,2) NOT NULL,
  source_system         VARCHAR(80),
  source_record_id      VARCHAR(120),
  source_as_of_date     DATE,
  ingestion_batch_id    BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (advisor_id, as_of_date),
  CHECK (total_aum >= 0),
  CHECK (total_clients >= 0),
  CHECK (active_policies >= 0),
  CHECK (monthly_revenue >= 0)
);

/* ==================================================================
   PRODUCT INTELLIGENCE / OPERATIONAL TABLES
   ================================================================== */
CREATE TABLE product_cost_component (
  component_id          SERIAL PRIMARY KEY,
  product_id            INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  component_type        VARCHAR(64) NOT NULL,
  charge_basis          VARCHAR(32) NOT NULL,
  value_min             NUMERIC(10,6),
  value_max             NUMERIC(10,6),
  frequency             VARCHAR(32) NOT NULL DEFAULT 'annual',
  notes                 TEXT,
  is_included_in_eac    BOOLEAN NOT NULL DEFAULT TRUE,
  display_order         INT NOT NULL DEFAULT 1,
  source_system         VARCHAR(80),
  source_record_id      VARCHAR(120),
  source_as_of_date     DATE,
  ingestion_batch_id    BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_feature (
  feature_id            SERIAL PRIMARY KEY,
  product_id            INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  feature_key           VARCHAR(80) NOT NULL,
  feature_value         TEXT NOT NULL,
  display_label         VARCHAR(120) NOT NULL,
  source_system         VARCHAR(80),
  source_record_id      VARCHAR(120),
  source_as_of_date     DATE,
  ingestion_batch_id    BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_source (
  source_id             SERIAL PRIMARY KEY,
  product_id            INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  source_url            TEXT NOT NULL,
  document_type         VARCHAR(32) NOT NULL,
  page_ref              VARCHAR(40),
  evidence_snippet      TEXT NOT NULL,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_system         VARCHAR(80),
  source_record_id      VARCHAR(120),
  source_as_of_date     DATE,
  ingestion_batch_id    BIGINT REFERENCES ingestion_batch(ingestion_batch_id) ON DELETE SET NULL,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE communication_drafts (
  draft_id              SERIAL PRIMARY KEY,
  client_id             INT NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
  advisor_id            INT NOT NULL REFERENCES advisor(advisor_id) ON DELETE CASCADE,
  draft_type            VARCHAR(32) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft',
  subject               TEXT NOT NULL,
  body                  TEXT NOT NULL,
  attachment_metadata   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (draft_type IN ('email', 'meeting_request')),
  CHECK (status IN ('draft', 'ready', 'sent', 'archived'))
);

CREATE TABLE dashboard_insights (
  insight_key           VARCHAR(200) PRIMARY KEY,
  advisor_id            INT REFERENCES advisor(advisor_id) ON DELETE CASCADE,
  data                  JSONB NOT NULL,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* ==================================================================
   INDEXES
   ================================================================== */
CREATE INDEX idx_sector_name ON sector(sector_name);
CREATE INDEX idx_peer_group_sector ON peer_group(sector_id);
CREATE INDEX idx_fund_peer_group ON fund(peer_group_id);
CREATE INDEX idx_fund_sector ON fund(sector_id);
CREATE INDEX idx_fund_perf_period_lookup ON fund_performance_fact(fund_id, period_id, as_of_date);
CREATE INDEX idx_fund_risk_period_lookup ON fund_risk_fact(fund_id, period_id, as_of_date);
CREATE INDEX idx_fund_flow_period_lookup ON fund_flow_fact(fund_id, period_id, as_of_date);
CREATE INDEX idx_fund_ranking_period_lookup ON fund_ranking_fact(fund_id, period_id, as_of_date);
CREATE INDEX idx_peer_group_stat_lookup ON peer_group_stat_fact(peer_group_id, period_id, as_of_date);

CREATE INDEX idx_advisor_name ON advisor(advisor_name);
CREATE INDEX idx_client_advisor_status ON client(advisor_id, status);
CREATE INDEX idx_client_name ON client(last_name, first_name);
CREATE INDEX idx_product_vehicle_type ON product(vehicle_type);
CREATE INDEX idx_product_comparison_group ON product(comparison_group, active);
CREATE INDEX idx_policy_client_asof ON policy(client_id, as_of_date);
CREATE INDEX idx_policy_product ON policy(product_id);
CREATE INDEX idx_policy_type_status ON policy(policy_type, status);
CREATE INDEX idx_policy_phase ON policy(phase);
CREATE INDEX idx_policy_holding_policy_asof ON policy_fund_holding_snapshot(policy_id, as_of_date);
CREATE INDEX idx_policy_holding_fund_asof ON policy_fund_holding_snapshot(fund_id, as_of_date);
CREATE INDEX idx_transaction_policy_date ON transaction(policy_id, transaction_date DESC);
CREATE INDEX idx_transaction_date ON transaction(transaction_date DESC);
CREATE INDEX idx_advisor_aum_advisor_asof ON advisor_aum(advisor_id, as_of_date DESC);
CREATE INDEX idx_product_cost_component_product_idx ON product_cost_component(product_id, display_order);
CREATE INDEX idx_product_feature_product_idx ON product_feature(product_id);
CREATE INDEX idx_product_source_product_idx ON product_source(product_id);
CREATE INDEX idx_comm_drafts_client_updated ON communication_drafts(client_id, updated_at DESC);
CREATE INDEX idx_comm_drafts_advisor_status ON communication_drafts(advisor_id, status);
CREATE INDEX idx_dashboard_insights_advisor_generated ON dashboard_insights(advisor_id, generated_at DESC);

COMMIT;
