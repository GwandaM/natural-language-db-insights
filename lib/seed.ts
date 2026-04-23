import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { basename, resolve } from "path";
import { spawnSync } from "child_process";
import { pathToFileURL } from "url";
import { Pool, PoolClient, QueryResultRow } from "pg";
import "dotenv/config";
import {
  ensureCockpitTables,
  ensureDashboardInsightsTable,
} from "./cockpit-storage";

type SheetRow = Record<string, string | null> & { __row_number: number };
type WorkbookSheet = { headers: string[]; rows: SheetRow[] };
type ParsedWorkbook = { sheets: Record<string, WorkbookSheet> };

type ImportSummary = Record<string, number>;

type ImportOptions = {
  workbookPath?: string;
  sourceSystem?: string;
  sourceAsOfDate?: string | null;
  validateOnly?: boolean;
};

type ImportContext = {
  client: PoolClient;
  workbookPath: string;
  sourceSystem: string;
  batchSourceAsOfDate: string | null;
  ingestionBatchId: number;
  summary: ImportSummary;
  sectorIds: Map<string, number>;
  peerGroupIds: Map<string, number>;
  periodIds: Map<string, number>;
  fundIds: Map<string, number>;
  advisorIds: Map<string, number>;
  clientIds: Map<string, number>;
  productIds: Map<string, number>;
  policyIds: Map<string, number>;
};

const DEFAULT_WORKBOOK_PATH = "templates/investment_advisor_import_sample.xlsx";
const DEFAULT_SOURCE_SYSTEM = "excel_workbook";
const PARSER_SCRIPT_PATH = "scripts/parse_import_workbook.py";

const SHEET_COLUMNS = {
  advisors: [
    "advisor_code",
    "advisor_name",
    "email",
    "branch",
    "region",
    "active",
  ],
  clients: [
    "client_ref",
    "advisor_code",
    "first_name",
    "last_name",
    "email",
    "phone",
    "date_of_birth",
    "risk_profile",
    "vitality_status",
    "client_since",
    "status",
    "id_number",
    "annual_income",
    "target_retirement_age",
    "annual_income_need",
    "source_as_of_date",
  ],
  products: [
    "product_code",
    "provider_name",
    "product_name",
    "product_family",
    "product_type",
    "vehicle_type",
    "comparison_group",
    "risk_band",
    "target_market",
    "minimum_investment",
    "minimum_debit_order",
    "default_phase",
    "initial_commission_pct",
    "recurring_commission_pct",
    "trail_commission_pct",
    "eac_confidence",
    "active",
    "source_asof_date",
  ],
  product_costs: [
    "product_code",
    "component_type",
    "charge_basis",
    "value_min",
    "value_max",
    "frequency",
    "notes",
    "is_included_in_eac",
    "display_order",
    "source_as_of_date",
  ],
  product_features: [
    "product_code",
    "feature_key",
    "feature_value",
    "display_label",
    "source_as_of_date",
  ],
  product_sources: [
    "product_code",
    "source_url",
    "document_type",
    "page_ref",
    "evidence_snippet",
    "captured_at",
    "source_as_of_date",
  ],
  policies: [
    "policy_number",
    "client_ref",
    "product_code",
    "policy_name",
    "policy_type",
    "phase",
    "status",
    "inception_date",
    "commence_date",
    "anniversary_date",
    "annuity_income_review_date",
    "initial_investment",
    "current_value",
    "units_held",
    "recurring_premium",
    "monthly_contribution",
    "single_premium",
    "monthly_income",
    "drawdown_rate_pct",
    "beneficiary_nominated",
    "as_of_date",
    "source_as_of_date",
  ],
  policy_holdings: [
    "policy_number",
    "fund_isin",
    "allocation_pct",
    "current_value",
    "units_held",
    "inception_date",
    "as_of_date",
    "source_as_of_date",
  ],
  transactions: [
    "policy_number",
    "fund_isin",
    "transaction_type",
    "transaction_date",
    "amount",
    "units",
    "nav_price",
    "status",
    "source_as_of_date",
  ],
  advisor_aum: [
    "advisor_code",
    "as_of_date",
    "total_aum",
    "total_clients",
    "active_policies",
    "monthly_revenue",
    "source_as_of_date",
  ],
  sectors: [
    "sector_name",
    "asisa_category_name",
    "source_as_of_date",
  ],
  peer_groups: [
    "peer_group_name",
    "display_group_name",
    "sector_name",
    "source_as_of_date",
  ],
  periods: [
    "period_code",
    "period_type",
    "end_date",
    "is_annualized",
    "display_order",
    "source_as_of_date",
  ],
  funds: [
    "fund_isin",
    "fund_name",
    "ticker",
    "inception_date",
    "management_fee",
    "net_expense_ratio",
    "fund_size",
    "morningstar_rating_overall",
    "peer_group_name",
    "sector_name",
    "source_asof_date",
  ],
  fund_performance: [
    "fund_isin",
    "period_code",
    "as_of_date",
    "return_annualized",
    "return_cumulative",
    "best_month",
    "worst_month",
    "up_capture_ratio",
    "down_capture_ratio",
    "up_percent_ratio",
    "down_percent_ratio",
    "r_squared",
    "source_as_of_date",
  ],
  fund_risk: [
    "fund_isin",
    "period_code",
    "as_of_date",
    "std_dev_annualized",
    "sharpe_ratio_annualized",
    "sortino_ratio_annualized",
    "treynor_ratio_annualized",
    "tracking_error_annualized",
    "source_as_of_date",
  ],
  fund_flows: [
    "fund_isin",
    "period_code",
    "as_of_date",
    "estimated_net_flow",
    "fund_size",
    "source_as_of_date",
  ],
  fund_rankings: [
    "fund_isin",
    "peer_group_name",
    "period_code",
    "as_of_date",
    "peer_group_rank",
    "peer_group_quartile",
    "investments_ranked_count",
    "source_as_of_date",
  ],
  peer_group_stats: [
    "peer_group_name",
    "period_code",
    "as_of_date",
    "metric_name",
    "stat_type",
    "metric_value",
    "source_as_of_date",
  ],
} as const;

