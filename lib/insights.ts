/**
 * Advisor dashboard insight generation logic.
 * Combines advisor-scoped priorities with firm-wide fund analytics.
 */

import { sql } from "@/lib/db";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { llmModel } from "@/lib/llm";
import { ensureDashboardInsightsTable } from "@/lib/cockpit-storage";
import { AdvisorInfo, ClientRow, getAdvisorClients, getAdvisorKpis, getAdvisors } from "@/lib/advisor-data";
import {
  ClientProductSignal,
  getAdvisorClientProductSignals,
  summariseAdvisorProductSignals,
} from "@/lib/product-intelligence";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AumByAdvisorRow {
  advisor_name: string;
  total_aum: number;
}

export interface RiskProfileRow {
  risk_profile: string;
  count: number;
}

export interface PolicyTypeRow {
  policy_type: string;
  count: number;
}

export interface TopClientRow {
  client_name: string;
  total_value: number;
}

export interface TransactionRow {
  month: string;
  tx_count: number;
  total_amount: number;
}

export interface AtRiskClientRow {
  client_name: string;
  status: string;
  total_value: number;
}

export interface TopFundRow {
  fund_name: string;
  return_1y_pct: number;
}

export interface SharpeBySectorRow {
  sector_name: string;
  avg_sharpe: number;
}

export interface FlowsByPeerGroupRow {
  peer_group_name: string;
  net_flow_m: number;
}

