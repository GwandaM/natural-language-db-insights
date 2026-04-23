-- Migration: 001_initial_db_tables
-- Author:   GwandaM
-- Date:     2026-04-23
--
-- Summary:
--   Reset the public schema and lay down the new Investment Advisor CRM
--   schema: client/policy book, ASISA fund reference data, time-series fund
--   snapshots (performance/risk/flow), policy metrics snapshots, and
--   policy-level fund holdings. This replaces the older wrapper/advisor/
--   transaction/fact-table design entirely.
--
-- Rollback:
--   Forward-only. To undo, write a new migration that drops these tables
--   and restores the previous schema from seed.
--
-- Notes:
--   The GLOBAL RESET block drops ALL tables in the public schema (hard reset).
--   Do NOT apply this migration to a database that contains data you want
--   to keep.

BEGIN;

/* ==================================================================
   GLOBAL RESET
   Drops ALL existing public tables (hard reset)
   ================================================================== */
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
  END LOOP;
END $$;

/* ==================================================================
   DOMAIN: CLIENT & POLICY (Adviser Book)
   ================================================================== */
CREATE TABLE client (
  client_id       SERIAL PRIMARY KEY,

  investor_entity VARCHAR(30) NOT NULL UNIQUE,

  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  date_of_birth   DATE,

  risk_profile    VARCHAR(50),
  vitality_status VARCHAR(50)
);

CREATE TABLE policy (
  policy_id                  SERIAL PRIMARY KEY,

  client_id                  INT NOT NULL REFERENCES client(client_id),

  policy_number              VARCHAR(40) NOT NULL UNIQUE,

  product_name               VARCHAR(100),
  policy_status              VARCHAR(30),

  commence_date              DATE,
  anniversary_date           DATE,
  annuity_income_review_date DATE,

  recurring_premium          NUMERIC(18,2),
  single_premium             NUMERIC(18,2),

  drawdown_rate_pct          NUMERIC(8,4),

  total_current_value        NUMERIC(20,2),

  as_of_date                 DATE NOT NULL
);

/* ---- Policy-level derived metrics (snapshot-based) ---- */
CREATE TABLE policy_metrics_snapshot (
  policy_metrics_id           SERIAL PRIMARY KEY,

  policy_id                   INT NOT NULL REFERENCES policy(policy_id),

  as_of_date                  DATE NOT NULL,

  irr_pct                     NUMERIC(12,8),
  lpo                         NUMERIC(20,2),
  fee_payback                 NUMERIC(20,2),
  retirement_payback_booster  NUMERIC(20,2),
  ruii                        NUMERIC(20,2),
  contribution_boost          NUMERIC(20,2),

  UNIQUE (policy_id, as_of_date)
);

/* ==================================================================
   DOMAIN: FUND REFERENCE (ASISA MASTER DATA)
   ================================================================== */
