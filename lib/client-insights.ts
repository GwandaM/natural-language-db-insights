/**
 * Per-client AI insight cards.
 *
 * Generates four LLM-written cards for a client detail page:
 *   portfolio_review, performance, retirement_insights, recent_activity
 *
 * Caches the payload in the shared dashboard_insights table keyed by client.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { llmModel } from "@/lib/llm";
import { sql } from "@/lib/db";
import { ensureDashboardInsightsTable } from "@/lib/cockpit-storage";
import {
  ClientDetail,
  ClientWrapper,
  getClientDetail,
  getClientWrappers,
} from "@/lib/advisor-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientInsightKey =
  | "portfolio_review"
  | "performance"
  | "retirement_insights"
  | "recent_activity";

export interface ClientInsightCard {
  key: ClientInsightKey;
  title: string;
  headline: string;
  body: string;
  available: boolean;
  unavailable_reason?: string | null;
}

export interface ClientInsightsPayload {
  cards: ClientInsightCard[];
}

export interface StoredClientInsights {
  insights: ClientInsightsPayload | null;
  generated_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clientInsightKey = (advisorId: number, clientId: number) =>
  `client:${advisorId}:${clientId}:insights`;

function formatZarShort(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

function daysSince(dateValue: string | null): number | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

interface RetirementSignal {
  determinable: boolean;
  reason: string;
  phase: string | null;
  has_retirement_wrapper: boolean;
  drawdown_rate_pct: number | null;
  monthly_income: number | null;
  monthly_contribution: number | null;
  years_to_age_65: number | null;
  is_post_retirement: boolean;
}

function deriveRetirementSignal(
  client: ClientDetail,
  wrappers: ClientWrapper[],
): RetirementSignal {
  const retirementWrappers = wrappers.filter((wrapper) => {
    const type = wrapper.wrapper_type?.toLowerCase() ?? "";
    return (
      type.includes("retirement") ||
      type.includes("annuity") ||
      type.includes("pension") ||
      type.includes("provident") ||
      type.includes("ra")
    );
  });

  const decumulationWrapper = wrappers.find(
    (wrapper) => (wrapper.phase ?? "").toLowerCase() === "decumulation",
  );
  const accumulationWrapper = wrappers.find(
    (wrapper) => (wrapper.phase ?? "").toLowerCase() === "accumulation",
  );
  const drawdownRate =
    decumulationWrapper?.drawdown_rate_pct ??
    wrappers.find((wrapper) => wrapper.drawdown_rate_pct != null)
      ?.drawdown_rate_pct ??
    null;
  const monthlyIncome =
    decumulationWrapper?.monthly_income ??
    wrappers.find((wrapper) => wrapper.monthly_income != null)?.monthly_income ??
    null;
  const monthlyContribution =
    accumulationWrapper?.monthly_contribution ??
    wrappers.find((wrapper) => wrapper.monthly_contribution != null)
      ?.monthly_contribution ??
    null;

  const yearsToAge65 = client.age != null ? 65 - client.age : null;
  const phase = decumulationWrapper
    ? "decumulation"
    : accumulationWrapper
      ? "accumulation"
      : null;
  const isPostRetirement = phase === "decumulation" || drawdownRate != null;

  const determinable =
    retirementWrappers.length > 0 ||
    phase != null ||
    drawdownRate != null ||
    (client.age != null && client.age >= 50);

  let reason = "";
  if (!determinable) {
    if (client.age == null && retirementWrappers.length === 0) {
      reason =
        "No age on file and no retirement-style wrappers mapped to this client.";
    } else if (retirementWrappers.length === 0) {
      reason =
        "No retirement annuity, pension, or preservation wrapper mapped to this client.";
    } else {
      reason = "Insufficient retirement signals to form a view.";
    }
  }

  return {
    determinable,
    reason,
    phase,
    has_retirement_wrapper: retirementWrappers.length > 0,
    drawdown_rate_pct: drawdownRate,
    monthly_income: monthlyIncome,
    monthly_contribution: monthlyContribution,
    years_to_age_65: yearsToAge65,
    is_post_retirement: isPostRetirement,
  };
}

interface ClientInsightContext {
  profile: {
    client_name: string;
    age: number | null;
    risk_profile: string;
    status: string;
    client_since: string;
    advisor_name: string;
  };
  portfolio: {
    total_aum: string;
    policy_count: number;
    active_policy_count: number;
    avg_1y_return_pct: number;
    avg_quartile: number;
    has_risk_mismatch: boolean;
    last_activity: string | null;
    days_since_last_activity: number | null;
    top_holdings: {
      fund_name: string;
      allocation_pct: number;
      one_year_return_pct: number;
      quartile: number;
      sector_name: string | null;
      peer_group_name: string | null;
    }[];
  };
  wrappers: {
    wrapper_type: string;
    phase: string;
    status: string;
    total_current_value: string;
    monthly_contribution: number | null;
    drawdown_rate_pct: number | null;
    monthly_income: number | null;
    inception_date: string;
  }[];
  recent_transactions: {
    transaction_date: string;
    transaction_type: string;
    amount: string;
    fund_name: string;
    policy_number: string;
  }[];
  alerts: { label: string; severity: string; detail: string }[];
  retirement_signal: RetirementSignal;
}

function buildInsightContext(
  client: ClientDetail,
  wrappers: ClientWrapper[],
): ClientInsightContext {
  const topHoldings = client.policies.slice(0, 5).map((policy) => ({
    fund_name: policy.fund_name,
    allocation_pct: Number(policy.allocation_pct.toFixed(2)),
    one_year_return_pct: Number(policy.one_year_return_pct.toFixed(2)),
    quartile: policy.quartile,
    sector_name: policy.sector_name,
    peer_group_name: policy.peer_group_name,
  }));

  const wrapperSummaries = wrappers.slice(0, 6).map((wrapper) => ({
    wrapper_type: wrapper.wrapper_type,
    phase: wrapper.phase,
    status: wrapper.status,
    total_current_value: formatZarShort(wrapper.total_current_value),
    monthly_contribution: wrapper.monthly_contribution,
    drawdown_rate_pct: wrapper.drawdown_rate_pct,
    monthly_income: wrapper.monthly_income,
    inception_date: wrapper.inception_date,
  }));

  const recentTx = client.recent_transactions.slice(0, 6).map((tx) => ({
    transaction_date: tx.transaction_date,
    transaction_type: tx.transaction_type,
    amount: formatZarShort(tx.amount),
    fund_name: tx.fund_name,
    policy_number: tx.policy_number,
  }));

  return {
    profile: {
      client_name: client.client_name,
      age: client.age,
      risk_profile: client.risk_profile,
      status: client.status,
      client_since: client.client_since,
      advisor_name: client.advisor_name,
    },
    portfolio: {
      total_aum: formatZarShort(client.total_aum),
      policy_count: client.policy_count,
      active_policy_count: client.active_policy_count,
      avg_1y_return_pct: Number(client.avg_1y_return_pct.toFixed(2)),
      avg_quartile: Number(client.avg_quartile.toFixed(2)),
      has_risk_mismatch: client.has_risk_mismatch,
      last_activity: client.last_activity,
      days_since_last_activity: daysSince(client.last_activity),
      top_holdings: topHoldings,
    },
    wrappers: wrapperSummaries,
    recent_transactions: recentTx,
    alerts: client.alerts.map((alert) => ({
      label: alert.label,
      severity: alert.severity,
      detail: alert.detail,
    })),
    retirement_signal: deriveRetirementSignal(client, wrappers),
  };
}

// ---------------------------------------------------------------------------
// LLM generation
// ---------------------------------------------------------------------------

const CardSchema = z.object({
  headline: z.string(),
  body: z.string(),
  available: z.boolean(),
  unavailable_reason: z.string().nullable(),
});

const InsightsSchema = z.object({
  portfolio_review: CardSchema,
  performance: CardSchema,
  retirement_insights: CardSchema,
  recent_activity: CardSchema,
});

const SYSTEM_PROMPT = [
  "You are an AI co-pilot for a South African investment advisor.",
  "You write short, data-driven insight cards about a single client for display on the client detail page.",
  "Produce exactly four cards: portfolio_review, performance, retirement_insights, recent_activity.",
  "For each card:",
  "- headline: one punchy, specific, data-led line (max 14 words). Lead with a concrete number or fact from the supplied data.",
  "- body: one compact paragraph (2–3 sentences, max ~55 words). Be factual and specific, grounded only in the data supplied. Do not invent numbers.",
  "- available: true if the data supports a meaningful view, false if not.",
  "- unavailable_reason: short string when available=false, otherwise null.",
  "Card guidance:",
  "portfolio_review — AUM composition, top holdings, concentration, risk-profile alignment, and wrapper mix.",
  "performance — weighted 1Y return, average quartile, strongest and weakest holdings, and what is driving overall performance.",
  "retirement_insights — ONLY if retirement_signal.determinable is true. Cover phase (accumulation vs decumulation), retirement wrappers, contributions or drawdown rate, and years to age 65. If retirement_signal.determinable is false, set available=false, write a brief 1-sentence body explaining why retirement context cannot be determined, and copy retirement_signal.reason into unavailable_reason.",
  "recent_activity — recent transactions in the last period; call out net flow direction, notable withdrawals or contributions, and any inactivity.",
  "Tone: professional, concise, advisor-to-advisor. No emojis. Use South African Rand formatting like 'R1.2M' when referencing amounts.",
].join(" ");

async function callLlmForCards(
  context: ClientInsightContext,
): Promise<z.infer<typeof InsightsSchema>> {
  const { object } = await generateObject({
    model: llmModel,
    system: SYSTEM_PROMPT,
    prompt: [
      `Client context JSON:`,
      JSON.stringify(context, null, 2),
      "",
      "Write the four cards as specified. Ground every claim in the JSON above.",
    ].join("\n"),
    schema: InsightsSchema,
  });
  return object;
}

function buildCards(
  llmOutput: z.infer<typeof InsightsSchema>,
  context: ClientInsightContext,
): ClientInsightCard[] {
  const retirementAvailable = context.retirement_signal.determinable
    ? llmOutput.retirement_insights.available
    : false;

  return [
    {
      key: "portfolio_review",
      title: "Portfolio Review",
      headline: llmOutput.portfolio_review.headline.trim(),
      body: llmOutput.portfolio_review.body.trim(),
      available: llmOutput.portfolio_review.available,
      unavailable_reason: llmOutput.portfolio_review.unavailable_reason,
    },
    {
      key: "performance",
      title: "Performance",
      headline: llmOutput.performance.headline.trim(),
      body: llmOutput.performance.body.trim(),
      available: llmOutput.performance.available,
      unavailable_reason: llmOutput.performance.unavailable_reason,
    },
    {
      key: "retirement_insights",
      title: "Retirement Insights",
      headline: retirementAvailable
        ? llmOutput.retirement_insights.headline.trim()
        : "Retirement context unavailable",
      body: retirementAvailable
        ? llmOutput.retirement_insights.body.trim()
        : (llmOutput.retirement_insights.body?.trim() ||
            context.retirement_signal.reason),
      available: retirementAvailable,
      unavailable_reason: retirementAvailable
        ? null
        : (llmOutput.retirement_insights.unavailable_reason ??
            context.retirement_signal.reason),
    },
    {
      key: "recent_activity",
      title: "Recent Activity",
      headline: llmOutput.recent_activity.headline.trim(),
      body: llmOutput.recent_activity.body.trim(),
      available: llmOutput.recent_activity.available,
      unavailable_reason: llmOutput.recent_activity.unavailable_reason,
    },
  ];
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function getStoredClientInsights(
  advisorId: number,
  clientId: number,
): Promise<StoredClientInsights> {
  await ensureDashboardInsightsTable();

  const result = await sql`
    SELECT data, generated_at
    FROM dashboard_insights
    WHERE insight_key = ${clientInsightKey(advisorId, clientId)}
    LIMIT 1;
  `;

  const row = result.rows[0];
  if (!row) {
    return { insights: null, generated_at: null };
  }

  return {
    insights: row.data as ClientInsightsPayload,
    generated_at: new Date(String(row.generated_at)).toISOString(),
  };
}

export async function storeClientInsights(
  advisorId: number,
  clientId: number,
  payload: ClientInsightsPayload,
): Promise<void> {
  await ensureDashboardInsightsTable();

  await sql`
    INSERT INTO dashboard_insights (insight_key, advisor_id, data, generated_at)
    VALUES (
      ${clientInsightKey(advisorId, clientId)},
      ${advisorId},
      ${JSON.stringify(payload)},
      NOW()
    )
    ON CONFLICT (insight_key)
    DO UPDATE SET
      advisor_id = EXCLUDED.advisor_id,
      data = EXCLUDED.data,
      generated_at = EXCLUDED.generated_at;
  `;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateClientInsights(
  advisorId: number,
  clientId: number,
): Promise<ClientInsightsPayload> {
  const [client, wrappers] = await Promise.all([
    getClientDetail(advisorId, clientId),
    getClientWrappers(advisorId, clientId),
  ]);

  if (!client) {
    throw new Error(`Client ${clientId} not found for advisor ${advisorId}`);
  }

  const context = buildInsightContext(client, wrappers);
  const llmOutput = await callLlmForCards(context);
  const cards = buildCards(llmOutput, context);

  return { cards };
}