const REQUIRED_SHEETS = new Set([
  "advisors",
  "clients",
  "products",
  "policies",
  "sectors",
  "peer_groups",
  "periods",
  "funds",
]);

const REQUIRED_TABLES = [
  "ingestion_batch",
  "sector",
  "peer_group",
  "period_definition",
  "fund",
  "fund_performance_fact",
  "fund_risk_fact",
  "fund_flow_fact",
  "fund_ranking_fact",
  "peer_group_stat_fact",
  "advisor",
  "client",
  "product",
  "policy",
  "policy_fund_holding_snapshot",
  "transaction",
  "advisor_aum",
  "product_cost_component",
  "product_feature",
  "product_source",
  "communication_drafts",
  "dashboard_insights",
] as const;

function getConnectionString() {
  return process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NO_SSL;
}

function isLocalConnection(connectionString?: string | null) {
  return (
    !connectionString ||
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1") ||
    connectionString.includes("sslmode=disable")
  );
}

function createPool() {
  const connectionString = getConnectionString();
  return new Pool({
    connectionString,
    ssl: isLocalConnection(connectionString)
      ? false
      : { rejectUnauthorized: false },
    max: 2,
  });
}

function mapKey(value: string) {
  return value.trim().toLowerCase();
}

function withRowContext(sheetName: string, row: SheetRow, message: string) {
  return new Error(`[${sheetName} row ${row.__row_number}] ${message}`);
}

function getCell(row: SheetRow, column: string) {
  const value = row[column];
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function requireText(row: SheetRow, sheetName: string, column: string) {
  const value = getCell(row, column);
  if (!value) {
    throw withRowContext(sheetName, row, `Missing required value for "${column}".`);
  }
  return value;
}

function optionalNumber(row: SheetRow, sheetName: string, column: string) {
  const value = getCell(row, column);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw withRowContext(sheetName, row, `Invalid number in "${column}": ${value}`);
  }
  return parsed;
}

function requireNumber(row: SheetRow, sheetName: string, column: string) {
  const value = optionalNumber(row, sheetName, column);
  if (value == null) {
    throw withRowContext(sheetName, row, `Missing required number for "${column}".`);
  }
  return value;
}

function optionalInt(row: SheetRow, sheetName: string, column: string) {
  const value = optionalNumber(row, sheetName, column);
  if (value == null) return null;
  if (!Number.isInteger(value)) {
    throw withRowContext(sheetName, row, `Expected an integer in "${column}": ${value}`);
  }
  return value;
}

function requireInt(row: SheetRow, sheetName: string, column: string) {
  const value = optionalInt(row, sheetName, column);
  if (value == null) {
    throw withRowContext(sheetName, row, `Missing required integer for "${column}".`);
  }
  return value;
}

function optionalBoolean(row: SheetRow, sheetName: string, column: string) {
  const value = getCell(row, column);
  if (!value) return null;
  const normalised = value.toLowerCase();
  if (["true", "t", "yes", "y", "1"].includes(normalised)) return true;
  if (["false", "f", "no", "n", "0"].includes(normalised)) return false;
  throw withRowContext(sheetName, row, `Invalid boolean in "${column}": ${value}`);
}

function normaliseDateValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed.toISOString().slice(0, 10);
}

function optionalDate(row: SheetRow, sheetName: string, column: string) {
  const value = getCell(row, column);
  if (!value) return null;
  try {
    return normaliseDateValue(value);
  } catch (error) {
    throw withRowContext(sheetName, row, (error as Error).message);
  }
}

function requireDate(row: SheetRow, sheetName: string, column: string) {
  const value = optionalDate(row, sheetName, column);
  if (!value) {
    throw withRowContext(sheetName, row, `Missing required date for "${column}".`);
  }
  return value;
}

function optionalTimestamp(row: SheetRow, sheetName: string, column: string) {
  const value = getCell(row, column);
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw withRowContext(sheetName, row, `Invalid timestamp in "${column}": ${value}`);
  }
  return parsed.toISOString();
}

function sourceRecordId(...parts: Array<string | number | null>) {
  return parts
    .filter((part) => part != null && String(part).trim() !== "")
    .map((part) => String(part).trim())
    .join(":");
}

function incrementSummary(summary: ImportSummary, key: string, amount = 1) {
  summary[key] = (summary[key] ?? 0) + amount;
}

