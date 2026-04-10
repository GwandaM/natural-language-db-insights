/**
 * Insight generation logic for the Investment Advisor CRM dashboard.
 * Two categories: Book of Business (advisor/client/policy) and Fund Analytics.
 */

import { sql } from "@vercel/postgres";
import { generateText } from "ai";
import { llmModel } from "@/lib/llm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KpiData {
  total_aum: number;
  total_clients: number;
  active_policies: number;
  total_funds: number;
  avg_1y_return: number;
  monthly_revenue: number;
}

export interface AumByAdvisorRow     { advisor_name: string; total_aum: number }
export interface RiskProfileRow      { risk_profile: string; count: number }
export interface PolicyTypeRow       { policy_type: string; count: number }
export interface TopClientRow        { client_name: string; total_value: number }
export interface TransactionRow      { month: string; tx_count: number; total_amount: number }
export interface AtRiskClientRow     { client_name: string; status: string; total_value: number }
export interface TopFundRow          { fund_name: string; return_1y_pct: number }
export interface SharpeBySectorRow   { sector_name: string; avg_sharpe: number }
export interface FlowsByPeerGroupRow { peer_group_name: string; net_flow_m: number }
export interface QuartileDistRow     { peer_group_name: string; q1: number; q2: number; q3: number; q4: number }
export interface MorningstarRow      { rating: number; count: number }

export interface InsightPayload<T> {
  data: T;
  caption: string;
}

