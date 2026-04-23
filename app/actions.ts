"use server";

import { Config, configSchema, explanationsSchema, Result } from "@/lib/types";
import { llmModel } from "@/lib/llm";
import { sql } from "@/lib/db";
import { generateText, Output } from "ai";
import { z } from "zod";

export const generateQuery = async (input: string) => {
  "use server";
  try {
    const { output } = await generateText({
      model: llmModel,
      system: `You are a SQL (postgres) and data visualization expert for an Investment Advisor CRM. Your job is to help the user write a SQL query to retrieve the data they need. Only SELECT queries are allowed.

SCHEMA — 10 tables:

-- Client & Policy (Adviser Book)
client(client_id SERIAL PK, investor_entity VARCHAR UNIQUE, first_name, last_name, date_of_birth, risk_profile, vitality_status)
policy(policy_id SERIAL PK, client_id FK→client, policy_number UNIQUE, product_name, policy_status, commence_date, anniversary_date, annuity_income_review_date, recurring_premium NUMERIC, single_premium NUMERIC, drawdown_rate_pct NUMERIC(8,4), total_current_value NUMERIC(20,2), as_of_date NOT NULL)
policy_metrics_snapshot(policy_metrics_id SERIAL PK, policy_id FK→policy, as_of_date, irr_pct, lpo, fee_payback, retirement_payback_booster, ruii, contribution_boost, UNIQUE(policy_id, as_of_date))

-- Fund reference (ASISA master data)
asisa_category(asisa_category_id SERIAL PK, category_name UNIQUE)
peer_group(peer_group_id SERIAL PK, peer_group_name, display_group_name, asisa_category_id FK→asisa_category)
fund(fund_id SERIAL PK, isin UNIQUE, ticker, fund_name, inception_date, management_fee, net_expense_ratio, morningstar_rating_overall, peer_group_id FK→peer_group)

-- Fund snapshots (ASISA time-series data). period_code is stored as a VARCHAR column on each snapshot row.
fund_performance_snapshot(fund_performance_id SERIAL PK, fund_id FK, as_of_date, period_code, return_annualized, return_cumulative, best_month, worst_month, r_squared, peer_group_rank, peer_group_quartile, UNIQUE(fund_id, as_of_date, period_code))
fund_risk_snapshot(fund_risk_id SERIAL PK, fund_id FK, as_of_date, period_code, std_dev_annualized, sharpe_ratio, sortino_ratio, treynor_ratio, tracking_error, up_capture_ratio, up_percent_ratio, down_capture_ratio, down_percent_ratio, UNIQUE(fund_id, as_of_date, period_code))
fund_flow_snapshot(fund_flow_id SERIAL PK, fund_id FK, as_of_date, fund_size, estimated_net_flow_1m, estimated_net_flow_3m, estimated_net_flow_6m, estimated_net_flow_ytd, estimated_net_flow_1y, estimated_net_flow_3y, estimated_net_flow_5y, UNIQUE(fund_id, as_of_date))

-- Policy-fund holdings
policy_fund_holding_snapshot(holding_id SERIAL PK, policy_id FK→policy, fund_id FK→fund, fund_value NUMERIC(20,2), as_of_date, UNIQUE(policy_id, fund_id, as_of_date))

KEY RULES:
- Period filtering: filter on period_code directly (e.g. WHERE period_code = '1Y'). Common codes: '1M', '3M', '6M', '1Y', '3Y', '5Y', 'SI'.
- Returns and fees are decimal fractions: 0.12 = 12%, 0.015 = 1.5%. Multiply by 100 when displaying as percentage.
- Monetary amounts (total_current_value, fund_value, premiums, fund_size, flows) are in South African Rands (ZAR).
- Lower peer_group_rank = better; peer_group_quartile 1 = top quartile.
- Positive estimated_net_flow_* = net inflow; negative = net outflow. Each period bucket is a separate column.
- policy.drawdown_rate_pct: fraction (e.g. 0.05 = 5%). Sustainable range ≤ 5%; > 7.5% = high depletion risk. Only non-zero for drawdown/living-annuity products.
- client.investor_entity is the unique business key (e.g. policyholder/entity reference).
- Latest-value queries should filter by MAX(as_of_date) on the relevant snapshot table.
- Use LOWER() and ILIKE for string matching.

JOIN PATHS:
- Client book: client ← policy ← policy_fund_holding_snapshot → fund
- Fund details: fund → peer_group → asisa_category
- Performance for a fund over a period: fund_performance_snapshot WHERE fund_id = ? AND period_code = ?
- Risk for a fund over a period: fund_risk_snapshot WHERE fund_id = ? AND period_code = ?
- Flows for a fund (per period bucket as columns): fund_flow_snapshot WHERE fund_id = ?
- Client × fund exposure: client → policy → policy_fund_holding_snapshot → fund
- Policy metrics (IRR, fee-payback, RUII, etc.) over time: policy → policy_metrics_snapshot

EVERY QUERY MUST return at least two columns of quantitative data suitable for charting.
    `,
      prompt: `Generate the query necessary to retrieve the data the user wants: ${input}`,
      output: Output.object({
        schema: z.object({
          query: z.string(),
        }),
      }),
    });
    return output.query;
  } catch (e) {
    console.error(e);
    throw new Error("Failed to generate query");
  }
};

