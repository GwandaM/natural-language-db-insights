import { z } from "zod";

export type Result = Record<string, string | number>;

// ---------------------------------------------------------------------------
// Database row types (match migrations/001_initial_db_tables.sql)
// ---------------------------------------------------------------------------

export type ClientRow = {
  client_id: number;
  investor_entity: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  risk_profile: string | null;
  vitality_status: string | null;
};

export type PolicyRow = {
  policy_id: number;
  client_id: number;
  policy_number: string;
  product_name: string | null;
  policy_status: string | null;
  commence_date: string | null;
  anniversary_date: string | null;
  annuity_income_review_date: string | null;
  recurring_premium: string | null;
  single_premium: string | null;
  drawdown_rate_pct: string | null;
  total_current_value: string | null;
  as_of_date: string;
};

export type PolicyMetricsSnapshotRow = {
  policy_metrics_id: number;
  policy_id: number;
  as_of_date: string;
  irr_pct: string | null;
  lpo: string | null;
  fee_payback: string | null;
  retirement_payback_booster: string | null;
  ruii: string | null;
  contribution_boost: string | null;
};

export type AsisaCategoryRow = {
  asisa_category_id: number;
  category_name: string;
};

export type PeerGroupRow = {
  peer_group_id: number;
  peer_group_name: string;
  display_group_name: string | null;
  asisa_category_id: number | null;
};

export type FundRow = {
  fund_id: number;
  isin: string;
  ticker: string | null;
  fund_name: string;
  inception_date: string | null;
  management_fee: string | null;
  net_expense_ratio: string | null;
  morningstar_rating_overall: string | null;
  peer_group_id: number | null;
};

export type FundPerformanceSnapshotRow = {
  fund_performance_id: number;
  fund_id: number;
  as_of_date: string;
  period_code: string;
  return_annualized: string | null;
  return_cumulative: string | null;
  best_month: string | null;
  worst_month: string | null;
  r_squared: string | null;
  peer_group_rank: number | null;
  peer_group_quartile: number | null;
};

export type FundRiskSnapshotRow = {
  fund_risk_id: number;
  fund_id: number;
  as_of_date: string;
  period_code: string;
  std_dev_annualized: string | null;
  sharpe_ratio: string | null;
  sortino_ratio: string | null;
  treynor_ratio: string | null;
  tracking_error: string | null;
  up_capture_ratio: string | null;
  up_percent_ratio: string | null;
  down_capture_ratio: string | null;
  down_percent_ratio: string | null;
};

export type FundFlowSnapshotRow = {
  fund_flow_id: number;
  fund_id: number;
  as_of_date: string;
  fund_size: string | null;
  estimated_net_flow_1m: string | null;
  estimated_net_flow_3m: string | null;
  estimated_net_flow_6m: string | null;
  estimated_net_flow_ytd: string | null;
  estimated_net_flow_1y: string | null;
  estimated_net_flow_3y: string | null;
  estimated_net_flow_5y: string | null;
};

export type PolicyFundHoldingSnapshotRow = {
  holding_id: number;
  policy_id: number;
  fund_id: number;
  fund_value: string | null;
  as_of_date: string;
};

export const explanationSchema = z.object({
  section: z.string(),
  explanation: z.string(),
});
export const explanationsSchema = z.array(explanationSchema);

export type QueryExplanation = z.infer<typeof explanationSchema>;

// Define the schema for chart configuration
export const configSchema = z
  .object({
    description: z
      .string()
      .describe(
        "Describe the chart. What is it showing? What is interesting about the way the data is displayed?",
      ),
    takeaway: z.string().describe("What is the main takeaway from the chart?"),
    type: z.enum(["bar", "line", "area", "pie"]).describe("Type of chart"),
    title: z.string(),
    xKey: z.string().describe("Key for x-axis or category"),
    yKeys: z.array(z.string()).describe("Key(s) for y-axis values this is typically the quantitative column"),
    multipleLines: z
      .boolean()
      .nullable()
      .describe(
        "For line charts only: whether the chart is comparing groups of data.",
      ),
    measurementColumn: z
      .string()
      .nullable()
      .describe(
        "For line charts only: key for quantitative y-axis column to measure against (eg. values, counts etc.)",
      ),
    lineCategories: z
      .array(z.string())
      .nullable()
      .describe(
        "For line charts only: Categories used to compare different lines or data series. Each category represents a distinct line in the chart.",
      ),
    colors: z
      .record(
        z.string().describe("Any of the yKeys"),
        z.string().describe("Color value in CSS format (e.g., hex, rgb, hsl)"),
      )
      .nullable()
      .describe("Mapping of data keys to color values for chart elements"),
    legend: z.boolean().describe("Whether to show legend"),
  })
  .describe("Chart configuration object");


export type Config = z.infer<typeof configSchema>;