export interface DashboardInsights {
  kpis: KpiData;
  // Book of Business
  aum_by_advisor:           InsightPayload<AumByAdvisorRow[]>;
  risk_profile_breakdown:   InsightPayload<RiskProfileRow[]>;
  policy_type_distribution: InsightPayload<PolicyTypeRow[]>;
  top_clients:              InsightPayload<TopClientRow[]>;
  transaction_activity:     InsightPayload<TransactionRow[]>;
  at_risk_clients:          InsightPayload<AtRiskClientRow[]>;
  // Fund Analytics
  top_funds_1y:             InsightPayload<TopFundRow[]>;
  sharpe_by_sector:         InsightPayload<SharpeBySectorRow[]>;
  flows_by_peer_group:      InsightPayload<FlowsByPeerGroupRow[]>;
  quartile_distribution:    InsightPayload<QuartileDistRow[]>;
  morningstar_distribution: InsightPayload<MorningstarRow[]>;
  narrative: string;
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

async function fetchKpis(): Promise<KpiData> {
  const [aumRes, fundRes, perfRes] = await Promise.all([
    sql`
      SELECT
        SUM(total_aum)::BIGINT      AS total_aum,
        SUM(total_clients)::INT     AS total_clients,
        SUM(active_policies)::INT   AS active_policies,
        SUM(monthly_revenue)        AS monthly_revenue
      FROM advisor_aum
      WHERE as_of_date = (SELECT MAX(as_of_date) FROM advisor_aum);
    `,
    sql`SELECT COUNT(*)::INT AS total_funds FROM fund;`,
    sql`
      SELECT ROUND(AVG(return_annualized * 100)::NUMERIC, 2) AS avg_1y_return
      FROM fund_performance_fact fpf
      JOIN period_definition pd ON fpf.period_id = pd.period_id
      WHERE pd.period_code = '1Y';
    `,
  ]);
  const a = aumRes.rows[0];
  return {
    total_aum:       parseFloat(a.total_aum)        ?? 0,
    total_clients:   a.total_clients                ?? 0,
    active_policies: a.active_policies              ?? 0,
    monthly_revenue: parseFloat(a.monthly_revenue)  ?? 0,
    total_funds:     fundRes.rows[0].total_funds    ?? 0,
    avg_1y_return:   parseFloat(perfRes.rows[0].avg_1y_return) ?? 0,
  };
}

async function fetchAumByAdvisor(): Promise<AumByAdvisorRow[]> {
  const res = await sql`
    SELECT a.advisor_name, aa.total_aum
    FROM advisor_aum aa
    JOIN advisor a ON aa.advisor_id = a.advisor_id
    WHERE aa.as_of_date = (SELECT MAX(as_of_date) FROM advisor_aum)
    ORDER BY aa.total_aum DESC;
  `;
  return res.rows.map((r) => ({ advisor_name: r.advisor_name, total_aum: parseFloat(r.total_aum) }));
}

async function fetchRiskProfileBreakdown(): Promise<RiskProfileRow[]> {
  const res = await sql`
    SELECT risk_profile, COUNT(*)::INT AS count FROM client GROUP BY risk_profile ORDER BY count DESC;
  `;
  return res.rows.map((r) => ({ risk_profile: r.risk_profile, count: r.count }));
}

async function fetchPolicyTypeDistribution(): Promise<PolicyTypeRow[]> {
  const res = await sql`
    SELECT policy_type, COUNT(*)::INT AS count FROM policy GROUP BY policy_type ORDER BY count DESC;
  `;
  return res.rows.map((r) => ({ policy_type: r.policy_type, count: r.count }));
}

async function fetchTopClients(): Promise<TopClientRow[]> {
  const res = await sql`
    SELECT
      c.first_name || ' ' || c.last_name AS client_name,
      SUM(p.current_value)               AS total_value
    FROM policy p
    JOIN client c ON p.client_id = c.client_id
    GROUP BY c.client_id, c.first_name, c.last_name
    ORDER BY total_value DESC
    LIMIT 10;
  `;
  return res.rows.map((r) => ({ client_name: r.client_name, total_value: parseFloat(r.total_value) }));
}

async function fetchTransactionActivity(): Promise<TransactionRow[]> {
  const res = await sql`
    SELECT
      TO_CHAR(transaction_date, 'YYYY-MM') AS month,
      COUNT(*)::INT                        AS tx_count,
      ROUND(SUM(amount)::NUMERIC, 2)       AS total_amount
    FROM transaction
    WHERE transaction_date >= NOW() - INTERVAL '12 months'
    GROUP BY month
    ORDER BY month ASC;
  `;
  return res.rows.map((r) => ({
    month: r.month, tx_count: r.tx_count, total_amount: parseFloat(r.total_amount),
  }));
}

async function fetchAtRiskClients(): Promise<AtRiskClientRow[]> {
  const res = await sql`
    SELECT
      c.first_name || ' ' || c.last_name AS client_name,
      c.status,
      COALESCE(SUM(p.current_value), 0)  AS total_value
    FROM client c
    LEFT JOIN policy p ON c.client_id = p.client_id
    WHERE c.status IN ('dormant', 'inactive')
    GROUP BY c.client_id, c.first_name, c.last_name, c.status
    ORDER BY total_value DESC
    LIMIT 10;
  `;
  return res.rows.map((r) => ({
    client_name: r.client_name, status: r.status, total_value: parseFloat(r.total_value),
  }));
}

async function fetchTopFunds1Y(): Promise<TopFundRow[]> {
  const res = await sql`
    SELECT
      f.fund_name,
      ROUND((fpf.return_annualized * 100)::NUMERIC, 2) AS return_1y_pct
    FROM fund_performance_fact fpf
    JOIN fund f               ON fpf.fund_id   = f.fund_id
    JOIN period_definition pd ON fpf.period_id = pd.period_id
    WHERE pd.period_code = '1Y'
    ORDER BY fpf.return_annualized DESC
    LIMIT 10;
  `;
  return res.rows.map((r) => ({ fund_name: r.fund_name, return_1y_pct: parseFloat(r.return_1y_pct) }));
}

async function fetchSharpeBySector(): Promise<SharpeBySectorRow[]> {
  const res = await sql`
    SELECT
      s.sector_name,
      ROUND(AVG(frf.sharpe_ratio_annualized)::NUMERIC, 3) AS avg_sharpe
    FROM fund_risk_fact frf
    JOIN fund f               ON frf.fund_id   = f.fund_id
    JOIN sector s             ON f.sector_id   = s.sector_id
    JOIN period_definition pd ON frf.period_id = pd.period_id
    WHERE pd.period_code = '3Y'
    GROUP BY s.sector_name
    ORDER BY avg_sharpe DESC;
  `;
  return res.rows.map((r) => ({ sector_name: r.sector_name, avg_sharpe: parseFloat(r.avg_sharpe) }));
}

async function fetchFlowsByPeerGroup(): Promise<FlowsByPeerGroupRow[]> {
  const res = await sql`
    SELECT
      pg.display_group_name                                   AS peer_group_name,
      ROUND((SUM(fff.estimated_net_flow) / 1e6)::NUMERIC, 1) AS net_flow_m
    FROM fund_flow_fact fff
    JOIN fund f               ON fff.fund_id     = f.fund_id
    JOIN peer_group pg        ON f.peer_group_id = pg.peer_group_id
    JOIN period_definition pd ON fff.period_id   = pd.period_id
    WHERE pd.period_code = '1Y'
    GROUP BY pg.display_group_name
    ORDER BY net_flow_m DESC;
  `;
  return res.rows.map((r) => ({ peer_group_name: r.peer_group_name, net_flow_m: parseFloat(r.net_flow_m) }));
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
    JOIN peer_group pg        ON frf.peer_group_id = pg.peer_group_id
    JOIN period_definition pd ON frf.period_id     = pd.period_id
    WHERE pd.period_code = '1Y'
    GROUP BY pg.display_group_name
    ORDER BY peer_group_name;
  `;
  return res.rows.map((r) => ({
    peer_group_name: r.peer_group_name,
    q1: r.q1, q2: r.q2, q3: r.q3, q4: r.q4,
  }));
}

async function fetchMorningstarDistribution(): Promise<MorningstarRow[]> {
  const res = await sql`
    SELECT
      morningstar_rating_overall::NUMERIC AS rating,
      COUNT(*)::INT                        AS count
    FROM fund
    WHERE morningstar_rating_overall IS NOT NULL
    GROUP BY morningstar_rating_overall
    ORDER BY rating DESC;
  `;
  return res.rows.map((r) => ({ rating: parseFloat(r.rating), count: r.count }));
}

// ---------------------------------------------------------------------------
// LLM caption helpers
// ---------------------------------------------------------------------------

async function generateCaption(prompt: string): Promise<string> {
  const { text } = await generateText({ model: llmModel, prompt, maxOutputTokens: 120 });
  return text.trim();
}

async function generateNarrative(prompt: string): Promise<string> {
  const { text } = await generateText({ model: llmModel, prompt, maxOutputTokens: 600 });
  return text.trim();
}

// ---------------------------------------------------------------------------
// Main export: generate all insights
// ---------------------------------------------------------------------------

export async function generateAllInsights(): Promise<DashboardInsights> {
  const [
    kpis, aumByAdvisor, riskProfile, policyType, topClients,
    txActivity, atRisk, topFunds, sharpeBySector, flowsByPg,
    quartileDist, morningstar,
  ] = await Promise.all([
    fetchKpis(), fetchAumByAdvisor(), fetchRiskProfileBreakdown(),
    fetchPolicyTypeDistribution(), fetchTopClients(), fetchTransactionActivity(),
    fetchAtRiskClients(), fetchTopFunds1Y(), fetchSharpeBySector(),
    fetchFlowsByPeerGroup(), fetchQuartileDistribution(), fetchMorningstarDistribution(),
  ]);

  const [
    aumCaption, riskCaption, policyCaption, clientsCaption, txCaption,
    atRiskCaption, topFundsCaption, sharpeCaption, flowsCaption,
    quartileCaption, morningstarCaption, narrative,
  ] = await Promise.all([
    generateCaption(`AUM by advisor (ZAR): ${JSON.stringify(aumByAdvisor)}. Write one sentence about the distribution.`),
    generateCaption(`Client risk profiles: ${JSON.stringify(riskProfile)}. Write one sentence about the split.`),
    generateCaption(`Policy types: ${JSON.stringify(policyType)}. Write one sentence about the most common types.`),
    generateCaption(`Top 10 clients by portfolio value (ZAR): ${JSON.stringify(topClients)}. Write one sentence about concentration.`),
    generateCaption(`Monthly transaction activity: ${JSON.stringify(txActivity)}. Write one sentence about the trend.`),
    generateCaption(`At-risk clients (dormant/inactive): ${JSON.stringify(atRisk)}. Write one sentence about re-engagement opportunity.`),
    generateCaption(`Top 10 funds by 1Y return (%): ${JSON.stringify(topFunds)}. Write one sentence about the top performers.`),
    generateCaption(`Average Sharpe ratio by sector (3Y): ${JSON.stringify(sharpeBySector)}. Write one sentence about risk-adjusted returns.`),
    generateCaption(`Net fund flows by peer group (ZAR millions, 1Y): ${JSON.stringify(flowsByPg)}. Write one sentence about capital flows.`),
    generateCaption(`Quartile distribution by peer group (1Y): ${JSON.stringify(quartileDist)}. Write one sentence about fund quality.`),
    generateCaption(`Morningstar rating distribution: ${JSON.stringify(morningstar)}. Write one sentence about overall quality.`),
    generateNarrative(
      `You are writing for an Investment Advisor CRM executive dashboard. ` +
      `KPIs: Total AUM R${(kpis.total_aum / 1e9).toFixed(1)}B across ${kpis.total_clients} clients, ` +
      `${kpis.total_funds} funds, avg 1Y return ${kpis.avg_1y_return}%, ` +
      `monthly revenue R${(kpis.monthly_revenue / 1e6).toFixed(1)}M. ` +
      `Top advisors: ${JSON.stringify(aumByAdvisor.slice(0, 3))}. ` +
      `Best funds: ${JSON.stringify(topFunds.slice(0, 3))}. ` +
      `At-risk clients: ${atRisk.length}. ` +
      `Write 3-4 sentences of key insights in plain English. Be specific with numbers.`
    ),
  ]);

  return {
    kpis,
    aum_by_advisor:           { data: aumByAdvisor,   caption: aumCaption },
    risk_profile_breakdown:   { data: riskProfile,    caption: riskCaption },
    policy_type_distribution: { data: policyType,     caption: policyCaption },
    top_clients:              { data: topClients,     caption: clientsCaption },
    transaction_activity:     { data: txActivity,     caption: txCaption },
    at_risk_clients:          { data: atRisk,         caption: atRiskCaption },
    top_funds_1y:             { data: topFunds,       caption: topFundsCaption },
    sharpe_by_sector:         { data: sharpeBySector, caption: sharpeCaption },
    flows_by_peer_group:      { data: flowsByPg,      caption: flowsCaption },
    quartile_distribution:    { data: quartileDist,   caption: quartileCaption },
    morningstar_distribution: { data: morningstar,    caption: morningstarCaption },
    narrative,
  };
}