export const runGenerateSQLQuery = async (query: string) => {
  "use server";
  // Check if the query is a SELECT statement
  if (
    !query.trim().toLowerCase().startsWith("select") ||
    query.trim().toLowerCase().includes("drop") ||
    query.trim().toLowerCase().includes("delete") ||
    query.trim().toLowerCase().includes("insert") ||
    query.trim().toLowerCase().includes("update") ||
    query.trim().toLowerCase().includes("alter") ||
    query.trim().toLowerCase().includes("truncate") ||
    query.trim().toLowerCase().includes("create") ||
    query.trim().toLowerCase().includes("grant") ||
    query.trim().toLowerCase().includes("revoke")
  ) {
    throw new Error("Only SELECT queries are allowed");
  }

  let data: any;
  try {
    data = await sql.query(query);
  } catch (e: any) {
    if (e.message?.includes("does not exist")) {
      throw new Error("Table does not exist — run `pnpm run seed` to initialise the database.");
    }
    throw e;
  }

  return data.rows as Result[];
};

export const explainQuery = async (input: string, sqlQuery: string) => {
  "use server";
  try {
    const { output } = await generateText({
      model: llmModel,
      output: Output.object({
        schema: z.object({
          explanations: explanationsSchema,
        }),
      }),
      system: `You are a SQL (postgres) expert for an Investment Advisor CRM. Your job is to explain a SQL query to a non-technical financial advisor. The database contains 10 tables across three domains:
- Client & Policy book: client, policy, policy_metrics_snapshot
- Fund reference (ASISA): asisa_category, peer_group, fund
- Fund & holding snapshots: fund_performance_snapshot, fund_risk_snapshot, fund_flow_snapshot, policy_fund_holding_snapshot

Returns and fees are stored as decimal fractions (0.12 = 12%). Monetary amounts (total_current_value, fund_value, premiums, fund_size, flows) are in South African Rands (ZAR). Lower peer_group_rank = better performance. period_code is a VARCHAR column directly on each snapshot (e.g. '1M', '1Y', '3Y', '5Y', 'SI').

Break the query into named sections (e.g. "SELECT clause", "FROM / JOIN", "WHERE", "GROUP BY", "ORDER BY / LIMIT"). Each section must be unique. Leave explanation empty if a section needs no explanation.
    `,
      prompt: `Explain the SQL query you generated to retrieve the data the user wanted. Assume the user is not an expert in SQL. Break down the query into steps. Be concise.

      User Query:
      ${input}

      Generated SQL Query:
      ${sqlQuery}`,
    });
    return output;
  } catch (e) {
    console.error(e);
    throw new Error("Failed to generate query");
  }
};

export const generateChartConfig = async (
  results: Result[],
  userQuery: string,
) => {
  "use server";
  const system = `You are a data visualization expert. `;

  try {
    const { output: config } = await generateText({
      model: llmModel,
      system,
      prompt: `Given the following data from a SQL query result, generate the chart config that best visualises the data and answers the users query.
      For multiple groups use multi-lines.

      Here is an example complete config:
      export const chartConfig = {
        type: "pie",
        xKey: "month",
        yKeys: ["sales", "profit", "expenses"],
        colors: {
          sales: "#4CAF50",    // Green for sales
          profit: "#2196F3",   // Blue for profit
          expenses: "#F44336"  // Red for expenses
        },
        legend: true
      }

      User Query:
      ${userQuery}

      Data:
      ${JSON.stringify(results, null, 2)}`,
      output: Output.object({
        schema: configSchema,
      }),
    });

    const colors: Record<string, string> = {};
    config.yKeys.forEach((key, index) => {
      colors[key] = `hsl(var(--chart-${index + 1}))`;
    });

    const updatedConfig: Config = { ...config, colors };
    return { config: updatedConfig };
  } catch (e) {
    // @ts-expect-errore
    console.error(e.message);
    throw new Error("Failed to generate chart suggestion");
  }
};