function formatSummary(summary: ImportSummary) {
  return Object.entries(summary)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}=${count}`)
    .join(", ");
}

function inferBatchAsOfDate(workbook: ParsedWorkbook) {
  const counts = new Map<string, number>();

  for (const sheet of Object.values(workbook.sheets)) {
    for (const row of sheet.rows) {
      for (const column of ["source_as_of_date", "source_asof_date"]) {
        const value = getCell(row, column);
        if (!value) continue;
        const date = normaliseDateValue(value);
        counts.set(date, (counts.get(date) ?? 0) + 1);
      }
    }
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  return ranked[0]?.[0] ?? null;
}

function validateWorkbookStructure(workbook: ParsedWorkbook) {
  for (const [sheetName, expectedColumns] of Object.entries(SHEET_COLUMNS)) {
    const sheet = workbook.sheets[sheetName];

    if (!sheet) {
      if (REQUIRED_SHEETS.has(sheetName)) {
        throw new Error(`Workbook is missing required sheet "${sheetName}".`);
      }
      continue;
    }

    const headerSet = new Set(sheet.headers.map((header) => header.trim()));
    const missing = expectedColumns.filter((column) => !headerSet.has(column));
    if (missing.length > 0) {
      throw new Error(
        `Sheet "${sheetName}" is missing required columns: ${missing.join(", ")}`,
      );
    }
  }
}

function parseWorkbook(workbookPath: string): ParsedWorkbook {
  const parserPath = resolve(process.cwd(), PARSER_SCRIPT_PATH);
  const result = spawnSync("python3", [parserPath, workbookPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || "Unknown parser error";
    throw new Error(`Failed to parse workbook: ${detail}`);
  }

  return JSON.parse(result.stdout) as ParsedWorkbook;
}

function resolveWorkbookPath(candidate?: string) {
  return resolve(process.cwd(), candidate ?? DEFAULT_WORKBOOK_PATH);
}

function parseCliArgs(argv: string[]): ImportOptions {
  let workbookPath = process.env.IMPORT_WORKBOOK_PATH;
  let sourceSystem = process.env.IMPORT_SOURCE_SYSTEM ?? DEFAULT_SOURCE_SYSTEM;
  let sourceAsOfDate = process.env.IMPORT_SOURCE_AS_OF_DATE ?? null;
  let validateOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: npm run seed -- [workbook-path] [--validate-only] [--source-system value] [--as-of YYYY-MM-DD]",
          "",
          `Defaults to ${DEFAULT_WORKBOOK_PATH} when no workbook path is supplied.`,
        ].join("\n"),
      );
      process.exit(0);
    }

    if (arg === "--validate-only") {
      validateOnly = true;
      continue;
    }

    if (arg === "--source-system") {
      sourceSystem = argv[index + 1] ?? sourceSystem;
      index += 1;
      continue;
    }

    if (arg === "--as-of") {
      sourceAsOfDate = argv[index + 1] ?? sourceAsOfDate;
      index += 1;
      continue;
    }

    if (!arg.startsWith("--")) {
      workbookPath = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    workbookPath,
    sourceSystem,
    sourceAsOfDate,
    validateOnly,
  };
}

function checksumFile(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function getSheet(workbook: ParsedWorkbook, sheetName: keyof typeof SHEET_COLUMNS) {
  return workbook.sheets[sheetName] ?? { headers: [], rows: [] };
}

function lookupId(
  map: Map<string, number>,
  value: string,
  sheetName: string,
  row: SheetRow,
  description: string,
) {
  const id = map.get(mapKey(value));
  if (id == null) {
    throw withRowContext(
      sheetName,
      row,
      `Unknown ${description} reference "${value}". Check the upstream sheet keys.`,
    );
  }
  return id;
}

async function queryRow<T extends QueryResultRow>(
  ctx: ImportContext,
  sheetName: string,
  row: SheetRow,
  text: string,
  values: unknown[],
) {
  try {
    return await ctx.client.query<T>(text, values);
  } catch (error) {
    throw withRowContext(sheetName, row, (error as Error).message);
  }
}

async function assertSchemaReady(client: PoolClient) {
  const result = await client.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [REQUIRED_TABLES],
  );

  const existing = new Set(result.rows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((tableName) => !existing.has(tableName));

  if (missing.length > 0) {
    throw new Error(
      `Database schema is incomplete. Run "npm run migrate" first. Missing tables: ${missing.join(", ")}`,
    );
  }
}

async function truncateImportTables(client: PoolClient) {
  await client.query(`
    TRUNCATE TABLE
      dashboard_insights,
      communication_drafts,
      product_source,
      product_feature,
      product_cost_component,
      "transaction",
      policy_fund_holding_snapshot,
      advisor_aum,
      peer_group_stat_fact,
      fund_ranking_fact,
      fund_flow_fact,
      fund_risk_fact,
      fund_performance_fact,
      policy,
      product,
      client,
      advisor,
      fund,
      period_definition,
      peer_group,
      sector,
      ingestion_batch
    RESTART IDENTITY CASCADE
  `);
}

async function createIngestionBatch(
  client: PoolClient,
  workbookPath: string,
  sourceSystem: string,
  sourceAsOfDate: string | null,
) {
  const result = await client.query<{ ingestion_batch_id: number }>(
    `
      INSERT INTO ingestion_batch (
        source_system,
        source_filename,
        source_checksum,
        source_as_of_date,
        notes
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ingestion_batch_id
    `,
    [
      sourceSystem,
      basename(workbookPath),
      checksumFile(workbookPath),
      sourceAsOfDate,
      "Workbook import via lib/seed.ts",
    ],
  );

  return result.rows[0].ingestion_batch_id;
}

async function importSectors(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const sectorName = requireText(row, "sectors", "sector_name");
    const result = await queryRow<{ sector_id: number }>(
      ctx,
      "sectors",
      row,
      `
        INSERT INTO sector (
          sector_name,
          asisa_category_name,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING sector_id
      `,
      [
        sectorName,
        getCell(row, "asisa_category_name"),
        ctx.sourceSystem,
        sourceRecordId(sectorName),
        optionalDate(row, "sectors", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    ctx.sectorIds.set(mapKey(sectorName), result.rows[0].sector_id);
    incrementSummary(ctx.summary, "sectors");
  }
}

async function importPeerGroups(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const peerGroupName = requireText(row, "peer_groups", "peer_group_name");
    const sectorName = requireText(row, "peer_groups", "sector_name");
    const sectorId = lookupId(ctx.sectorIds, sectorName, "peer_groups", row, "sector");
    const result = await queryRow<{ peer_group_id: number }>(
      ctx,
      "peer_groups",
      row,
      `
        INSERT INTO peer_group (
          peer_group_name,
          display_group_name,
          sector_id,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING peer_group_id
      `,
      [
        peerGroupName,
        getCell(row, "display_group_name"),
        sectorId,
        ctx.sourceSystem,
        sourceRecordId(peerGroupName),
        optionalDate(row, "peer_groups", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    ctx.peerGroupIds.set(mapKey(peerGroupName), result.rows[0].peer_group_id);
    incrementSummary(ctx.summary, "peer_groups");
  }
}

async function importPeriods(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const periodCode = requireText(row, "periods", "period_code");
    const result = await queryRow<{ period_id: number }>(
      ctx,
      "periods",
      row,
      `
        INSERT INTO period_definition (
          period_code,
          period_type,
          end_date,
          is_annualized,
          display_order,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING period_id
      `,
      [
        periodCode,
        requireText(row, "periods", "period_type"),
        optionalDate(row, "periods", "end_date"),
        optionalBoolean(row, "periods", "is_annualized") ?? false,
        requireInt(row, "periods", "display_order"),
        ctx.sourceSystem,
        sourceRecordId(periodCode),
        optionalDate(row, "periods", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    ctx.periodIds.set(mapKey(periodCode), result.rows[0].period_id);
    incrementSummary(ctx.summary, "periods");
  }
}

async function importFunds(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const fundIsin = requireText(row, "funds", "fund_isin");
    const peerGroupName = requireText(row, "funds", "peer_group_name");
    const sectorName = requireText(row, "funds", "sector_name");
    const peerGroupId = lookupId(ctx.peerGroupIds, peerGroupName, "funds", row, "peer group");
    const sectorId = lookupId(ctx.sectorIds, sectorName, "funds", row, "sector");
    const result = await queryRow<{ fund_id: number }>(
      ctx,
      "funds",
      row,
      `
        INSERT INTO fund (
          fund_name,
          isin,
          ticker,
          inception_date,
          management_fee,
          net_expense_ratio,
          fund_size,
          morningstar_rating_overall,
          peer_group_id,
          sector_id,
          source_as_of_date,
          source_system,
          source_record_id,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING fund_id
      `,
      [
        requireText(row, "funds", "fund_name"),
        fundIsin,
        getCell(row, "ticker"),
        optionalDate(row, "funds", "inception_date"),
        optionalNumber(row, "funds", "management_fee"),
        optionalNumber(row, "funds", "net_expense_ratio"),
        optionalNumber(row, "funds", "fund_size"),
        optionalNumber(row, "funds", "morningstar_rating_overall"),
        peerGroupId,
        sectorId,
        optionalDate(row, "funds", "source_asof_date") ?? ctx.batchSourceAsOfDate,
        ctx.sourceSystem,
        sourceRecordId(fundIsin),
        ctx.ingestionBatchId,
      ],
    );

    ctx.fundIds.set(mapKey(fundIsin), result.rows[0].fund_id);
    incrementSummary(ctx.summary, "funds");
  }
}

async function importFundPerformance(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const fundIsin = requireText(row, "fund_performance", "fund_isin");
    const periodCode = requireText(row, "fund_performance", "period_code");
    const fundId = lookupId(ctx.fundIds, fundIsin, "fund_performance", row, "fund");
    const periodId = lookupId(ctx.periodIds, periodCode, "fund_performance", row, "period");
    const asOfDate = requireDate(row, "fund_performance", "as_of_date");

    await queryRow(
      ctx,
      "fund_performance",
      row,
      `
        INSERT INTO fund_performance_fact (
          fund_id,
          period_id,
          as_of_date,
          return_annualized,
          return_cumulative,
          best_month,
          worst_month,
          up_capture_ratio,
          down_capture_ratio,
          up_percent_ratio,
          down_percent_ratio,
          r_squared,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `,
      [
        fundId,
        periodId,
        asOfDate,
        optionalNumber(row, "fund_performance", "return_annualized"),
        optionalNumber(row, "fund_performance", "return_cumulative"),
        optionalNumber(row, "fund_performance", "best_month"),
        optionalNumber(row, "fund_performance", "worst_month"),
        optionalNumber(row, "fund_performance", "up_capture_ratio"),
        optionalNumber(row, "fund_performance", "down_capture_ratio"),
        optionalNumber(row, "fund_performance", "up_percent_ratio"),
        optionalNumber(row, "fund_performance", "down_percent_ratio"),
        optionalNumber(row, "fund_performance", "r_squared"),
        ctx.sourceSystem,
        sourceRecordId(fundIsin, periodCode, asOfDate),
        optionalDate(row, "fund_performance", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "fund_performance");
  }
}

async function importFundRisk(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const fundIsin = requireText(row, "fund_risk", "fund_isin");
    const periodCode = requireText(row, "fund_risk", "period_code");
    const fundId = lookupId(ctx.fundIds, fundIsin, "fund_risk", row, "fund");
    const periodId = lookupId(ctx.periodIds, periodCode, "fund_risk", row, "period");
    const asOfDate = requireDate(row, "fund_risk", "as_of_date");

    await queryRow(
      ctx,
      "fund_risk",
      row,
      `
        INSERT INTO fund_risk_fact (
          fund_id,
          period_id,
          as_of_date,
          std_dev_annualized,
          sharpe_ratio_annualized,
          sortino_ratio_annualized,
          treynor_ratio_annualized,
          tracking_error_annualized,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        fundId,
        periodId,
        asOfDate,
        optionalNumber(row, "fund_risk", "std_dev_annualized"),
        optionalNumber(row, "fund_risk", "sharpe_ratio_annualized"),
        optionalNumber(row, "fund_risk", "sortino_ratio_annualized"),
        optionalNumber(row, "fund_risk", "treynor_ratio_annualized"),
        optionalNumber(row, "fund_risk", "tracking_error_annualized"),
        ctx.sourceSystem,
        sourceRecordId(fundIsin, periodCode, asOfDate),
        optionalDate(row, "fund_risk", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "fund_risk");
  }
}

async function importFundFlows(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const fundIsin = requireText(row, "fund_flows", "fund_isin");
    const periodCode = requireText(row, "fund_flows", "period_code");
    const fundId = lookupId(ctx.fundIds, fundIsin, "fund_flows", row, "fund");
    const periodId = lookupId(ctx.periodIds, periodCode, "fund_flows", row, "period");
    const asOfDate = requireDate(row, "fund_flows", "as_of_date");

    await queryRow(
      ctx,
      "fund_flows",
      row,
      `
        INSERT INTO fund_flow_fact (
          fund_id,
          period_id,
          as_of_date,
          estimated_net_flow,
          fund_size,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        fundId,
        periodId,
        asOfDate,
        optionalNumber(row, "fund_flows", "estimated_net_flow"),
        optionalNumber(row, "fund_flows", "fund_size"),
        ctx.sourceSystem,
        sourceRecordId(fundIsin, periodCode, asOfDate),
        optionalDate(row, "fund_flows", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "fund_flows");
  }
}

async function importFundRankings(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const fundIsin = requireText(row, "fund_rankings", "fund_isin");
    const peerGroupName = requireText(row, "fund_rankings", "peer_group_name");
    const periodCode = requireText(row, "fund_rankings", "period_code");
    const fundId = lookupId(ctx.fundIds, fundIsin, "fund_rankings", row, "fund");
    const peerGroupId = lookupId(
      ctx.peerGroupIds,
      peerGroupName,
      "fund_rankings",
      row,
      "peer group",
    );
    const periodId = lookupId(ctx.periodIds, periodCode, "fund_rankings", row, "period");
    const asOfDate = requireDate(row, "fund_rankings", "as_of_date");

    await queryRow(
      ctx,
      "fund_rankings",
      row,
      `
        INSERT INTO fund_ranking_fact (
          fund_id,
          period_id,
          peer_group_id,
          as_of_date,
          peer_group_rank,
          peer_group_quartile,
          investments_ranked_count,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        fundId,
        periodId,
        peerGroupId,
        asOfDate,
        optionalInt(row, "fund_rankings", "peer_group_rank"),
        optionalInt(row, "fund_rankings", "peer_group_quartile"),
        optionalInt(row, "fund_rankings", "investments_ranked_count"),
        ctx.sourceSystem,
        sourceRecordId(fundIsin, periodCode, asOfDate),
        optionalDate(row, "fund_rankings", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "fund_rankings");
  }
}

async function importPeerGroupStats(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const peerGroupName = requireText(row, "peer_group_stats", "peer_group_name");
    const periodCode = requireText(row, "peer_group_stats", "period_code");
    const asOfDate = requireDate(row, "peer_group_stats", "as_of_date");
    const peerGroupId = lookupId(
      ctx.peerGroupIds,
      peerGroupName,
      "peer_group_stats",
      row,
      "peer group",
    );
    const periodId = lookupId(ctx.periodIds, periodCode, "peer_group_stats", row, "period");

    await queryRow(
      ctx,
      "peer_group_stats",
      row,
      `
        INSERT INTO peer_group_stat_fact (
          peer_group_id,
          period_id,
          as_of_date,
          metric_name,
          stat_type,
          metric_value,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        peerGroupId,
        periodId,
        asOfDate,
        requireText(row, "peer_group_stats", "metric_name"),
        requireText(row, "peer_group_stats", "stat_type"),
        requireNumber(row, "peer_group_stats", "metric_value"),
        ctx.sourceSystem,
        sourceRecordId(
          peerGroupName,
          periodCode,
          asOfDate,
          requireText(row, "peer_group_stats", "metric_name"),
          requireText(row, "peer_group_stats", "stat_type"),
        ),
        optionalDate(row, "peer_group_stats", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "peer_group_stats");
  }
}

async function importAdvisors(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const advisorCode = requireText(row, "advisors", "advisor_code");
    const result = await queryRow<{ advisor_id: number }>(
      ctx,
      "advisors",
      row,
      `
        INSERT INTO advisor (
          advisor_code,
          advisor_name,
          email,
          branch,
          region,
          active,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING advisor_id
      `,
      [
        advisorCode,
        requireText(row, "advisors", "advisor_name"),
        getCell(row, "email"),
        getCell(row, "branch"),
        getCell(row, "region"),
        optionalBoolean(row, "advisors", "active") ?? true,
        ctx.sourceSystem,
        sourceRecordId(advisorCode),
        ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    ctx.advisorIds.set(mapKey(advisorCode), result.rows[0].advisor_id);
    incrementSummary(ctx.summary, "advisors");
  }
}

async function importClients(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const clientRef = requireText(row, "clients", "client_ref");
    const advisorCode = requireText(row, "clients", "advisor_code");
    const advisorId = lookupId(ctx.advisorIds, advisorCode, "clients", row, "advisor");
    const result = await queryRow<{ client_id: number }>(
      ctx,
      "clients",
      row,
      `
        INSERT INTO client (
          advisor_id,
          client_ref,
          first_name,
          last_name,
          email,
          phone,
          date_of_birth,
          risk_profile,
          vitality_status,
          client_since,
          status,
          id_number,
          annual_income,
          target_retirement_age,
          annual_income_need,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING client_id
      `,
      [
        advisorId,
        clientRef,
        requireText(row, "clients", "first_name"),
        requireText(row, "clients", "last_name"),
        getCell(row, "email"),
        getCell(row, "phone"),
        optionalDate(row, "clients", "date_of_birth"),
        getCell(row, "risk_profile"),
        getCell(row, "vitality_status"),
        optionalDate(row, "clients", "client_since"),
        getCell(row, "status") ?? "active",
        getCell(row, "id_number"),
        optionalNumber(row, "clients", "annual_income"),
        optionalInt(row, "clients", "target_retirement_age"),
        optionalNumber(row, "clients", "annual_income_need"),
        ctx.sourceSystem,
        sourceRecordId(clientRef),
        optionalDate(row, "clients", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    ctx.clientIds.set(mapKey(clientRef), result.rows[0].client_id);
    incrementSummary(ctx.summary, "clients");
  }
}

async function importProducts(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const productCode = requireText(row, "products", "product_code");
    const result = await queryRow<{ product_id: number }>(
      ctx,
      "products",
      row,
      `
        INSERT INTO product (
          product_code,
          provider_name,
          product_name,
          product_family,
          product_type,
          vehicle_type,
          comparison_group,
          risk_band,
          target_market,
          minimum_investment,
          minimum_debit_order,
          default_phase,
          initial_commission_pct,
          recurring_commission_pct,
          trail_commission_pct,
          source_asof_date,
          eac_confidence,
          active,
          source_system,
          source_record_id,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING product_id
      `,
      [
        productCode,
        requireText(row, "products", "provider_name"),
        requireText(row, "products", "product_name"),
        requireText(row, "products", "product_family"),
        requireText(row, "products", "product_type"),
        requireText(row, "products", "vehicle_type"),
        requireText(row, "products", "comparison_group"),
        requireText(row, "products", "risk_band"),
        getCell(row, "target_market"),
        optionalNumber(row, "products", "minimum_investment"),
        optionalNumber(row, "products", "minimum_debit_order"),
        getCell(row, "default_phase"),
        optionalNumber(row, "products", "initial_commission_pct"),
        optionalNumber(row, "products", "recurring_commission_pct"),
        optionalNumber(row, "products", "trail_commission_pct"),
        optionalDate(row, "products", "source_asof_date") ?? ctx.batchSourceAsOfDate,
        getCell(row, "eac_confidence") ?? "medium",
        optionalBoolean(row, "products", "active") ?? true,
        ctx.sourceSystem,
        sourceRecordId(productCode),
        ctx.ingestionBatchId,
      ],
    );

    ctx.productIds.set(mapKey(productCode), result.rows[0].product_id);
    incrementSummary(ctx.summary, "products");
  }
}

async function importProductCosts(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const productCode = requireText(row, "product_costs", "product_code");
    const componentType = requireText(row, "product_costs", "component_type");
    const displayOrder = optionalInt(row, "product_costs", "display_order") ?? 1;
    const productId = lookupId(ctx.productIds, productCode, "product_costs", row, "product");

    await queryRow(
      ctx,
      "product_costs",
      row,
      `
        INSERT INTO product_cost_component (
          product_id,
          component_type,
          charge_basis,
          value_min,
          value_max,
          frequency,
          notes,
          is_included_in_eac,
          display_order,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        productId,
        componentType,
        requireText(row, "product_costs", "charge_basis"),
        optionalNumber(row, "product_costs", "value_min"),
        optionalNumber(row, "product_costs", "value_max"),
        getCell(row, "frequency") ?? "annual",
        getCell(row, "notes"),
        optionalBoolean(row, "product_costs", "is_included_in_eac") ?? true,
        displayOrder,
        ctx.sourceSystem,
        sourceRecordId(productCode, componentType, displayOrder),
        optionalDate(row, "product_costs", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "product_costs");
  }
}

async function importProductFeatures(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const productCode = requireText(row, "product_features", "product_code");
    const featureKey = requireText(row, "product_features", "feature_key");
    const displayLabel = requireText(row, "product_features", "display_label");
    const productId = lookupId(
      ctx.productIds,
      productCode,
      "product_features",
      row,
      "product",
    );

    await queryRow(
      ctx,
      "product_features",
      row,
      `
        INSERT INTO product_feature (
          product_id,
          feature_key,
          feature_value,
          display_label,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        productId,
        featureKey,
        requireText(row, "product_features", "feature_value"),
        displayLabel,
        ctx.sourceSystem,
        sourceRecordId(productCode, featureKey, displayLabel),
        optionalDate(row, "product_features", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "product_features");
  }
}

async function importProductSources(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const productCode = requireText(row, "product_sources", "product_code");
    const productId = lookupId(ctx.productIds, productCode, "product_sources", row, "product");
    const sourceUrl = requireText(row, "product_sources", "source_url");
    const documentType = requireText(row, "product_sources", "document_type");

    await queryRow(
      ctx,
      "product_sources",
      row,
      `
        INSERT INTO product_source (
          product_id,
          source_url,
          document_type,
          page_ref,
          evidence_snippet,
          captured_at,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7, $8, $9, $10)
      `,
      [
        productId,
        sourceUrl,
        documentType,
        getCell(row, "page_ref"),
        requireText(row, "product_sources", "evidence_snippet"),
        optionalTimestamp(row, "product_sources", "captured_at"),
        ctx.sourceSystem,
        sourceRecordId(productCode, sourceUrl, documentType, getCell(row, "page_ref")),
        optionalDate(row, "product_sources", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "product_sources");
  }
}

async function importPolicies(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const policyNumber = requireText(row, "policies", "policy_number");
    const clientRef = requireText(row, "policies", "client_ref");
    const productCode = requireText(row, "policies", "product_code");
    const clientId = lookupId(ctx.clientIds, clientRef, "policies", row, "client");
    const productId = lookupId(ctx.productIds, productCode, "policies", row, "product");
    const result = await queryRow<{ policy_id: number }>(
      ctx,
      "policies",
      row,
      `
        INSERT INTO policy (
          client_id,
          product_id,
          policy_number,
          policy_name,
          policy_type,
          phase,
          status,
          inception_date,
          commence_date,
          anniversary_date,
          annuity_income_review_date,
          initial_investment,
          current_value,
          units_held,
          recurring_premium,
          monthly_contribution,
          single_premium,
          monthly_income,
          drawdown_rate_pct,
          beneficiary_nominated,
          as_of_date,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        RETURNING policy_id
      `,
      [
        clientId,
        productId,
        policyNumber,
        getCell(row, "policy_name"),
        requireText(row, "policies", "policy_type"),
        getCell(row, "phase"),
        getCell(row, "status") ?? "active",
        optionalDate(row, "policies", "inception_date"),
        optionalDate(row, "policies", "commence_date"),
        optionalDate(row, "policies", "anniversary_date"),
        optionalDate(row, "policies", "annuity_income_review_date"),
        optionalNumber(row, "policies", "initial_investment"),
        requireNumber(row, "policies", "current_value"),
        optionalNumber(row, "policies", "units_held"),
        optionalNumber(row, "policies", "recurring_premium"),
        optionalNumber(row, "policies", "monthly_contribution"),
        optionalNumber(row, "policies", "single_premium"),
        optionalNumber(row, "policies", "monthly_income"),
        optionalNumber(row, "policies", "drawdown_rate_pct"),
        optionalBoolean(row, "policies", "beneficiary_nominated") ?? true,
        requireDate(row, "policies", "as_of_date"),
        ctx.sourceSystem,
        sourceRecordId(policyNumber),
        optionalDate(row, "policies", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    ctx.policyIds.set(mapKey(policyNumber), result.rows[0].policy_id);
    incrementSummary(ctx.summary, "policies");
  }
}

async function importPolicyHoldings(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const policyNumber = requireText(row, "policy_holdings", "policy_number");
    const fundIsin = requireText(row, "policy_holdings", "fund_isin");
    const asOfDate = requireDate(row, "policy_holdings", "as_of_date");
    const policyId = lookupId(
      ctx.policyIds,
      policyNumber,
      "policy_holdings",
      row,
      "policy",
    );
    const fundId = lookupId(ctx.fundIds, fundIsin, "policy_holdings", row, "fund");

    await queryRow(
      ctx,
      "policy_holdings",
      row,
      `
        INSERT INTO policy_fund_holding_snapshot (
          policy_id,
          fund_id,
          allocation_pct,
          current_value,
          units_held,
          inception_date,
          as_of_date,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        policyId,
        fundId,
        optionalNumber(row, "policy_holdings", "allocation_pct"),
        requireNumber(row, "policy_holdings", "current_value"),
        optionalNumber(row, "policy_holdings", "units_held"),
        optionalDate(row, "policy_holdings", "inception_date"),
        asOfDate,
        ctx.sourceSystem,
        sourceRecordId(policyNumber, fundIsin, asOfDate),
        optionalDate(row, "policy_holdings", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "policy_holdings");
  }
}

async function importTransactions(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const policyNumber = requireText(row, "transactions", "policy_number");
    const policyId = lookupId(ctx.policyIds, policyNumber, "transactions", row, "policy");
    const fundIsin = getCell(row, "fund_isin");
    const fundId = fundIsin
      ? lookupId(ctx.fundIds, fundIsin, "transactions", row, "fund")
      : null;
    const transactionType = requireText(row, "transactions", "transaction_type");
    const transactionDate = requireDate(row, "transactions", "transaction_date");
    const amount = requireNumber(row, "transactions", "amount");

    await queryRow(
      ctx,
      "transactions",
      row,
      `
        INSERT INTO "transaction" (
          policy_id,
          fund_id,
          transaction_type,
          transaction_date,
          amount,
          units,
          nav_price,
          status,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        policyId,
        fundId,
        transactionType,
        transactionDate,
        amount,
        optionalNumber(row, "transactions", "units"),
        optionalNumber(row, "transactions", "nav_price"),
        getCell(row, "status") ?? "settled",
        ctx.sourceSystem,
        sourceRecordId(policyNumber, transactionType, transactionDate, amount),
        optionalDate(row, "transactions", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "transactions");
  }
}

async function importAdvisorAum(ctx: ImportContext, rows: SheetRow[]) {
  for (const row of rows) {
    const advisorCode = requireText(row, "advisor_aum", "advisor_code");
    const asOfDate = requireDate(row, "advisor_aum", "as_of_date");
    const advisorId = lookupId(ctx.advisorIds, advisorCode, "advisor_aum", row, "advisor");

    await queryRow(
      ctx,
      "advisor_aum",
      row,
      `
        INSERT INTO advisor_aum (
          advisor_id,
          as_of_date,
          total_aum,
          total_clients,
          active_policies,
          monthly_revenue,
          source_system,
          source_record_id,
          source_as_of_date,
          ingestion_batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        advisorId,
        asOfDate,
        requireNumber(row, "advisor_aum", "total_aum"),
        requireInt(row, "advisor_aum", "total_clients"),
        requireInt(row, "advisor_aum", "active_policies"),
        requireNumber(row, "advisor_aum", "monthly_revenue"),
        ctx.sourceSystem,
        sourceRecordId(advisorCode, asOfDate),
        optionalDate(row, "advisor_aum", "source_as_of_date") ?? ctx.batchSourceAsOfDate,
        ctx.ingestionBatchId,
      ],
    );

    incrementSummary(ctx.summary, "advisor_aum");
  }
}

export async function createDashboardInsightsTable() {
  await ensureDashboardInsightsTable();
  console.log('Created "dashboard_insights" table');
}

export async function createCommunicationDraftsTable() {
  await ensureCockpitTables();
  console.log('Created "communication_drafts" table');
}

export async function seed(options: ImportOptions = {}) {
  const workbookPath = resolveWorkbookPath(options.workbookPath);
  if (!existsSync(workbookPath)) {
    throw new Error(`Workbook not found: ${workbookPath}`);
  }

  const workbook = parseWorkbook(workbookPath);
  validateWorkbookStructure(workbook);

  const batchSourceAsOfDate = options.sourceAsOfDate
    ? normaliseDateValue(options.sourceAsOfDate)
    : inferBatchAsOfDate(workbook);
  const sourceSystem = options.sourceSystem ?? DEFAULT_SOURCE_SYSTEM;

  const sheetSummary: ImportSummary = {};
  for (const [sheetName, sheet] of Object.entries(workbook.sheets)) {
    sheetSummary[sheetName] = sheet.rows.length;
  }

  console.log(`Workbook: ${workbookPath}`);
  console.log(`Source system: ${sourceSystem}`);
  console.log(`Batch as-of date: ${batchSourceAsOfDate ?? "not set"}`);
  console.log(`Sheet rows: ${formatSummary(sheetSummary)}`);

  if (options.validateOnly) {
    console.log("Validation passed. No database changes were made.");
    return;
  }

  const pool = createPool();
  const client = await pool.connect();

  try {
    await assertSchemaReady(client);
    await client.query("BEGIN");
    await truncateImportTables(client);

    const ingestionBatchId = await createIngestionBatch(
      client,
      workbookPath,
      sourceSystem,
      batchSourceAsOfDate,
    );

    const ctx: ImportContext = {
      client,
      workbookPath,
      sourceSystem,
      batchSourceAsOfDate,
      ingestionBatchId,
      summary: {},
      sectorIds: new Map(),
      peerGroupIds: new Map(),
      periodIds: new Map(),
      fundIds: new Map(),
      advisorIds: new Map(),
      clientIds: new Map(),
      productIds: new Map(),
      policyIds: new Map(),
    };

    await importSectors(ctx, getSheet(workbook, "sectors").rows);
    await importPeerGroups(ctx, getSheet(workbook, "peer_groups").rows);
    await importPeriods(ctx, getSheet(workbook, "periods").rows);
    await importFunds(ctx, getSheet(workbook, "funds").rows);
    await importFundPerformance(ctx, getSheet(workbook, "fund_performance").rows);
    await importFundRisk(ctx, getSheet(workbook, "fund_risk").rows);
    await importFundFlows(ctx, getSheet(workbook, "fund_flows").rows);
    await importFundRankings(ctx, getSheet(workbook, "fund_rankings").rows);
    await importPeerGroupStats(ctx, getSheet(workbook, "peer_group_stats").rows);
    await importAdvisors(ctx, getSheet(workbook, "advisors").rows);
    await importClients(ctx, getSheet(workbook, "clients").rows);
    await importProducts(ctx, getSheet(workbook, "products").rows);
    await importProductCosts(ctx, getSheet(workbook, "product_costs").rows);
    await importProductFeatures(ctx, getSheet(workbook, "product_features").rows);
    await importProductSources(ctx, getSheet(workbook, "product_sources").rows);
    await importPolicies(ctx, getSheet(workbook, "policies").rows);
    await importPolicyHoldings(ctx, getSheet(workbook, "policy_holdings").rows);
    await importTransactions(ctx, getSheet(workbook, "transactions").rows);
    await importAdvisorAum(ctx, getSheet(workbook, "advisor_aum").rows);

    await client.query(
      `
        UPDATE ingestion_batch
        SET completed_at = NOW(),
            notes = $2
        WHERE ingestion_batch_id = $1
      `,
      [
        ingestionBatchId,
        `Workbook import completed. ${formatSummary(ctx.summary)}`,
      ],
    );

    await client.query("COMMIT");
    console.log(`Import complete. ${formatSummary(ctx.summary)}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function loadSeedOptionsFromCli() {
  return parseCliArgs(process.argv.slice(2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed(loadSeedOptionsFromCli()).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
