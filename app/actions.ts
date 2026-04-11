"use server";

import { Config, configSchema, explanationsSchema, Result } from "@/lib/types";
import { llmModel } from "@/lib/llm";
import { sql } from "@vercel/postgres";
import { generateText, Output } from "ai";
import { z } from "zod";

export const generateQuery = async (input: string) => {
  "use server";
  try {
    const { output } = await generateText({
      model: llmModel,
      system: `You are a SQL (postgres) and data visualization expert for an Investment Advisor CRM. Your job is to help the user write a SQL query to retrieve the data they need. Only SELECT queries are allowed.

SCHEMA — 14 tables:

-- Dimension tables
sector(sector_id INT PK, sector_name, asisa_category)
peer_group(peer_group_id INT PK, peer_group_name, display_group_name, sector_id FK→sector)
period_definition(period_id INT PK, period_code, period_type, end_date, is_annualized, display_order)
fund(fund_id INT PK, fund_name, isin, ticker, inception_date, management_fee, net_expense_ratio, fund_size, morningstar_rating_overall, peer_group_id FK→peer_group, sector_id FK→sector, source_asof_date)
advisor(advisor_id INT PK, advisor_name, email, branch, region)
client(client_id INT PK, advisor_id FK→advisor, first_name, last_name, email, phone, date_of_birth, risk_profile, client_since, status, id_number)

-- Fact tables
fund_performance_fact(fund_perf_id SERIAL PK, fund_id FK, period_id FK, as_of_date, return_annualized, return_cumulative, best_month, worst_month, up_capture_ratio, down_capture_ratio, up_percent_ratio, down_percent_ratio, r_squared)
fund_risk_fact(fund_risk_id SERIAL PK, fund_id FK, period_id FK, as_of_date, std_dev_annualized, sharpe_ratio_annualized, sortino_ratio_annualized, treynor_ratio_annualized, tracking_error_annualized)
fund_flow_fact(fund_flow_id SERIAL PK, fund_id FK, period_id FK, as_of_date, estimated_net_flow, fund_size)
fund_ranking_fact(fund_ranking_id SERIAL PK, fund_id FK, period_id FK, peer_group_id FK, as_of_date, peer_group_rank, peer_group_quartile, investments_ranked_count)
peer_group_stat_fact(peer_group_stat_id SERIAL PK, peer_group_id FK, period_id FK, as_of_date, metric_name, stat_type, metric_value)
policy(policy_id INT PK, client_id FK→client, policy_number, policy_type, fund_id FK→fund, inception_date, status, initial_investment, current_value, units_held, as_of_date)
transaction(transaction_id INT PK, policy_id FK→policy, fund_id FK→fund, transaction_type, transaction_date, amount, units, nav_price, status)
advisor_aum(aum_id INT PK, advisor_id FK→advisor, as_of_date, total_aum, total_clients, active_policies, monthly_revenue)

KEY RULES:
- Period filtering: always JOIN period_definition and filter on period_code (e.g. '1Y', '3Y', '5Y').
- Returns and fees are decimals: 0.12 = 12%, 0.015 = 1.5%. Multiply by 100 when displaying as percentage.
- AUM, current_value, and amounts are in South African Rands (ZAR).
- Lower peer_group_rank = better; peer_group_quartile 1 = top quartile.
- Positive estimated_net_flow = net inflow; negative = net outflow.
- client.risk_profile: 'conservative', 'moderate', 'aggressive'.
- client.status: 'active', 'dormant', 'inactive'.
- policy.policy_type: 'RA', 'TFSA', 'Living Annuity', 'Endowment', 'Unit Trust'.
- transaction.transaction_type: 'contribution', 'withdrawal', 'switch_in', 'switch_out', 'dividend'.
- Use LOWER() and ILIKE for string matching.

JOIN PATHS:
- Client book: policy → client → advisor
- Fund details: policy → fund → peer_group → sector
- Performance: fund → fund_performance_fact → period_definition
- Rankings: fund → fund_ranking_fact → peer_group + period_definition
- Cross-domain: policy JOIN fund JOIN fund_ranking_fact JOIN period_definition JOIN client

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
      system: `You are a SQL (postgres) expert for an Investment Advisor CRM. Your job is to explain a SQL query to a non-technical financial advisor. The database contains 14 tables across two domains:
- Fund data: sector, peer_group, fund, period_definition, fund_performance_fact, fund_risk_fact, fund_flow_fact, fund_ranking_fact, peer_group_stat_fact
- CRM data: advisor, client, policy, transaction, advisor_aum

Returns and fees are stored as decimals (0.12 = 12%). AUM and amounts are in South African Rands (ZAR). Lower peer_group_rank = better performance.

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
