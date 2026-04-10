/**
 * Advisor-scoped SQL queries for the broker dashboard.
 * No LLM, no caching — fresh on every request.
 */

import { sql } from "@vercel/postgres";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdvisorInfo {
  advisor_id: number;
  advisor_name: string;
  branch: string;
  region: string;
}

export interface AdvisorKpis {
  my_aum: number;
  client_count: number;
  active_policy_count: number;
  avg_1y_return_pct: number;
  monthly_revenue: number;
  at_risk_count: number;
}

export interface ClientRow {
  client_id: number;
  client_name: string;
  risk_profile: string;
  status: string;
  client_since: string;
  total_aum: number;
  policy_count: number;
  avg_1y_return_pct: number;
  avg_quartile: number;
  last_activity: string | null;
  has_risk_mismatch: boolean;
  commission_score: number;
}

export interface AdvisorBookStats {
  risk_profile_breakdown: { risk_profile: string; count: number }[];
  policy_type_distribution: { policy_type: string; count: number }[];
  transaction_activity: { month: string; tx_count: number; total_amount: number }[];
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAdvisors(): Promise<AdvisorInfo[]> {
  const res = await sql`
    SELECT advisor_id, advisor_name, branch, region
    FROM advisor
    ORDER BY advisor_name ASC;
  `;
  return res.rows.map((r) => ({
    advisor_id:   r.advisor_id,
    advisor_name: r.advisor_name,
    branch:       r.branch,
    region:       r.region,
  }));
}

export async function getAdvisorKpis(advisorId: number): Promise<AdvisorKpis> {
  const [aumRes, atRiskRes, perfRes] = await Promise.all([
    sql`
      SELECT
        COALESCE(SUM(p.current_value), 0)::NUMERIC       AS my_aum,
        COUNT(DISTINCT c.client_id)::INT                  AS client_count,
        COUNT(DISTINCT p.policy_id) FILTER (WHERE p.status = 'active')::INT
                                                          AS active_policy_count,
        COALESCE(SUM(p.current_value) * 0.005 / 12, 0)::NUMERIC AS monthly_revenue
      FROM client c
      JOIN policy p ON p.client_id = c.client_id
      WHERE c.advisor_id = ${advisorId};
    `,
    sql`
      SELECT COUNT(DISTINCT client_id)::INT AS at_risk_count
      FROM client
      WHERE advisor_id = ${advisorId} AND status IN ('dormant', 'inactive');
    `,
    sql`
      SELECT
        ROUND((
          SUM(fpf.return_annualized * p.current_value)
          / NULLIF(SUM(p.current_value), 0) * 100
        )::NUMERIC, 1) AS avg_1y_return_pct
      FROM client c
      JOIN policy p ON p.client_id = c.client_id
      JOIN fund_performance_fact fpf ON fpf.fund_id = p.fund_id
      JOIN period_definition pd ON fpf.period_id = pd.period_id
      WHERE c.advisor_id = ${advisorId}
        AND pd.period_code = '1Y';
    `,
  ]);

  const a = aumRes.rows[0];
  return {
    my_aum:              parseFloat(a.my_aum)                                ?? 0,
    client_count:        a.client_count                                      ?? 0,
    active_policy_count: a.active_policy_count                               ?? 0,
    monthly_revenue:     parseFloat(a.monthly_revenue)                       ?? 0,
    at_risk_count:       atRiskRes.rows[0].at_risk_count                     ?? 0,
    avg_1y_return_pct:   parseFloat(perfRes.rows[0].avg_1y_return_pct ?? "0") ?? 0,
  };
}

export async function getAdvisorClients(advisorId: number): Promise<ClientRow[]> {
  const res = await sql`
    SELECT
      c.client_id,
      c.first_name || ' ' || c.last_name                  AS client_name,
      c.risk_profile,
      c.status,
      TO_CHAR(c.client_since, 'YYYY-MM-DD')               AS client_since,
      COALESCE(SUM(p.current_value), 0)::NUMERIC           AS total_aum,
      COUNT(DISTINCT p.policy_id)::INT                     AS policy_count,
      ROUND((
        SUM(fpf.return_annualized * p.current_value)
        / NULLIF(SUM(p.current_value), 0) * 100
      )::NUMERIC, 1)                                       AS avg_1y_return_pct,
      ROUND(AVG(frf.peer_group_quartile)::NUMERIC, 1)      AS avg_quartile,
      MAX(t.transaction_date)::TEXT                        AS last_activity,
      BOOL_OR(
        (c.risk_profile = 'conservative' AND f.sector_id = 1) OR
        (c.risk_profile = 'aggressive'   AND f.sector_id = 4)
      )                                                    AS has_risk_mismatch,
      COALESCE(SUM(p.current_value), 0)
        * COALESCE(AVG(frf.peer_group_quartile), 2) / 4.0  AS commission_score
    FROM client c
    JOIN policy p ON p.client_id = c.client_id
    JOIN fund f   ON f.fund_id = p.fund_id
    LEFT JOIN fund_performance_fact fpf ON fpf.fund_id = f.fund_id
      AND fpf.period_id = (
        SELECT period_id FROM period_definition WHERE period_code = '1Y'
      )
    LEFT JOIN fund_ranking_fact frf ON frf.fund_id = f.fund_id
      AND frf.period_id = (
        SELECT period_id FROM period_definition WHERE period_code = '1Y'
      )
    LEFT JOIN transaction t ON t.policy_id = p.policy_id
    WHERE c.advisor_id = ${advisorId}
    GROUP BY c.client_id, c.first_name, c.last_name, c.risk_profile, c.status, c.client_since
    ORDER BY total_aum DESC;
  `;

  return res.rows.map((r) => ({
    client_id:          r.client_id,
    client_name:        r.client_name,
    risk_profile:       r.risk_profile,
    status:             r.status,
    client_since:       r.client_since,
    total_aum:          parseFloat(r.total_aum)          ?? 0,
    policy_count:       r.policy_count                   ?? 0,
    avg_1y_return_pct:  parseFloat(r.avg_1y_return_pct ?? "0") ?? 0,
    avg_quartile:       parseFloat(r.avg_quartile ?? "2")       ?? 2,
    last_activity:      r.last_activity ?? null,
    has_risk_mismatch:  r.has_risk_mismatch               ?? false,
    commission_score:   parseFloat(r.commission_score)   ?? 0,
  }));
}

export async function getAdvisorBookStats(advisorId: number): Promise<AdvisorBookStats> {
  const [riskRes, policyRes, txRes] = await Promise.all([
    sql`
      SELECT c.risk_profile, COUNT(*)::INT AS count
      FROM client c
      WHERE c.advisor_id = ${advisorId}
      GROUP BY c.risk_profile
      ORDER BY count DESC;
    `,
    sql`
      SELECT p.policy_type, COUNT(*)::INT AS count
      FROM policy p
      JOIN client c ON c.client_id = p.client_id
      WHERE c.advisor_id = ${advisorId}
      GROUP BY p.policy_type
      ORDER BY count DESC;
    `,
    sql`
      SELECT
        TO_CHAR(t.transaction_date, 'YYYY-MM') AS month,
        COUNT(*)::INT                           AS tx_count,
        ROUND(SUM(t.amount)::NUMERIC, 2)        AS total_amount
      FROM transaction t
      JOIN policy p  ON t.policy_id  = p.policy_id
      JOIN client c  ON p.client_id  = c.client_id
      WHERE c.advisor_id = ${advisorId}
        AND t.transaction_date >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC;
    `,
  ]);

  return {
    risk_profile_breakdown:   riskRes.rows.map((r) => ({ risk_profile: r.risk_profile, count: r.count })),
    policy_type_distribution: policyRes.rows.map((r) => ({ policy_type: r.policy_type, count: r.count })),
    transaction_activity:     txRes.rows.map((r) => ({
      month:        r.month,
      tx_count:     r.tx_count,
      total_amount: parseFloat(r.total_amount),
    })),
  };
}