CREATE TABLE asisa_category (
  asisa_category_id SERIAL PRIMARY KEY,
  category_name     VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE peer_group (
  peer_group_id     SERIAL PRIMARY KEY,

  peer_group_name   VARCHAR(200) NOT NULL,
  display_group_name VARCHAR(200),

  asisa_category_id INT REFERENCES asisa_category(asisa_category_id)
);

CREATE TABLE fund (
  fund_id                    SERIAL PRIMARY KEY,

  isin                       VARCHAR(20) NOT NULL UNIQUE,
  ticker                     VARCHAR(30),

  fund_name                  VARCHAR(300) NOT NULL,

  inception_date             DATE,

  management_fee             NUMERIC(10,6),
  net_expense_ratio          NUMERIC(10,6),

  morningstar_rating_overall NUMERIC(4,2),

  peer_group_id              INT REFERENCES peer_group(peer_group_id)
);

/* ==================================================================
   DOMAIN: FUND SNAPSHOTS (ASISA TIME-SERIES DATA)
   ================================================================== */

/* ---- Performance & ranking by period ---- */
CREATE TABLE fund_performance_snapshot (
  fund_performance_id SERIAL PRIMARY KEY,

  fund_id             INT NOT NULL REFERENCES fund(fund_id),

  as_of_date          DATE NOT NULL,
  period_code         VARCHAR(12) NOT NULL, -- 1M, 3M, 6M, 1Y, 3Y, 5Y, SI, etc.

  return_annualized   NUMERIC(10,6),
  return_cumulative   NUMERIC(10,6),

  best_month          NUMERIC(10,6),
  worst_month         NUMERIC(10,6),

  r_squared           NUMERIC(10,6),

  peer_group_rank     INT,
  peer_group_quartile INT,

  UNIQUE (fund_id, as_of_date, period_code)
);

/* ---- Risk statistics by period ---- */
CREATE TABLE fund_risk_snapshot (
  fund_risk_id         SERIAL PRIMARY KEY,

  fund_id              INT NOT NULL REFERENCES fund(fund_id),

  as_of_date           DATE NOT NULL,
  period_code          VARCHAR(12) NOT NULL,

  std_dev_annualized   NUMERIC(10,6),
  sharpe_ratio         NUMERIC(10,6),
  sortino_ratio        NUMERIC(10,6),
  treynor_ratio        NUMERIC(10,6),
  tracking_error       NUMERIC(10,6),

  up_capture_ratio     NUMERIC(10,6),
  up_percent_ratio     NUMERIC(10,6),
  down_capture_ratio   NUMERIC(10,6),
  down_percent_ratio   NUMERIC(10,6),

  UNIQUE (fund_id, as_of_date, period_code)
);

/* ---- Fund flows & size ---- */
CREATE TABLE fund_flow_snapshot (
  fund_flow_id            SERIAL PRIMARY KEY,

  fund_id                 INT NOT NULL REFERENCES fund(fund_id),

  as_of_date              DATE NOT NULL,

  fund_size               NUMERIC(20,2),

  estimated_net_flow_1m   NUMERIC(20,2),
  estimated_net_flow_3m   NUMERIC(20,2),
  estimated_net_flow_6m   NUMERIC(20,2),
  estimated_net_flow_ytd  NUMERIC(20,2),
  estimated_net_flow_1y   NUMERIC(20,2),
  estimated_net_flow_3y   NUMERIC(20,2),
  estimated_net_flow_5y   NUMERIC(20,2),

  UNIQUE (fund_id, as_of_date)
);

/* ==================================================================
   DOMAIN: POLICY-FUND HOLDINGS (Adviser Book)
   ================================================================== */
CREATE TABLE policy_fund_holding_snapshot (
  holding_id  SERIAL PRIMARY KEY,

  policy_id   INT NOT NULL REFERENCES policy(policy_id),
  fund_id     INT NOT NULL REFERENCES fund(fund_id),

  fund_value  NUMERIC(20,2),

  as_of_date  DATE NOT NULL,

  UNIQUE (policy_id, fund_id, as_of_date)
);

/* ==================================================================
   PERFORMANCE & INTEGRITY INDEXES
   ================================================================== */
CREATE INDEX idx_policy_client        ON policy(client_id);
CREATE INDEX idx_policy_asof          ON policy(as_of_date);
CREATE INDEX idx_policy_metrics_policy ON policy_metrics_snapshot(policy_id);
CREATE INDEX idx_fund_peer_group      ON fund(peer_group_id);
CREATE INDEX idx_fund_perf_lookup
  ON fund_performance_snapshot(fund_id, as_of_date, period_code);
CREATE INDEX idx_fund_risk_lookup
  ON fund_risk_snapshot(fund_id, as_of_date, period_code);
CREATE INDEX idx_fund_flow_lookup
  ON fund_flow_snapshot(fund_id, as_of_date);
CREATE INDEX idx_policy_fund_lookup
  ON policy_fund_holding_snapshot(policy_id, fund_id, as_of_date);

COMMIT;