export interface QuartileDistRow {
  peer_group_name: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export interface MorningstarRow {
  rating: number;
  count: number;
}

export interface InsightPayload<T> {
  data: T;
  caption: string;
}

export interface PriorityClientInsight {
  client_id: number;
  client_name: string;
  status: string;
  total_aum: number;
  headline: string;
  rationale: string;
  suggested_action: string;
  product_signal: {
    product_name: string;
    provider_name: string;
    headline_eac_pct: number | null;
    confidence_level: "high" | "medium" | "low";
    fit_issue: string | null;
    cost_issue: string | null;
    alternative_count: number;
  } | null;
}

export interface TodayAction {
  title: string;
  detail: string;
  href: string;
  tone: "high" | "medium" | "low";
}

export interface MorningBriefingSection {
  key:
    | "market_insights"
    | "todays_agenda"
    | "tracking_vs_target"
    | "recent_activity";
  title: string;
  headline: string;
  body: string;
}

export interface MorningBriefing {
  intro: string;
  sections: MorningBriefingSection[];
  priority_clients: PriorityClientInsight[];
  today_actions: TodayAction[];
}

export interface DashboardInsights {
  morning_briefing: MorningBriefing;
  aum_by_advisor: InsightPayload<AumByAdvisorRow[]>;
  risk_profile_breakdown: InsightPayload<RiskProfileRow[]>;
  policy_type_distribution: InsightPayload<PolicyTypeRow[]>;
  top_clients: InsightPayload<TopClientRow[]>;
  transaction_activity: InsightPayload<TransactionRow[]>;
  at_risk_clients: InsightPayload<AtRiskClientRow[]>;
  top_funds_1y: InsightPayload<TopFundRow[]>;
  sharpe_by_sector: InsightPayload<SharpeBySectorRow[]>;
  flows_by_peer_group: InsightPayload<FlowsByPeerGroupRow[]>;
  quartile_distribution: InsightPayload<QuartileDistRow[]>;
  morningstar_distribution: InsightPayload<MorningstarRow[]>;
}

export interface StoredDashboardInsights {
  insights: DashboardInsights | null;
  generated_at: string | null;
}

interface AdvisorRecentTransaction {
  client_id: number;
  client_name: string;
  transaction_type: string;
  transaction_date: string;
  amount: number;
}

interface MarketLaggard {
  fund_name: string;
  return_1y_pct: number;
}

interface MorningBriefingLLMOutput {
  intro: string;
  market_insights_headline: string;
  market_insights: string;
  todays_agenda_headline: string;
  todays_agenda: string;
  tracking_vs_target_headline: string;
  tracking_vs_target: string;
  recent_activity_headline: string;
  recent_activity: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dashboardInsightKey = (advisorId: number) => `advisor:${advisorId}:dashboard`;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

function formatZarShort(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

function groupTransactionsByClient(
  transactions: AdvisorRecentTransaction[],
): Map<number, AdvisorRecentTransaction[]> {
  const grouped = new Map<number, AdvisorRecentTransaction[]>();
  for (const transaction of transactions) {
    const existing = grouped.get(transaction.client_id) ?? [];
    existing.push(transaction);
    grouped.set(transaction.client_id, existing);
  }
  return grouped;
}

function buildPriorityClients(
  clients: ClientRow[],
  recentTransactions: AdvisorRecentTransaction[],
  productSignals: Map<number, ClientProductSignal>,
): PriorityClientInsight[] {
  const transactionsByClient = groupTransactionsByClient(recentTransactions);

  const ranked = clients
    .map((client) => {
      const recentClientTransactions = transactionsByClient.get(client.client_id) ?? [];
      const recentLargeWithdrawal = recentClientTransactions.find(
        (transaction) =>
          transaction.transaction_type === "withdrawal" &&
          transaction.amount >= Math.max(client.total_aum * 0.05, 50_000),
      );
      const productSignal = productSignals.get(client.client_id) ?? null;

      let score = client.total_aum / 1_000_000;
      if (client.status !== "active") score += 80;
      if (client.has_risk_mismatch) score += 70;
      if (productSignal?.fit_issue) score += 68;
      if (productSignal?.cost_issue) score += 52;
      if (client.avg_quartile > 3) score += 60;
      if (recentLargeWithdrawal) score += 55;
      if (client.avg_1y_return_pct < 5) score += 15;

      let headline = "High-value relationship to nurture";
      let rationale = `${client.client_name} is one of the advisor's larger relationships at ${formatZarShort(client.total_aum)}.`;
      let suggestedAction = "Schedule a portfolio check-in and confirm forward-looking goals.";

      if (client.status !== "active") {
        headline = "Dormant relationship needs re-engagement";
        rationale = `${client.client_name} is marked ${client.status} with ${formatZarShort(client.total_aum)} still invested.`;
        suggestedAction = "Send a re-engagement note and request a short review meeting.";
      } else if (productSignal?.fit_issue) {
        headline = "Product fit review recommended";
        rationale = `${client.client_name} is mapped to ${productSignal.product_name} from ${productSignal.provider_name}. ${productSignal.fit_issue}`;
        suggestedAction =
          productSignal.alternative_products.length > 0
            ? `Review suitability and compare against ${productSignal.alternative_products[0].provider_name} ${productSignal.alternative_products[0].product_name}.`
            : "Review suitability, product purpose, and whether the current structure still fits the client's objectives.";
      } else if (productSignal?.cost_issue) {
        headline = "Product cost review recommended";
        rationale = `${client.client_name} is mapped to ${productSignal.product_name} from ${productSignal.provider_name}${
          productSignal.headline_eac_pct != null
            ? ` with an estimated annual cost of ${(productSignal.headline_eac_pct * 100).toFixed(2)}%.`
            : "."
        } ${productSignal.cost_issue}`;
        suggestedAction =
          productSignal.alternative_products.length > 0
            ? `Prepare a like-for-like comparison against ${productSignal.alternative_products[0].provider_name} ${productSignal.alternative_products[0].product_name}.`
            : "Validate the current fee stack and explain the cost trade-offs to the client.";
      } else if (client.has_risk_mismatch) {
        headline = "Risk alignment review recommended";
        rationale = `${client.client_name} has holdings that appear inconsistent with a ${client.risk_profile} risk profile.`;
        suggestedAction = "Prepare a suitability conversation and propose a rebalance path.";
      } else if (client.avg_quartile > 3) {
        headline = "Bottom-quartile holdings dragging quality";
        rationale = `${client.client_name} is averaging Q${client.avg_quartile.toFixed(1)} holdings despite ${formatZarShort(client.total_aum)} under management.`;
        suggestedAction = "Review underperforming funds and outline replacement options.";
      } else if (recentLargeWithdrawal) {
        headline = "Recent money movement needs follow-up";
        rationale = `${client.client_name} recently withdrew ${formatZarShort(recentLargeWithdrawal.amount)} on ${recentLargeWithdrawal.transaction_date}.`;
        suggestedAction = "Confirm the reason for the withdrawal and assess any retention or planning needs.";
      }

      return {
        client_id: client.client_id,
        client_name: client.client_name,
        status: client.status,
        total_aum: client.total_aum,
        headline,
        rationale,
        suggested_action: suggestedAction,
        product_signal: productSignal
          ? {
              product_name: productSignal.product_name,
              provider_name: productSignal.provider_name,
              headline_eac_pct: productSignal.headline_eac_pct,
              confidence_level: productSignal.confidence_level,
              fit_issue: productSignal.fit_issue,
              cost_issue: productSignal.cost_issue,
              alternative_count: productSignal.alternative_products.length,
            }
          : null,
        score,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ score: _score, ...client }) => client);

  return ranked;
}

function buildTodayActions(advisorId: number, priorityClients: PriorityClientInsight[]): TodayAction[] {
  return priorityClients.slice(0, 4).map((client) => ({
    title: client.headline,
    detail: `${client.client_name}: ${client.suggested_action}`,
    href: `/clients/${client.client_id}?advisor=${advisorId}`,
    tone: client.status !== "active" ? "high" : client.headline.includes("Risk") ? "high" : "medium",
  }));
}

async function generateCaption(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: llmModel,
    prompt,
    maxOutputTokens: 120,
  });
  return text.trim();
}

async function generateMorningBriefingContent(prompt: string): Promise<MorningBriefingLLMOutput> {
  const { object } = await generateObject({
    model: llmModel,
    system:
      "You write daily morning briefings for South African investment advisors. " +
      "Produce exactly four sections: market_insights, todays_agenda, tracking_vs_target, recent_activity. " +
      "Keep writing factual, specific, and grounded only in the supplied data. " +
      "For each section write a headline: a short (max 10 words), punchy, data-driven one-liner that leads with the most important number or fact from that section. " +
      "Headlines must be specific (e.g. '9.9% avg return — Stanlib leads at 15.7%') not generic (e.g. 'Strong performance'). " +
      "Write one compact paragraph per section body and avoid bullet lists. " +
      "Section guidance: " +
      "market_insights — synthesise fund leaders, laggards, sector risk-adjusted leadership, and peer-group flows into a market read. " +
      "todays_agenda — tell the advisor what to focus on today, drawing from priority clients, suitability mismatches, product fit/cost issues, and dormant relationships. " +
      "tracking_vs_target — frame the advisor's year-to-date progress on AUM, average 1Y return, monthly revenue, and active policies against the firm benchmarks supplied. State whether the advisor is ahead of or behind target on each metric. " +
      "recent_activity — summarise notable recent client transactions and book movements over the last 90 days.",
    prompt,
    schema: z.object({
      intro: z.string(),
      market_insights_headline: z.string(),
      market_insights: z.string(),
      todays_agenda_headline: z.string(),
      todays_agenda: z.string(),
      tracking_vs_target_headline: z.string(),
      tracking_vs_target: z.string(),
      recent_activity_headline: z.string(),
      recent_activity: z.string(),
    }),
  });

  return object;
}

async function fetchAumByAdvisor(): Promise<AumByAdvisorRow[]> {
  const res = await sql`
    SELECT a.advisor_name, aa.total_aum
    FROM advisor_aum aa
    JOIN advisor a ON aa.advisor_id = a.advisor_id
    WHERE aa.as_of_date = (SELECT MAX(as_of_date) FROM advisor_aum)
    ORDER BY aa.total_aum DESC;
  `;
  return res.rows.map((row) => ({
    advisor_name: String(row.advisor_name),
    total_aum: toNumber(row.total_aum),
  }));
}

async function fetchRiskProfileBreakdown(): Promise<RiskProfileRow[]> {
  const res = await sql`
    SELECT risk_profile, COUNT(*)::INT AS count
    FROM client
    GROUP BY risk_profile
    ORDER BY count DESC;
  `;
  return res.rows.map((row) => ({
    risk_profile: String(row.risk_profile),
    count: toInt(row.count),
  }));
}

async function fetchPolicyTypeDistribution(): Promise<PolicyTypeRow[]> {
  const res = await sql`
    SELECT policy_type, COUNT(*)::INT AS count
    FROM policy
    GROUP BY policy_type
    ORDER BY count DESC;
  `;
  return res.rows.map((row) => ({
    policy_type: String(row.policy_type),
    count: toInt(row.count),
  }));
}

async function fetchTopClients(): Promise<TopClientRow[]> {
  const res = await sql`
    SELECT
      c.first_name || ' ' || c.last_name AS client_name,
      SUM(p.current_value) AS total_value
    FROM policy p
    JOIN client c ON p.client_id = c.client_id
    GROUP BY c.client_id, c.first_name, c.last_name
    ORDER BY total_value DESC
    LIMIT 10;
  `;
  return res.rows.map((row) => ({
    client_name: String(row.client_name),
    total_value: toNumber(row.total_value),
  }));
}

async function fetchTransactionActivity(): Promise<TransactionRow[]> {
  const res = await sql`
    SELECT
      TO_CHAR(transaction_date, 'YYYY-MM') AS month,
      COUNT(*)::INT AS tx_count,
      ROUND(SUM(amount)::NUMERIC, 2) AS total_amount
    FROM transaction
    WHERE transaction_date >= NOW() - INTERVAL '12 months'
    GROUP BY month
    ORDER BY month ASC;
  `;
  return res.rows.map((row) => ({
    month: String(row.month),
    tx_count: toInt(row.tx_count),
    total_amount: toNumber(row.total_amount),
  }));
}

async function fetchAtRiskClients(): Promise<AtRiskClientRow[]> {
  const res = await sql`
    SELECT
      c.first_name || ' ' || c.last_name AS client_name,
      c.status,
      COALESCE(SUM(p.current_value), 0) AS total_value
    FROM client c
    LEFT JOIN policy p ON c.client_id = p.client_id
    WHERE c.status IN ('dormant', 'inactive')
    GROUP BY c.client_id, c.first_name, c.last_name, c.status
    ORDER BY total_value DESC
    LIMIT 10;
  `;
  return res.rows.map((row) => ({
    client_name: String(row.client_name),
    status: String(row.status),
    total_value: toNumber(row.total_value),
  }));
}

async function fetchTopFunds1Y(): Promise<TopFundRow[]> {
  const res = await sql`
    SELECT
      f.fund_name,
      ROUND((fpf.return_annualized * 100)::NUMERIC, 2) AS return_1y_pct
    FROM fund_performance_fact fpf
    JOIN fund f ON fpf.fund_id = f.fund_id
    JOIN period_definition pd ON fpf.period_id = pd.period_id
    WHERE pd.period_code = '1Y'
    ORDER BY fpf.return_annualized DESC
    LIMIT 10;
  `;
  return res.rows.map((row) => ({
    fund_name: String(row.fund_name),
    return_1y_pct: toNumber(row.return_1y_pct),
  }));
}

async function fetchMarketLaggards1Y(): Promise<MarketLaggard[]> {
  const res = await sql`
    SELECT
      f.fund_name,
      ROUND((fpf.return_annualized * 100)::NUMERIC, 2) AS return_1y_pct
    FROM fund_performance_fact fpf
    JOIN fund f ON fpf.fund_id = f.fund_id
    JOIN period_definition pd ON fpf.period_id = pd.period_id
    WHERE pd.period_code = '1Y'
    ORDER BY fpf.return_annualized ASC
    LIMIT 5;
  `;
  return res.rows.map((row) => ({
    fund_name: String(row.fund_name),
    return_1y_pct: toNumber(row.return_1y_pct),
  }));
}

async function fetchSharpeBySector(): Promise<SharpeBySectorRow[]> {
  const res = await sql`
    SELECT
      s.sector_name,
      ROUND(AVG(frf.sharpe_ratio_annualized)::NUMERIC, 3) AS avg_sharpe
    FROM fund_risk_fact frf
    JOIN fund f ON frf.fund_id = f.fund_id
    JOIN sector s ON f.sector_id = s.sector_id
    JOIN period_definition pd ON frf.period_id = pd.period_id
    WHERE pd.period_code = '3Y'
    GROUP BY s.sector_name
    ORDER BY avg_sharpe DESC;
  `;
  return res.rows.map((row) => ({
    sector_name: String(row.sector_name),
    avg_sharpe: toNumber(row.avg_sharpe),
  }));
}

async function fetchFlowsByPeerGroup(): Promise<FlowsByPeerGroupRow[]> {
  const res = await sql`
    SELECT
      pg.display_group_name AS peer_group_name,
      ROUND((SUM(fff.estimated_net_flow) / 1e6)::NUMERIC, 1) AS net_flow_m
    FROM fund_flow_fact fff
    JOIN fund f ON fff.fund_id = f.fund_id
    JOIN peer_group pg ON f.peer_group_id = pg.peer_group_id
    JOIN period_definition pd ON fff.period_id = pd.period_id
    WHERE pd.period_code = '1Y'
    GROUP BY pg.display_group_name
    ORDER BY net_flow_m DESC;
  `;
  return res.rows.map((row) => ({
    peer_group_name: String(row.peer_group_name),
    net_flow_m: toNumber(row.net_flow_m),
  }));
}

async function fetchQuartileDistribution(): Promise<QuartileDistRow[]> {
  const res = await sql`
    SELECT
      pg.display_group_name AS peer_group_name,
      COUNT(*) FILTER (WHERE frf.peer_group_quartile = 1)::INT AS q1,
      COUNT(*) FILTER (WHERE frf.peer_group_quartile = 2)::INT AS q2,
      COUNT(*) FILTER (WHERE frf.peer_group_quartile = 3)::INT AS q3,
      COUNT(*) FILTER (WHERE frf.peer_group_quartile = 4)::INT AS q4
    FROM fund_ranking_fact frf
    JOIN peer_group pg ON frf.peer_group_id = pg.peer_group_id
    JOIN period_definition pd ON frf.period_id = pd.period_id
    WHERE pd.period_code = '1Y'
    GROUP BY pg.display_group_name
    ORDER BY peer_group_name;
  `;
  return res.rows.map((row) => ({
    peer_group_name: String(row.peer_group_name),
    q1: toInt(row.q1),
    q2: toInt(row.q2),
    q3: toInt(row.q3),
    q4: toInt(row.q4),
  }));
}

async function fetchMorningstarDistribution(): Promise<MorningstarRow[]> {
  const res = await sql`
    SELECT
      morningstar_rating_overall::NUMERIC AS rating,
      COUNT(*)::INT AS count
    FROM fund
    WHERE morningstar_rating_overall IS NOT NULL
    GROUP BY morningstar_rating_overall
    ORDER BY rating DESC;
  `;
  return res.rows.map((row) => ({
    rating: toNumber(row.rating),
    count: toInt(row.count),
  }));
}

async function fetchAdvisorRecentTransactions(advisorId: number): Promise<AdvisorRecentTransaction[]> {
  const res = await sql`
    SELECT
      c.client_id,
      c.first_name || ' ' || c.last_name AS client_name,
      t.transaction_type,
      TO_CHAR(t.transaction_date, 'YYYY-MM-DD') AS transaction_date,
      ROUND(t.amount::NUMERIC, 2) AS amount
    FROM transaction t
    JOIN policy p ON p.policy_id = t.policy_id
    JOIN client c ON c.client_id = p.client_id
    WHERE c.advisor_id = ${advisorId}
      AND t.transaction_date >= NOW() - INTERVAL '90 days'
    ORDER BY t.transaction_date DESC, t.amount DESC
    LIMIT 8;
  `;
  return res.rows.map((row) => ({
    client_id: toInt(row.client_id),
    client_name: String(row.client_name),
    transaction_type: String(row.transaction_type),
    transaction_date: String(row.transaction_date),
    amount: toNumber(row.amount),
  }));
}

async function generateMorningBriefing(
  advisor: AdvisorInfo,
  clients: ClientRow[],
  priorityClients: PriorityClientInsight[],
  recentTransactions: AdvisorRecentTransaction[],
  marketLeaders: TopFundRow[],
  marketLaggards: MarketLaggard[],
  sharpeBySector: SharpeBySectorRow[],
  flowsByPeerGroup: FlowsByPeerGroupRow[],
  aumByAdvisor: AumByAdvisorRow[],
): Promise<MorningBriefing> {
  const advisorKpis = await getAdvisorKpis(advisor.advisor_id);
  const productSignalSummary = await summariseAdvisorProductSignals(advisor.advisor_id);

  const dormantClients = clients.filter((client) => client.status !== "active");
  const dormantAum = dormantClients.reduce((sum, client) => sum + client.total_aum, 0);
  const riskMismatches = clients.filter((client) => client.has_risk_mismatch).length;
  const bottomQuartileClients = clients.filter((client) => client.avg_quartile > 3).length;
  const topClientsByAum = [...clients]
    .sort((left, right) => right.total_aum - left.total_aum)
    .slice(0, 3)
    .map((client) => ({
      client_name: client.client_name,
      total_aum: formatZarShort(client.total_aum),
      avg_1y_return_pct: client.avg_1y_return_pct.toFixed(1),
    }));

  const recentLargeTransactions = recentTransactions
    .filter((transaction) => transaction.amount >= 50_000)
    .slice(0, 6)
    .map((transaction) => ({
      client_name: transaction.client_name,
      transaction_type: transaction.transaction_type,
      amount: formatZarShort(transaction.amount),
      transaction_date: transaction.transaction_date,
    }));

  const advisorCount = aumByAdvisor.length || 1;
  const totalFirmAum = aumByAdvisor.reduce((sum, row) => sum + row.total_aum, 0);
  const firmAvgAum = totalFirmAum / advisorCount;
  const firmAvgClientReturn =
    clients.length > 0
      ? clients.reduce((sum, client) => sum + client.avg_1y_return_pct, 0) / clients.length
      : 0;
  const ytdAumTarget = firmAvgAum * 1.05;
  const ytdReturnTarget = Math.max(firmAvgClientReturn, 8);
  const ytdRevenueTarget = advisorKpis.monthly_revenue * 12 * 1.05;
  const ytdActivePoliciesTarget = Math.round(advisorKpis.client_count * 1.5);

  const trackingTargets = {
    aum: {
      actual: formatZarShort(advisorKpis.my_aum),
      ytd_target: formatZarShort(ytdAumTarget),
      benchmark: `firm avg ${formatZarShort(firmAvgAum)} across ${advisorCount} advisors`,
    },
    avg_1y_return_pct: {
      actual: `${advisorKpis.avg_1y_return_pct.toFixed(1)}%`,
      ytd_target: `${ytdReturnTarget.toFixed(1)}%`,
      benchmark: `firm advisor-book avg ${firmAvgClientReturn.toFixed(1)}%`,
    },
    annualised_revenue: {
      actual: formatZarShort(advisorKpis.monthly_revenue * 12),
      ytd_target: formatZarShort(ytdRevenueTarget),
      benchmark: `monthly revenue ${formatZarShort(advisorKpis.monthly_revenue)}`,
    },
    active_policies: {
      actual: advisorKpis.active_policy_count,
      ytd_target: ytdActivePoliciesTarget,
      benchmark: `target ≈ 1.5 policies per client (${advisorKpis.client_count} clients)`,
    },
  };

  const llmInput = [
    `Advisor: ${advisor.advisor_name} (${advisor.branch}, ${advisor.region})`,
    `Advisor KPIs: AUM ${formatZarShort(advisorKpis.my_aum)}, ${advisorKpis.client_count} clients, ${advisorKpis.active_policy_count} active policies, avg 1Y return ${advisorKpis.avg_1y_return_pct.toFixed(1)}%, monthly revenue ${formatZarShort(advisorKpis.monthly_revenue)}.`,
    `YTD tracking vs target (use these for the tracking_vs_target section): ${JSON.stringify(trackingTargets)}.`,
    `Client book health: ${dormantClients.length} dormant/inactive clients representing ${formatZarShort(dormantAum)}, ${riskMismatches} risk mismatches, ${bottomQuartileClients} clients with average quartile above 3.`,
    `Top clients by AUM: ${JSON.stringify(topClientsByAum)}.`,
    `Priority clients for today (use these for the todays_agenda section): ${JSON.stringify(priorityClients)}.`,
    `Mapped product intelligence: ${productSignalSummary.mapped_client_count} clients mapped, ${productSignalSummary.cost_review_count} cost reviews, ${productSignalSummary.fit_review_count} fit reviews. Top signals: ${JSON.stringify(productSignalSummary.top_signals)}.`,
    `Recent client transactions over last 90 days (use these for the recent_activity section): ${JSON.stringify(recentLargeTransactions)}.`,
    `Market leaders by 1Y return: ${JSON.stringify(marketLeaders.slice(0, 3))}.`,
    `Market laggards by 1Y return: ${JSON.stringify(marketLaggards.slice(0, 3))}.`,
    `Sharpe by sector: ${JSON.stringify(sharpeBySector.slice(0, 4))}.`,
    `Net flows by peer group: ${JSON.stringify(flowsByPeerGroup.slice(0, 5))}.`,
    "Return JSON with an intro plus the four required sections: market_insights, todays_agenda, tracking_vs_target, recent_activity.",
  ].join("\n");

  const llmOutput = await generateMorningBriefingContent(llmInput);

  return {
    intro: llmOutput.intro.trim(),
    sections: [
      {
        key: "market_insights",
        title: "Market Insights",
        headline: llmOutput.market_insights_headline.trim(),
        body: llmOutput.market_insights.trim(),
      },
      {
        key: "todays_agenda",
        title: "Today's Agenda",
        headline: llmOutput.todays_agenda_headline.trim(),
        body: llmOutput.todays_agenda.trim(),
      },
      {
        key: "tracking_vs_target",
        title: "Tracking vs Target (YTD)",
        headline: llmOutput.tracking_vs_target_headline.trim(),
        body: llmOutput.tracking_vs_target.trim(),
      },
      {
        key: "recent_activity",
        title: "Recent Activity",
        headline: llmOutput.recent_activity_headline.trim(),
        body: llmOutput.recent_activity.trim(),
      },
    ],
    priority_clients: priorityClients,
    today_actions: buildTodayActions(advisor.advisor_id, priorityClients),
  };
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

export async function getStoredDashboardInsights(
  advisorId: number,
): Promise<StoredDashboardInsights> {
  await ensureDashboardInsightsTable();

  const result = await sql`
    SELECT data, generated_at
    FROM dashboard_insights
    WHERE insight_key = ${dashboardInsightKey(advisorId)}
    LIMIT 1;
  `;

  const row = result.rows[0];
  if (!row) {
    return { insights: null, generated_at: null };
  }

  return {
    insights: row.data as DashboardInsights,
    generated_at: new Date(String(row.generated_at)).toISOString(),
  };
}

export async function storeDashboardInsights(
  advisorId: number,
  insights: DashboardInsights,
): Promise<void> {
  await ensureDashboardInsightsTable();

  await sql`
    INSERT INTO dashboard_insights (insight_key, advisor_id, data, generated_at)
    VALUES (
      ${dashboardInsightKey(advisorId)},
      ${advisorId},
      ${JSON.stringify(insights)},
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

export async function generateAllInsights(advisorId: number): Promise<DashboardInsights> {
  const advisors = await getAdvisors();
  const advisor = advisors.find((candidate) => candidate.advisor_id === advisorId);
  if (!advisor) {
    throw new Error(`Advisor ${advisorId} not found`);
  }

  const [
    clients,
    aumByAdvisor,
    riskProfile,
    policyType,
    topClients,
    txActivity,
    atRisk,
    topFunds,
    marketLaggards,
    sharpeBySector,
    flowsByPg,
    quartileDist,
    morningstar,
    recentTransactions,
    productSignals,
  ] = await Promise.all([
    getAdvisorClients(advisorId),
    fetchAumByAdvisor(),
    fetchRiskProfileBreakdown(),
    fetchPolicyTypeDistribution(),
    fetchTopClients(),
    fetchTransactionActivity(),
    fetchAtRiskClients(),
    fetchTopFunds1Y(),
    fetchMarketLaggards1Y(),
    fetchSharpeBySector(),
    fetchFlowsByPeerGroup(),
    fetchQuartileDistribution(),
    fetchMorningstarDistribution(),
    fetchAdvisorRecentTransactions(advisorId),
    getAdvisorClientProductSignals(advisorId),
  ]);

  const priorityClients = buildPriorityClients(clients, recentTransactions, productSignals);

  const [
    aumCaption,
    riskCaption,
    policyCaption,
    clientsCaption,
    txCaption,
    atRiskCaption,
    topFundsCaption,
    sharpeCaption,
    flowsCaption,
    quartileCaption,
    morningstarCaption,
    morningBriefing,
  ] = await Promise.all([
    generateCaption(`AUM by advisor in ZAR: ${JSON.stringify(aumByAdvisor)}. Write one sentence about the distribution.`),
    generateCaption(`Client risk profiles: ${JSON.stringify(riskProfile)}. Write one sentence about the mix.`),
    generateCaption(`Policy types: ${JSON.stringify(policyType)}. Write one sentence about the dominant policy types.`),
    generateCaption(`Top 10 clients by portfolio value in ZAR: ${JSON.stringify(topClients)}. Write one sentence about concentration.`),
    generateCaption(`Monthly transaction activity: ${JSON.stringify(txActivity)}. Write one sentence about the recent trend.`),
    generateCaption(`At-risk clients: ${JSON.stringify(atRisk)}. Write one sentence about re-engagement opportunity.`),
    generateCaption(`Top 10 funds by 1Y return: ${JSON.stringify(topFunds)}. Write one sentence about the leaders.`),
    generateCaption(`Average Sharpe ratio by sector: ${JSON.stringify(sharpeBySector)}. Write one sentence about risk-adjusted leadership.`),
    generateCaption(`Net flows by peer group in ZAR millions: ${JSON.stringify(flowsByPg)}. Write one sentence about fund flows.`),
    generateCaption(`Quartile distribution by peer group: ${JSON.stringify(quartileDist)}. Write one sentence about fund quality.`),
    generateCaption(`Morningstar distribution: ${JSON.stringify(morningstar)}. Write one sentence about the ratings mix.`),
    generateMorningBriefing(
      advisor,
      clients,
      priorityClients,
      recentTransactions,
      topFunds,
      marketLaggards,
      sharpeBySector,
      flowsByPg,
      aumByAdvisor,
    ),
  ]);

  return {
    morning_briefing: morningBriefing,
    aum_by_advisor: { data: aumByAdvisor, caption: aumCaption },
    risk_profile_breakdown: { data: riskProfile, caption: riskCaption },
    policy_type_distribution: { data: policyType, caption: policyCaption },
    top_clients: { data: topClients, caption: clientsCaption },
    transaction_activity: { data: txActivity, caption: txCaption },
    at_risk_clients: { data: atRisk, caption: atRiskCaption },
    top_funds_1y: { data: topFunds, caption: topFundsCaption },
    sharpe_by_sector: { data: sharpeBySector, caption: sharpeCaption },
    flows_by_peer_group: { data: flowsByPg, caption: flowsCaption },
    quartile_distribution: { data: quartileDist, caption: quartileCaption },
    morningstar_distribution: { data: morningstar, caption: morningstarCaption },
  };
}
