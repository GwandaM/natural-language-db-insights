import { sql } from "@vercel/postgres";
import { pathToFileURL } from "url";
import "dotenv/config";

// Deterministic pseudo-random number in [0, 1)
function prand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function rng(min: number, max: number, seed: number): number {
  return +(min + prand(seed) * (max - min)).toFixed(6);
}

// ---------------------------------------------------------------------------
// Exported helper — called by the refresh-insights API route
// ---------------------------------------------------------------------------
export async function createDashboardInsightsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_insights (
      insight_key  VARCHAR(100) PRIMARY KEY,
      data         JSONB        NOT NULL,
      generated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `;
  console.log('Created "dashboard_insights" table');
}

// ---------------------------------------------------------------------------
// Drop all tables (reverse FK order)
// ---------------------------------------------------------------------------
async function dropAllTables() {
  const tables = [
    "transaction", "advisor_aum", "policy", "client", "advisor",
    "peer_group_stat_fact", "fund_ranking_fact", "fund_flow_fact",
    "fund_risk_fact", "fund_performance_fact", "fund",
    "period_definition", "peer_group", "sector",
    "dashboard_insights", "unicorns",
  ];
  for (const t of tables) {
    await sql.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    console.log(`Dropped table: ${t}`);
  }
}

// ---------------------------------------------------------------------------
// Create all tables (forward FK order)
// ---------------------------------------------------------------------------
async function createAllTables() {
  await sql`
    CREATE TABLE sector (
      sector_id       INT PRIMARY KEY,
      sector_name     VARCHAR(100),
      asisa_category  VARCHAR(100)
    )`;
  console.log("Created sector");

  await sql`
    CREATE TABLE peer_group (
      peer_group_id       INT PRIMARY KEY,
      peer_group_name     VARCHAR(200),
      display_group_name  VARCHAR(200),
      sector_id           INT REFERENCES sector(sector_id)
    )`;
  console.log("Created peer_group");

  await sql`
    CREATE TABLE period_definition (
      period_id      INT PRIMARY KEY,
      period_code    VARCHAR(10),
      period_type    VARCHAR(30),
      end_date       DATE,
      is_annualized  BOOLEAN,
      display_order  INT
    )`;
  console.log("Created period_definition");

  await sql`
    CREATE TABLE fund (
      fund_id                    INT PRIMARY KEY,
      fund_name                  VARCHAR(300),
      isin                       VARCHAR(20) UNIQUE,
      ticker                     VARCHAR(20),
      inception_date             DATE,
      management_fee             DECIMAL(6,4),
      net_expense_ratio          DECIMAL(6,4),
      fund_size                  DECIMAL(18,2),
      morningstar_rating_overall DECIMAL(3,1),
      peer_group_id              INT REFERENCES peer_group(peer_group_id),
      sector_id                  INT REFERENCES sector(sector_id),
      source_asof_date           DATE
    )`;
  console.log("Created fund");

  await sql`
    CREATE TABLE fund_performance_fact (
      fund_perf_id        SERIAL PRIMARY KEY,
      fund_id             INT REFERENCES fund(fund_id),
      period_id           INT REFERENCES period_definition(period_id),
      as_of_date          DATE,
      return_annualized   DECIMAL(10,6),
      return_cumulative   DECIMAL(10,6),
      best_month          DECIMAL(10,6),
      worst_month         DECIMAL(10,6),
      up_capture_ratio    DECIMAL(10,4),
      down_capture_ratio  DECIMAL(10,4),
      up_percent_ratio    DECIMAL(10,4),
      down_percent_ratio  DECIMAL(10,4),
      r_squared           DECIMAL(10,6)
    )`;
  console.log("Created fund_performance_fact");

  await sql`
    CREATE TABLE fund_risk_fact (
      fund_risk_id              SERIAL PRIMARY KEY,
      fund_id                   INT REFERENCES fund(fund_id),
      period_id                 INT REFERENCES period_definition(period_id),
      as_of_date                DATE,
      std_dev_annualized        DECIMAL(10,6),
      sharpe_ratio_annualized   DECIMAL(10,6),
      sortino_ratio_annualized  DECIMAL(10,6),
      treynor_ratio_annualized  DECIMAL(10,6),
      tracking_error_annualized DECIMAL(10,6)
    )`;
  console.log("Created fund_risk_fact");

  await sql`
    CREATE TABLE fund_flow_fact (
      fund_flow_id        SERIAL PRIMARY KEY,
      fund_id             INT REFERENCES fund(fund_id),
      period_id           INT REFERENCES period_definition(period_id),
      as_of_date          DATE,
      estimated_net_flow  DECIMAL(18,2),
      fund_size           DECIMAL(18,2)
    )`;
  console.log("Created fund_flow_fact");

  await sql`
    CREATE TABLE fund_ranking_fact (
      fund_ranking_id          SERIAL PRIMARY KEY,
      fund_id                  INT REFERENCES fund(fund_id),
      period_id                INT REFERENCES period_definition(period_id),
      peer_group_id            INT REFERENCES peer_group(peer_group_id),
      as_of_date               DATE,
      peer_group_rank          INT,
      peer_group_quartile      INT,
      investments_ranked_count INT
    )`;
  console.log("Created fund_ranking_fact");

  await sql`
    CREATE TABLE peer_group_stat_fact (
      peer_group_stat_id  SERIAL PRIMARY KEY,
      peer_group_id       INT REFERENCES peer_group(peer_group_id),
      period_id           INT REFERENCES period_definition(period_id),
      as_of_date          DATE,
      metric_name         VARCHAR(100),
      stat_type           VARCHAR(50),
      metric_value        DECIMAL(18,6)
    )`;
  console.log("Created peer_group_stat_fact");

  await sql`
    CREATE TABLE advisor (
      advisor_id    SERIAL PRIMARY KEY,
      advisor_name  VARCHAR(100),
      email         VARCHAR(200),
      branch        VARCHAR(100),
      region        VARCHAR(100)
    )`;
  console.log("Created advisor");

  await sql`
    CREATE TABLE client (
      client_id     SERIAL PRIMARY KEY,
      advisor_id    INT REFERENCES advisor(advisor_id),
      first_name    VARCHAR(100),
      last_name     VARCHAR(100),
      email         VARCHAR(200),
      phone         VARCHAR(20),
      date_of_birth DATE,
      risk_profile  VARCHAR(20),
      client_since  DATE,
      status        VARCHAR(20),
      id_number     VARCHAR(20)
    )`;
  console.log("Created client");

  await sql`
    CREATE TABLE policy (
      policy_id          SERIAL PRIMARY KEY,
      client_id          INT REFERENCES client(client_id),
      policy_number      VARCHAR(30) UNIQUE,
      policy_type        VARCHAR(30),
      fund_id            INT REFERENCES fund(fund_id),
      inception_date     DATE,
      status             VARCHAR(20),
      initial_investment DECIMAL(18,2),
      current_value      DECIMAL(18,2),
      units_held         DECIMAL(18,6),
      as_of_date         DATE
    )`;
  console.log("Created policy");

  await sql`
    CREATE TABLE transaction (
      transaction_id    SERIAL PRIMARY KEY,
      policy_id         INT REFERENCES policy(policy_id),
      fund_id           INT REFERENCES fund(fund_id),
      transaction_type  VARCHAR(20),
      transaction_date  DATE,
      amount            DECIMAL(18,2),
      units             DECIMAL(18,6),
      nav_price         DECIMAL(10,4),
      status            VARCHAR(20)
    )`;
  console.log("Created transaction");

  await sql`
    CREATE TABLE advisor_aum (
      aum_id           SERIAL PRIMARY KEY,
      advisor_id       INT REFERENCES advisor(advisor_id),
      as_of_date       DATE,
      total_aum        DECIMAL(18,2),
      total_clients    INT,
      active_policies  INT,
      monthly_revenue  DECIMAL(18,2)
    )`;
  console.log("Created advisor_aum");

  await createDashboardInsightsTable();
}

// ---------------------------------------------------------------------------
// Sector base data (for fact generation)
// ---------------------------------------------------------------------------
// Base 1Y annualized return by sector_id
const BASE_1Y: Record<number, number> = {
  1: 0.135, // SA Equity
  2: 0.093, // Fixed Income
  3: 0.110, // Multi-Asset
  4: 0.078, // Money Market
  5: 0.085, // Real Estate
};
// Annualized std_dev range [min, max] by sector_id
const STD_RANGE: Record<number, [number, number]> = {
  1: [0.130, 0.210],
  2: [0.035, 0.075],
  3: [0.075, 0.140],
  4: [0.003, 0.008],
  5: [0.120, 0.190],
};
// Cumulative-years equivalent per period_id
const CUMUL_YEARS: Record<number, number> = {
  1: 1 / 12, 2: 3 / 12, 3: 6 / 12, 4: 1, 5: 3, 6: 5, 7: 10, 8: 12,
};
// Map fund_id → sector_id
const FUND_SECTOR: Record<number, number> = {
  1:1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1, 8:1, 9:1, 10:1,
  11:3, 12:3, 13:3, 14:3, 15:3, 16:3, 17:3, 18:3, 19:3,
  20:2, 21:2, 22:2, 23:2, 24:2,
  25:4, 26:4, 27:4,
  28:5, 29:5, 30:5,
};
// Map fund_id → peer_group_id
const FUND_PG: Record<number, number> = {
  1:1,2:1,3:1,4:1,5:1, 6:2,7:2,8:2, 9:10,10:10,
  11:3,12:3,13:3,14:3, 15:4,16:4,17:4, 18:5,19:5,
  20:6,21:6,22:6, 23:7,24:7,
  25:8,26:8,27:8, 28:9,29:9,30:9,
};
// Baseline rank within peer group
const FUND_PG_RANK: Record<number, number> = {
  1:1,2:2,3:3,4:4,5:5, 6:1,7:2,8:3, 9:1,10:2,
  11:1,12:2,13:3,14:4, 15:1,16:2,17:3, 18:1,19:2,
  20:1,21:2,22:3, 23:1,24:2,
  25:1,26:2,27:3, 28:1,29:2,30:3,
};
// Peer group total fund count
const PG_FUND_COUNT: Record<number, number> = {
  1:5, 2:3, 3:4, 4:3, 5:2, 6:3, 7:2, 8:3, 9:3, 10:2,
};
// Base fund size (ZAR) for flow calculations
const FUND_SIZE_ZAR: Record<number, number> = {
  1:45e9,2:28e9,3:15e9,4:8e9,5:3.5e9,6:12e9,7:20e9,8:9e9,9:4e9,10:2.5e9,
  11:65e9,12:40e9,13:10e9,14:18e9,15:25e9,16:8e9,17:6e9,18:5e9,19:3e9,
  20:5e9,21:8e9,22:4e9,23:3.5e9,24:2e9,
  25:30e9,26:25e9,27:20e9,
  28:2e9,29:1.5e9,30:0.8e9,
};

// ---------------------------------------------------------------------------
// Seeding functions
// ---------------------------------------------------------------------------

async function seedSectors() {
  const rows = [
    [1, "SA Equity",    "Domestic Equity"],
    [2, "Fixed Income", "Domestic Fixed Interest"],
    [3, "Multi-Asset",  "Domestic Asset Allocation"],
    [4, "Money Market", "Domestic Money Market"],
    [5, "Real Estate",  "Domestic Real Estate"],
  ] as const;
  for (const [id, name, cat] of rows) {
    await sql`INSERT INTO sector VALUES (${id}, ${name}, ${cat})`;
  }
  console.log(`Seeded ${rows.length} sectors`);
}

async function seedPeerGroups() {
  const rows = [
    [1,  "SA Equity General",              "SA Equity General",    1],
    [2,  "SA Equity Large Cap",            "SA Equity Large Cap",  1],
    [3,  "SA Multi-Asset High Equity",     "SA MA High Equity",    3],
    [4,  "SA Multi-Asset Medium Equity",   "SA MA Medium Equity",  3],
    [5,  "SA Multi-Asset Low Equity",      "SA MA Low Equity",     3],
    [6,  "SA Bonds All Bond",              "SA Bonds",             2],
    [7,  "SA Interest Bearing Short Term", "SA Short Term",        2],
    [8,  "SA Money Market",                "SA Money Market",      4],
    [9,  "SA Real Estate General",         "SA Real Estate",       5],
    [10, "SA Equity Mid and Small Cap",    "SA Mid and Small Cap", 1],
  ] as const;
  for (const [id, name, disp, sid] of rows) {
    await sql`INSERT INTO peer_group VALUES (${id}, ${name}, ${disp}, ${sid})`;
  }
  console.log(`Seeded ${rows.length} peer groups`);
}

async function seedPeriodDefinitions() {
  const rows = [
    [1, "1M",  "calendar_month",     "2024-12-31", false, 1],
    [2, "3M",  "calendar_quarter",   "2024-12-31", false, 2],
    [3, "6M",  "calendar_half_year", "2024-12-31", false, 3],
    [4, "1Y",  "trailing_1_year",    "2024-12-31", true,  4],
    [5, "3Y",  "trailing_3_year",    "2024-12-31", true,  5],
    [6, "5Y",  "trailing_5_year",    "2024-12-31", true,  6],
    [7, "10Y", "trailing_10_year",   "2024-12-31", true,  7],
    [8, "SI",  "since_inception",    "2024-12-31", true,  8],
  ] as const;
  for (const [id, code, type, end, ann, ord] of rows) {
    await sql`INSERT INTO period_definition VALUES (${id}, ${code}, ${type}, ${end}, ${ann}, ${ord})`;
  }
  console.log(`Seeded ${rows.length} period definitions`);
}

async function seedFunds() {
  // [id, name, isin, ticker, inception, mgmt_fee, ner, fund_size, ms_rating, pg_id, sector_id]
  const funds = [
    // SA Equity General (pg=1, sector=1)
    [1,  "Allan Gray Equity Fund",          "ZA000AGEF0001", "AGEF",   "1973-10-01", 0.0085, 0.0098, 45000000000, 4.5, 1,  1],
    [2,  "Coronation Equity Fund",          "ZA000COEF0001", "COEF",   "1993-07-01", 0.0115, 0.0132, 28000000000, 4.0, 1,  1],
    [3,  "Ninety One SA Equity Fund",       "ZA000NISEF001", "NISEF",  "2000-11-01", 0.0100, 0.0118, 15000000000, 3.5, 1,  1],
    [4,  "Foord Equity Fund",               "ZA000FOEF0001", "FOEF",   "1994-09-01", 0.0090, 0.0106,  8000000000, 3.5, 1,  1],
    [5,  "PSG Equity Fund",                 "ZA000PSGEF001", "PSGEF",  "2000-10-01", 0.0095, 0.0110,  3500000000, 3.0, 1,  1],
    // SA Equity Large Cap (pg=2, sector=1)
    [6,  "Stanlib Large Cap Fund",          "ZA000STLCF001", "STLCF",  "1999-01-15", 0.0080, 0.0095, 12000000000, 3.5, 2,  1],
    [7,  "Old Mutual Top 40 Fund",          "ZA000OMTF0001", "OMTF",   "1998-06-01", 0.0070, 0.0082, 20000000000, 3.0, 2,  1],
    [8,  "Absa Large Cap Fund",             "ZA000ALCF0001", "ALCF",   "2001-03-01", 0.0075, 0.0088,  9000000000, 3.0, 2,  1],
    // SA Mid and Small Cap (pg=10, sector=1)
    [9,  "Fairtree Equity Prescient Fund",  "ZA000FTEF0001", "FTEF",   "2008-01-01", 0.0130, 0.0155,  4000000000, 4.0, 10, 1],
    [10, "36ONE Equity Fund",               "ZA000ONEF0001", "36EF",   "2009-03-01", 0.0140, 0.0165,  2500000000, 3.5, 10, 1],
    // SA Multi-Asset High Equity (pg=3, sector=3)
    [11, "Allan Gray Balanced Fund",        "ZA000AGBL0001", "AGBAL",  "1999-10-01", 0.0085, 0.0101, 65000000000, 5.0, 3,  3],
    [12, "Coronation Balanced Plus Fund",   "ZA000COBP0001", "COBP",   "1996-04-01", 0.0110, 0.0128, 40000000000, 4.5, 3,  3],
    [13, "Ninety One Opportunity Fund",     "ZA000NIOP0001", "NIOP",   "2006-06-01", 0.0100, 0.0118, 10000000000, 4.0, 3,  3],
    [14, "Prudential Balanced Fund",        "ZA000PRBL0001", "PRBAL",  "1999-01-01", 0.0095, 0.0110, 18000000000, 4.0, 3,  3],
    // SA Multi-Asset Medium Equity (pg=4, sector=3)
    [15, "Old Mutual Balanced Fund",        "ZA000OMBL0001", "OMBAL",  "1998-01-01", 0.0080, 0.0095, 25000000000, 3.5, 4,  3],
    [16, "Sanlam Balanced Fund",            "ZA000SLBL0001", "SLBAL",  "2002-01-01", 0.0090, 0.0107,  8000000000, 3.0, 4,  3],
    [17, "Momentum Balanced Fund",          "ZA000MOBL0001", "MOBAL",  "2001-07-01", 0.0085, 0.0100,  6000000000, 3.0, 4,  3],
    // SA Multi-Asset Low Equity (pg=5, sector=3)
    [18, "Stanlib Stable Plus Fund",        "ZA000STSP0001", "STSP",   "2005-01-01", 0.0070, 0.0082,  5000000000, 3.0, 5,  3],
    [19, "Discovery Stable Growth Fund",    "ZA000DISG0001", "DISG",   "2010-01-01", 0.0080, 0.0095,  3000000000, 3.0, 5,  3],
    // SA Bonds (pg=6, sector=2)
    [20, "Allan Gray Bond Fund",            "ZA000AGBF0001", "AGBF",   "2004-10-01", 0.0045, 0.0052,  5000000000, 4.0, 6,  2],
    [21, "Coronation Bond Fund",            "ZA000COBF0001", "COBF",   "1993-09-01", 0.0050, 0.0058,  8000000000, 4.5, 6,  2],
    [22, "Ninety One Bond Fund",            "ZA000NIBF0001", "NIBF",   "2001-01-01", 0.0045, 0.0053,  4000000000, 3.5, 6,  2],
    // SA Short Term (pg=7, sector=2)
    [23, "Stanlib Short Term Bond Fund",    "ZA000STSTB001", "STSTBF", "2003-01-01", 0.0040, 0.0046,  3500000000, 3.5, 7,  2],
    [24, "Absa Short Term Bond Fund",       "ZA000ASTBF001", "ASTBF",  "2005-06-01", 0.0038, 0.0044,  2000000000, 3.0, 7,  2],
    // SA Money Market (pg=8, sector=4)
    [25, "Nedbank Money Market Fund",       "ZA000NMMF0001", "NMMF",   "1995-01-01", 0.0025, 0.0028, 30000000000, 3.0, 8,  4],
    [26, "Absa Money Market Fund",          "ZA000AMMF0001", "AMMF",   "1998-03-01", 0.0020, 0.0023, 25000000000, 3.0, 8,  4],
    [27, "Standard Bank Money Market Fund", "ZA000SBMMF001", "SBMMF",  "1997-07-01", 0.0022, 0.0025, 20000000000, 3.0, 8,  4],
    // SA Real Estate (pg=9, sector=5)
    [28, "Coronation Property Equity Fund", "ZA000COPF0001", "COPF",   "2010-01-01", 0.0080, 0.0095,  2000000000, 3.0, 9,  5],
    [29, "Stanlib Property Fund",           "ZA000STPF0001", "STPF",   "2008-06-01", 0.0085, 0.0100,  1500000000, 2.5, 9,  5],
    [30, "Absa Property Equity Fund",       "ZA000ABPF0001", "ABPF",   "2012-01-01", 0.0075, 0.0088,   800000000, 2.5, 9,  5],
  ] as const;

  for (const [id, name, isin, ticker, inc, fee, ner, size, rat, pgid, sid] of funds) {
    await sql`
      INSERT INTO fund VALUES (
        ${id}, ${name}, ${isin}, ${ticker}, ${inc},
        ${fee}, ${ner}, ${size}, ${rat}, ${pgid}, ${sid}, '2024-12-31'
      )`;
  }
  console.log(`Seeded ${funds.length} funds`);
}

async function seedFundPerformanceFacts() {
  let count = 0;
  for (let fundId = 1; fundId <= 30; fundId++) {
    const sectorId = FUND_SECTOR[fundId];
    const base1Y   = BASE_1Y[sectorId];
    const fundAdj  = (prand(fundId * 17) - 0.5) * 0.06;

    for (let periodId = 1; periodId <= 8; periodId++) {
      const ann     = +(base1Y + fundAdj + (prand(fundId * 31 + periodId * 7) - 0.5) * 0.02).toFixed(6);
      const years   = CUMUL_YEARS[periodId];
      const cumul   = periodId <= 3
        ? +(ann * years).toFixed(6)
        : +(Math.pow(1 + ann, years) - 1).toFixed(6);
      const best    = +(Math.abs(ann) / 12 + prand(fundId * 43 + periodId * 3) * 0.04).toFixed(6);
      const worst   = -(prand(fundId * 53 + periodId * 11) * 0.06 + 0.005).toFixed(6);
      const upCap   = rng(0.75, 1.15, fundId * 61 + periodId * 13);
      const downCap = rng(0.65, 1.10, fundId * 67 + periodId * 17);
      const upPct   = rng(0.50, 0.75, fundId * 71 + periodId * 19);
      const downPct = rng(0.30, 0.60, fundId * 79 + periodId * 23);
      const rSq     = rng(0.70, 0.99, fundId * 83 + periodId * 29);

      await sql`
        INSERT INTO fund_performance_fact
          (fund_id, period_id, as_of_date, return_annualized, return_cumulative,
           best_month, worst_month, up_capture_ratio, down_capture_ratio,
           up_percent_ratio, down_percent_ratio, r_squared)
        VALUES (
          ${fundId}, ${periodId}, '2024-12-31',
          ${ann}, ${cumul}, ${best}, ${worst},
          ${upCap}, ${downCap}, ${upPct}, ${downPct}, ${rSq}
        )`;
      count++;
    }
  }
  console.log(`Seeded ${count} fund_performance_fact rows`);
}

async function seedFundRiskFacts() {
  const riskFreeRate = 0.073;
  let count = 0;
  for (let fundId = 1; fundId <= 30; fundId++) {
    const sectorId = FUND_SECTOR[fundId];
    const [stdMin, stdMax] = STD_RANGE[sectorId];
    const base1Y   = BASE_1Y[sectorId];
    const fundAdj  = (prand(fundId * 17) - 0.5) * 0.06;

    for (let periodId = 1; periodId <= 8; periodId++) {
      const annReturn = base1Y + fundAdj + (prand(fundId * 31 + periodId * 7) - 0.5) * 0.02;
      const stdDev    = rng(stdMin, stdMax, fundId * 89 + periodId * 37);
      const excessRet = annReturn - riskFreeRate;
      const sharpe    = +(excessRet / Math.max(stdDev, 0.001)).toFixed(6);
      const sortino   = +(sharpe * rng(1.0, 1.4, fundId * 97 + periodId * 41)).toFixed(6);
      const treynor   = +(excessRet * rng(0.08, 0.18, fundId * 101 + periodId * 43)).toFixed(6);
      const trackErr  = rng(stdMin * 0.2, stdMin * 0.9, fundId * 107 + periodId * 47);

      await sql`
        INSERT INTO fund_risk_fact
          (fund_id, period_id, as_of_date, std_dev_annualized, sharpe_ratio_annualized,
           sortino_ratio_annualized, treynor_ratio_annualized, tracking_error_annualized)
        VALUES (
          ${fundId}, ${periodId}, '2024-12-31',
          ${stdDev}, ${sharpe}, ${sortino}, ${treynor}, ${trackErr}
        )`;
      count++;
    }
  }
  console.log(`Seeded ${count} fund_risk_fact rows`);
}

async function seedFundFlowFacts() {
  let count = 0;
  for (let fundId = 1; fundId <= 30; fundId++) {
    const baseSize = FUND_SIZE_ZAR[fundId];
    for (let periodId = 1; periodId <= 8; periodId++) {
      const flowPct  = (prand(fundId * 113 + periodId * 53) - 0.3) * 0.15;
      const netFlow  = +(baseSize * flowPct).toFixed(2);
      const sizeMult = 1 + (prand(fundId * 127 + periodId * 59) - 0.5) * 0.2;
      const fundSize = +(baseSize * sizeMult).toFixed(2);

      await sql`
        INSERT INTO fund_flow_fact (fund_id, period_id, as_of_date, estimated_net_flow, fund_size)
        VALUES (${fundId}, ${periodId}, '2024-12-31', ${netFlow}, ${fundSize})`;
      count++;
    }
  }
  console.log(`Seeded ${count} fund_flow_fact rows`);
}

async function seedFundRankingFacts() {
  let count = 0;
  for (let fundId = 1; fundId <= 30; fundId++) {
    const pgId     = FUND_PG[fundId];
    const pgTotal  = PG_FUND_COUNT[pgId];
    const baseRank = FUND_PG_RANK[fundId];

    for (let periodId = 1; periodId <= 8; periodId++) {
      const variation = Math.round((prand(fundId * 131 + periodId * 61) - 0.5) * 1);
      const rank      = Math.max(1, Math.min(pgTotal, baseRank + variation));
      const quartile  = Math.ceil((rank / pgTotal) * 4);
      const totalInPg = pgTotal + Math.round(prand(pgId * 137 + periodId * 67) * 5);

      await sql`
        INSERT INTO fund_ranking_fact
          (fund_id, period_id, peer_group_id, as_of_date,
           peer_group_rank, peer_group_quartile, investments_ranked_count)
        VALUES (
          ${fundId}, ${periodId}, ${pgId}, '2024-12-31',
          ${rank}, ${quartile}, ${totalInPg}
        )`;
      count++;
    }
  }
  console.log(`Seeded ${count} fund_ranking_fact rows`);
}

async function seedPeerGroupStatFacts() {
  const metrics = ["return_annualized", "std_dev_annualized", "sharpe_ratio_annualized"];
  const metricBase: Record<string, Record<number, [number, number]>> = {
    return_annualized: {
      1:[0.09,0.18],2:[0.08,0.15],3:[0.06,0.13],4:[0.05,0.11],5:[0.04,0.09],
      6:[0.06,0.13],7:[0.05,0.11],8:[0.06,0.09],9:[0.03,0.10],10:[0.08,0.16],
    },
    std_dev_annualized: {
      1:[0.14,0.20],2:[0.12,0.18],3:[0.09,0.15],4:[0.07,0.13],5:[0.05,0.10],
      6:[0.04,0.08],7:[0.02,0.05],8:[0.003,0.008],9:[0.13,0.20],10:[0.14,0.22],
    },
    sharpe_ratio_annualized: {
      1:[0.1,0.8],2:[0.2,0.9],3:[0.3,1.0],4:[0.3,1.1],5:[0.4,1.3],
      6:[0.3,0.9],7:[0.5,1.2],8:[0.6,1.5],9:[0.1,0.7],10:[0.2,0.9],
    },
  };
  const statTypes = ["median", "top_quartile", "bottom_quartile"];
  let count = 0;

  for (let pgId = 1; pgId <= 10; pgId++) {
    for (let periodId = 1; periodId <= 8; periodId++) {
      for (const metric of metrics) {
        const [lo, hi] = metricBase[metric][pgId];
        const median   = rng(lo, hi, pgId * 139 + periodId * 71 + metric.length);
        const spread   = (hi - lo) * 0.3;
        for (const statType of statTypes) {
          const value =
            statType === "median"       ? median :
            statType === "top_quartile" ? +(median + spread).toFixed(6) :
                                          +(median - spread).toFixed(6);
          await sql`
            INSERT INTO peer_group_stat_fact
              (peer_group_id, period_id, as_of_date, metric_name, stat_type, metric_value)
            VALUES (${pgId}, ${periodId}, '2024-12-31', ${metric}, ${statType}, ${value})`;
          count++;
        }
      }
    }
  }
  console.log(`Seeded ${count} peer_group_stat_fact rows`);
}

async function seedAdvisors() {
  const rows = [
    [1, "John van der Merwe", "john.vdm@wealthadvisors.co.za",       "Sandton",       "Gauteng"],
    [2, "Sarah Botha",        "sarah.botha@wealthadvisors.co.za",     "Cape Town CBD", "Western Cape"],
    [3, "Michael Dlamini",    "michael.dlamini@wealthadvisors.co.za", "Umhlanga",      "KwaZulu-Natal"],
    [4, "Priya Naidoo",       "priya.naidoo@wealthadvisors.co.za",    "Pretoria East", "Gauteng"],
    [5, "David Swanepoel",    "david.swanepoel@wealthadvisors.co.za", "Bloemfontein",  "Free State"],
  ] as const;
  for (const [id, name, email, branch, region] of rows) {
    await sql`INSERT INTO advisor (advisor_id, advisor_name, email, branch, region) VALUES (${id}, ${name}, ${email}, ${branch}, ${region})`;
  }
  console.log(`Seeded ${rows.length} advisors`);
}

async function seedClients() {
  // [client_id, advisor_id, first, last, email, phone, dob, risk_profile, client_since, status, id_number]
  const rows = [
    [1,1,"Themba","Mkhize","themba.mkhize@mail.co.za","0821234501","1978-03-15","aggressive","2015-06-01","active","7803155001089"],
    [2,1,"Zanele","Dube","zanele.dube@mail.co.za","0821234502","1985-07-22","moderate","2017-02-14","active","8507221234085"],
    [3,1,"Pieter","Nel","pieter.nel@mail.co.za","0821234503","1965-11-08","conservative","2010-09-01","active","6511085678096"],
    [4,1,"Anita","Olivier","anita.olivier@mail.co.za","0821234504","1990-04-30","moderate","2019-03-20","active","9004305432087"],
    [5,1,"Sipho","Ndlovu","sipho.ndlovu@mail.co.za","0821234505","1972-08-17","aggressive","2012-11-05","active","7208175678082"],
    [6,1,"Maria","Santos","maria.santos@mail.co.za","0821234506","1980-02-25","moderate","2016-07-11","dormant","8002255678083"],
    [7,1,"Jacques","Steyn","jacques.steyn@mail.co.za","0821234507","1968-06-12","conservative","2008-04-22","active","6806125678084"],
    [8,1,"Nomsa","Khumalo","nomsa.khumalo@mail.co.za","0821234508","1995-09-03","moderate","2020-01-15","active","9509035678085"],
    [9,1,"Francois","du Plessis","francois.dp@mail.co.za","0821234509","1975-12-19","aggressive","2013-08-30","active","7512195678086"],
    [10,1,"Lungile","Zuma","lungile.zuma@mail.co.za","0821234510","1988-05-06","moderate","2018-05-01","active","8805065678087"],
    [11,2,"Amahle","Ntuli","amahle.ntuli@mail.co.za","0831234511","1983-01-14","conservative","2014-03-10","active","8301145678088"],
    [12,2,"Brett","Thompson","brett.thompson@mail.co.za","0831234512","1970-10-28","aggressive","2009-12-01","active","7010285678089"],
    [13,2,"Cynthia","March","cynthia.march@mail.co.za","0831234513","1992-03-22","moderate","2018-09-15","active","9203225678090"],
    [14,2,"Desmond","Fortuin","desmond.fortuin@mail.co.za","0831234514","1960-07-04","conservative","2005-01-20","active","6007045678091"],
    [15,2,"Elzette","Venter","elzette.venter@mail.co.za","0831234515","1987-11-16","moderate","2015-06-25","dormant","8711165678092"],
    [16,2,"Faizel","Davids","faizel.davids@mail.co.za","0831234516","1979-04-09","aggressive","2013-04-14","active","7904095678093"],
    [17,2,"Gail","Morrison","gail.morrison@mail.co.za","0831234517","1993-08-31","moderate","2019-11-02","active","9308315678094"],
    [18,2,"Hendrick","Basson","hendrick.basson@mail.co.za","0831234518","1966-02-17","conservative","2007-07-07","active","6602175678095"],
    [19,2,"Irene","Maseko","irene.maseko@mail.co.za","0831234519","1981-06-23","moderate","2016-01-30","active","8106235678096"],
    [20,2,"Johan","Smit","johan.smit@mail.co.za","0831234520","1973-09-11","aggressive","2011-10-18","inactive","7309115678097"],
    [21,3,"Kabelo","Sithole","kabelo.sithole@mail.co.za","0841234521","1986-12-05","moderate","2015-08-12","active","8612055678098"],
    [22,3,"Lindiwe","Mthembu","lindiwe.mthembu@mail.co.za","0841234522","1991-03-18","aggressive","2018-02-28","active","9103185678099"],
    [23,3,"Mfanafuthi","Cele","mfanafuthi.cele@mail.co.za","0841234523","1976-07-29","conservative","2012-05-15","active","7607295678100"],
    [24,3,"Naledi","Dlamini","naledi.dlamini@mail.co.za","0841234524","1998-01-11","moderate","2021-07-01","active","9801115678101"],
    [25,3,"Oscar","Brits","oscar.brits@mail.co.za","0841234525","1963-05-24","conservative","2006-03-22","dormant","6305245678102"],
    [26,3,"Patricia","Rademeyer","patricia.rademeyer@mail.co.za","0841234526","1984-10-07","moderate","2014-12-10","active","8410075678103"],
    [27,3,"Quinton","Adams","quinton.adams@mail.co.za","0841234527","1977-02-14","aggressive","2011-09-05","active","7702145678104"],
    [28,3,"Renee","Jordaan","renee.jordaan@mail.co.za","0841234528","1994-08-26","moderate","2020-04-17","active","9408265678105"],
    [29,3,"Sibusiso","Nkosi","sibusiso.nkosi@mail.co.za","0841234529","1969-11-19","conservative","2009-06-30","active","6911195678106"],
    [30,3,"Thandi","Zulu","thandi.zulu@mail.co.za","0841234530","1982-04-02","moderate","2016-10-22","active","8204025678107"],
    [31,4,"Unathi","Mdluli","unathi.mdluli@mail.co.za","0851234531","1989-06-15","aggressive","2017-03-08","active","8906155678108"],
    [32,4,"Vusi","Mahlangu","vusi.mahlangu@mail.co.za","0851234532","1974-09-27","moderate","2012-07-19","active","7409275678109"],
    [33,4,"Wendy","Pretorius","wendy.pretorius@mail.co.za","0851234533","1967-01-30","conservative","2007-11-14","active","6701305678110"],
    [34,4,"Xander","du Toit","xander.dutoit@mail.co.za","0851234534","1996-04-12","moderate","2020-08-03","active","9604125678111"],
    [35,4,"Yolandi","Cronje","yolandi.cronje@mail.co.za","0851234535","1978-07-08","aggressive","2013-01-27","dormant","7807085678112"],
    [36,4,"Zinhle","Shabalala","zinhle.shabalala@mail.co.za","0851234536","1993-10-21","moderate","2019-05-16","active","9310215678113"],
    [37,4,"Andre","van Wyk","andre.vanwyk@mail.co.za","0851234537","1961-03-04","conservative","2004-09-09","active","6103045678114"],
    [38,4,"Bongiwe","Majola","bongiwe.majola@mail.co.za","0851234538","1987-08-17","moderate","2016-04-25","active","8708175678115"],
    [39,4,"Charles","Kotze","charles.kotze@mail.co.za","0851234539","1971-12-29","aggressive","2010-02-11","active","7112295678116"],
    [40,4,"Dikeledi","Molefe","dikeledi.molefe@mail.co.za","0851234540","1980-05-16","moderate","2015-11-03","inactive","8005165678117"],
    [41,5,"Ernest","Swart","ernest.swart@mail.co.za","0861234541","1964-08-22","conservative","2006-06-18","active","6408225678118"],
    [42,5,"Fatima","Ismail","fatima.ismail@mail.co.za","0861234542","1990-02-07","moderate","2018-10-31","active","9002075678119"],
    [43,5,"Gareth","Lewis","gareth.lewis@mail.co.za","0861234543","1975-06-14","aggressive","2012-03-06","active","7506145678120"],
    [44,5,"Hlengiwe","Hadebe","hlengiwe.hadebe@mail.co.za","0861234544","1997-09-28","moderate","2022-01-10","active","9709285678121"],
    [45,5,"Ivan","Ferreira","ivan.ferreira@mail.co.za","0861234545","1968-01-05","conservative","2008-08-22","active","6801055678122"],
    [46,5,"Joyce","Motsepe","joyce.motsepe@mail.co.za","0861234546","1985-04-19","moderate","2014-07-07","active","8504195678123"],
    [47,5,"Kevin","Barnard","kevin.barnard@mail.co.za","0861234547","1979-11-01","aggressive","2013-05-14","dormant","7911015678124"],
    [48,5,"Lerato","Mokwena","lerato.mokwena@mail.co.za","0861234548","1992-07-13","moderate","2019-09-20","active","9207135678125"],
    [49,5,"Martin","Strydom","martin.strydom@mail.co.za","0861234549","1956-03-26","conservative","2001-12-01","active","5603265678126"],
    [50,5,"Ntombifikile","Mthethwa","ntombi.mthethwa@mail.co.za","0861234550","1988-10-09","moderate","2017-06-28","active","8810095678127"],
  ] as const;

  for (const [id, adv, fn, ln, email, phone, dob, risk, since, status, idnum] of rows) {
    await sql`
      INSERT INTO client
        (client_id, advisor_id, first_name, last_name, email, phone,
         date_of_birth, risk_profile, client_since, status, id_number)
      VALUES
        (${id}, ${adv}, ${fn}, ${ln}, ${email}, ${phone},
         ${dob}, ${risk}, ${since}, ${status}, ${idnum})`;
  }
  console.log(`Seeded ${rows.length} clients`);
}

async function seedPolicies() {
  const policyTypes = ["RA", "TFSA", "Living Annuity", "Endowment", "Unit Trust"];
  const fundPool    = [1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 19, 20, 21, 25, 26, 28];
  let policyId = 1;

  const buildPolicy = (clientId: number, p: number) => {
    const s       = clientId * 200 + p;
    const ptype   = policyTypes[Math.floor(prand(s + 1) * policyTypes.length)];
    const fundId  = fundPool[Math.floor(prand(s + 2) * fundPool.length)];
    const years   = Math.floor(prand(s + 3) * 8) + 2;
    const month   = String(Math.floor(prand(s + 4) * 12) + 1).padStart(2, "0");
    const incDate = `${2024 - years}-${month}-01`;
    const initial = Math.round((50000 + prand(s + 5) * 950000) / 1000) * 1000;
    const growth  = 1 + BASE_1Y[FUND_SECTOR[fundId]] * years * (0.7 + prand(s + 6) * 0.6);
    const current = Math.round((initial * growth) / 1000) * 1000;
    const nav     = +(10 + prand(s + 7) * 990).toFixed(4);
    const units   = +(current / nav).toFixed(6);
    const status  = prand(s + 8) > 0.1 ? "active" : "paid_up";
    const polNum  = `POL${String(policyId).padStart(5, "0")}`;
    return { policyId: policyId++, clientId, polNum, ptype, fundId, incDate, status, initial, current, units };
  };

  // Clients 1-30: 2 policies each = 60
  for (let cid = 1; cid <= 30; cid++) {
    for (let p = 0; p < 2; p++) {
      const d = buildPolicy(cid, p);
      await sql`
        INSERT INTO policy
          (policy_id, client_id, policy_number, policy_type, fund_id, inception_date,
           status, initial_investment, current_value, units_held, as_of_date)
        VALUES
          (${d.policyId}, ${d.clientId}, ${d.polNum}, ${d.ptype}, ${d.fundId}, ${d.incDate},
           ${d.status}, ${d.initial}, ${d.current}, ${d.units}, '2024-12-31')`;
    }
  }
  // Clients 31-50: 1 policy each = 20
  for (let cid = 31; cid <= 50; cid++) {
    const d = buildPolicy(cid, 0);
    await sql`
      INSERT INTO policy
        (policy_id, client_id, policy_number, policy_type, fund_id, inception_date,
         status, initial_investment, current_value, units_held, as_of_date)
      VALUES
        (${d.policyId}, ${d.clientId}, ${d.polNum}, ${d.ptype}, ${d.fundId}, ${d.incDate},
         ${d.status}, ${d.initial}, ${d.current}, ${d.units}, '2024-12-31')`;
  }
  console.log(`Seeded ${policyId - 1} policies`);
}

async function seedTransactions() {
  const txTypes   = ["contribution", "withdrawal", "switch_in", "switch_out", "dividend"];
  const txWeights = [0.40, 0.55, 0.70, 0.85, 1.00]; // cumulative
  const fundPool  = [1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 19, 20, 21, 25, 26, 28];
  let count = 0;
  let txId  = 1;

  for (let policyId = 1; policyId <= 80 && count < 200; policyId++) {
    const numTx  = prand(policyId * 151) > 0.6 ? 3 : 2;
    const fundId = fundPool[policyId % fundPool.length];

    for (let t = 0; t < numTx && count < 200; t++) {
      const s        = policyId * 300 + t;
      const roll     = prand(s + 1);
      const txType   = txTypes[txWeights.findIndex((w) => roll < w)] ?? "contribution";
      const dayOff   = Math.floor(prand(s + 2) * 1096); // 0-1095 days since 2022-01-01
      const txDate   = new Date("2022-01-01");
      txDate.setDate(txDate.getDate() + dayOff);
      const txDateStr = txDate.toISOString().split("T")[0];
      const amount    = +(Math.round((1000 + prand(s + 3) * 49000) / 100) * 100).toFixed(2);
      const nav       = +(10 + prand(s + 4) * 490).toFixed(4);
      const units     = +(amount / nav).toFixed(6);

      await sql`
        INSERT INTO transaction
          (transaction_id, policy_id, fund_id, transaction_type, transaction_date,
           amount, units, nav_price, status)
        VALUES
          (${txId++}, ${policyId}, ${fundId}, ${txType}, ${txDateStr},
           ${amount}, ${units}, ${nav}, 'settled')`;
      count++;
    }
  }
  console.log(`Seeded ${count} transactions`);
}

async function seedAdvisorAum() {
  const months    = ["2024-10-31", "2024-11-30", "2024-12-31"];
  const baseAum   = { 1: 450_000_000, 2: 380_000_000, 3: 210_000_000, 4: 320_000_000, 5: 155_000_000 };
  const clientCnt = { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 };
  let count = 0;

  for (let advisorId = 1; advisorId <= 5; advisorId++) {
    for (let m = 0; m < months.length; m++) {
      const s      = advisorId * 157 + m;
      const growth = 1 + m * 0.008 + (prand(s) - 0.5) * 0.02;
      const aum    = +(baseAum[advisorId as keyof typeof baseAum] * growth).toFixed(2);
      const active = 14 + Math.round(prand(s + 1) * 4);
      const rev    = +(aum * 0.0012 / 12).toFixed(2);
      await sql`
        INSERT INTO advisor_aum
          (advisor_id, as_of_date, total_aum, total_clients, active_policies, monthly_revenue)
        VALUES
          (${advisorId}, ${months[m]}, ${aum}, ${clientCnt[advisorId as keyof typeof clientCnt]}, ${active}, ${rev})`;
      count++;
    }
  }
  console.log(`Seeded ${count} advisor_aum rows`);
}

// ---------------------------------------------------------------------------
// Main seed entry point
// ---------------------------------------------------------------------------
export async function seed() {
  console.log("=== Starting Investment Advisor CRM seed ===");
  await dropAllTables();
  await createAllTables();
  await seedSectors();
  await seedPeerGroups();
  await seedPeriodDefinitions();
  await seedFunds();
  await seedFundPerformanceFacts();
  await seedFundRiskFacts();
  await seedFundFlowFacts();
  await seedFundRankingFacts();
  await seedPeerGroupStatFacts();
  await seedAdvisors();
  await seedClients();
  await seedPolicies();
  await seedTransactions();
  await seedAdvisorAum();
  console.log("=== Seed complete ===");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed().catch(console.error);
}
