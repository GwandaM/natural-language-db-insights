/**
 * Advisor-scoped SQL queries for the advisor cockpit.
 * No LLM or caching in this module — only read models and heuristics.
 */

import { sql } from "@vercel/postgres";
import { ensureCommunicationDraftsTable } from "@/lib/cockpit-storage";

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

export interface ClientAlert {
  label: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

export interface ClientTalkingPoint {
  title: string;
  detail: string;
}

export interface ClientPolicySummary {
  policy_id: number;
  policy_number: string;
  policy_type: string;
  status: string;
  fund_id: number;
  fund_name: string;
  fund_ticker: string | null;
  sector_id: number | null;
  sector_name: string | null;
  peer_group_name: string | null;
  inception_date: string;
  initial_investment: number;
  current_value: number;
  one_year_return_pct: number;
  quartile: number;
  allocation_pct: number;
}

export interface ClientTransactionSummary {
  transaction_id: number;
  transaction_type: string;
  transaction_date: string;
  amount: number;
  policy_number: string;
  fund_name: string;
  status: string;
}

export interface ClientDetail {
  client_id: number;
  advisor_id: number;
  advisor_name: string;
  client_name: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  age: number | null;
  risk_profile: string;
  client_since: string;
  status: string;
  id_number: string | null;
  total_aum: number;
  policy_count: number;
  active_policy_count: number;
  avg_1y_return_pct: number;
  avg_quartile: number;
  last_activity: string | null;
  has_risk_mismatch: boolean;
  policies: ClientPolicySummary[];
  recent_transactions: ClientTransactionSummary[];
  alerts: ClientAlert[];
  talking_points: ClientTalkingPoint[];
}

export interface AttachmentReference {
  id: string;
  name: string;
  note: string;
}

export interface CommunicationDraft {
  draft_id: number;
  client_id: number;
  advisor_id: number;
  draft_type: "email" | "meeting_request";
  status: "draft" | "ready" | "archived";
  subject: string;
  body: string;
  attachment_metadata: AttachmentReference[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

function formatDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

function getAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function daysSince(dateValue: string | null): number | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function buildClientAlerts(
  summary: Pick<
    ClientDetail,
    "status" | "risk_profile" | "last_activity" | "avg_quartile" | "total_aum" | "avg_1y_return_pct" | "has_risk_mismatch"
  >,
  policies: ClientPolicySummary[],
  recentTransactions: ClientTransactionSummary[],
): ClientAlert[] {
  const alerts: ClientAlert[] = [];
  const inactivityDays = daysSince(summary.last_activity);
  const topPolicy = policies[0];
  const topPolicyAllocation = topPolicy?.allocation_pct ?? 0;
  const recentWithdrawal = recentTransactions.find(
    (transaction) =>
      transaction.transaction_type === "withdrawal" &&
      transaction.amount >= Math.max(summary.total_aum * 0.05, 50_000),
  );

  if (summary.status !== "active") {
    alerts.push({
      label: "Relationship at risk",
      detail: `Client status is ${summary.status}. A proactive touchpoint should be prioritised.`,
      severity: "high",
    });
  }

  if (summary.has_risk_mismatch) {
    alerts.push({
      label: "Portfolio mismatch",
      detail: `Holdings appear misaligned with a ${summary.risk_profile} risk profile.`,
      severity: "high",
    });
  }

  if (summary.avg_quartile > 3) {
    alerts.push({
      label: "Bottom-quartile exposure",
      detail: "Average fund quartile is below target. Review fund selection and rebalance options.",
      severity: "medium",
    });
  }

  if (inactivityDays !== null && inactivityDays > 120) {
    alerts.push({
      label: "Low recent activity",
      detail: `No material activity has been recorded for ${inactivityDays} days.`,
      severity: "medium",
    });
  }

  if (topPolicyAllocation >= 60) {
    alerts.push({
      label: "Portfolio concentration",
      detail: `${topPolicy.fund_name} represents ${topPolicyAllocation.toFixed(1)}% of invested assets.`,
      severity: "medium",
    });
  }

  if (summary.avg_1y_return_pct < 5) {
    alerts.push({
      label: "Underwhelming recent returns",
      detail: `Weighted 1Y return is only ${summary.avg_1y_return_pct.toFixed(1)}%, which may warrant a review conversation.`,
      severity: "low",
    });
  }

  if (recentWithdrawal) {
    alerts.push({
      label: "Large withdrawal detected",
      detail: `Recent withdrawal of R${recentWithdrawal.amount.toLocaleString()} on ${recentWithdrawal.transaction_date}.`,
      severity: "high",
    });
  }

  return alerts.slice(0, 5);
}

function buildTalkingPoints(detail: Omit<ClientDetail, "talking_points">): ClientTalkingPoint[] {
  const latestTransaction = detail.recent_transactions[0];
  const topPolicy = detail.policies[0];
  const points: ClientTalkingPoint[] = [];

  points.push({
    title: "Portfolio review",
    detail: `${detail.client_name} currently holds ${detail.policy_count} policies with total AUM of R${detail.total_aum.toLocaleString()} and a weighted 1Y return of ${detail.avg_1y_return_pct.toFixed(1)}%.`,
  });

  if (topPolicy) {
    points.push({
      title: "Largest holding",
      detail: `${topPolicy.fund_name} is the largest position at ${topPolicy.allocation_pct.toFixed(1)}% of the client’s assets.`,
    });
  }

  if (detail.alerts.length > 0) {
    points.push({
      title: "Priority concern",
      detail: detail.alerts[0].detail,
    });
  }

  if (latestTransaction) {
    points.push({
      title: "Most recent activity",
      detail: `Latest transaction was a ${latestTransaction.transaction_type.replace("_", " ")} for R${latestTransaction.amount.toLocaleString()} on ${latestTransaction.transaction_date}.`,
    });
  }

  points.push({
    title: "Recommended next step",
    detail:
      detail.status === "active"
        ? "Use this conversation to confirm goals, validate risk tolerance, and identify any rebalancing or consolidation opportunities."
        : "Focus on re-engagement, confirm circumstances have not changed, and re-open the planning conversation.",
  });

  return points.slice(0, 5);
}

function parseAttachments(value: unknown): AttachmentReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return {
        id: String(record.id ?? ""),
        name: String(record.name ?? ""),
        note: String(record.note ?? ""),
      };
    })
    .filter((item): item is AttachmentReference => Boolean(item?.id && item.name));
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
  return res.rows.map((row) => ({
    advisor_id: toInt(row.advisor_id),
    advisor_name: String(row.advisor_name),
    branch: String(row.branch),
    region: String(row.region),
  }));
}

export async function getAdvisorKpis(advisorId: number): Promise<AdvisorKpis> {
  const [aumRes, atRiskRes, perfRes] = await Promise.all([
    sql`
      SELECT
        COALESCE(SUM(p.current_value), 0)::NUMERIC AS my_aum,
        COUNT(DISTINCT c.client_id)::INT AS client_count,
        COUNT(DISTINCT p.policy_id) FILTER (WHERE p.status = 'active')::INT AS active_policy_count,
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

  const summary = aumRes.rows[0] ?? {};
  return {
    my_aum: toNumber(summary.my_aum),
    client_count: toInt(summary.client_count),
    active_policy_count: toInt(summary.active_policy_count),
    monthly_revenue: toNumber(summary.monthly_revenue),
    at_risk_count: toInt(atRiskRes.rows[0]?.at_risk_count),
    avg_1y_return_pct: toNumber(perfRes.rows[0]?.avg_1y_return_pct),
  };
}

export async function getAdvisorClients(advisorId: number): Promise<ClientRow[]> {
  const res = await sql`
    SELECT
      c.client_id,
      c.first_name || ' ' || c.last_name AS client_name,
      c.risk_profile,
      c.status,
      TO_CHAR(c.client_since, 'YYYY-MM-DD') AS client_since,
      COALESCE(SUM(p.current_value), 0)::NUMERIC AS total_aum,
      COUNT(DISTINCT p.policy_id)::INT AS policy_count,
      ROUND((
        SUM(fpf.return_annualized * p.current_value)
        / NULLIF(SUM(p.current_value), 0) * 100
      )::NUMERIC, 1) AS avg_1y_return_pct,
      ROUND(AVG(frf.peer_group_quartile)::NUMERIC, 1) AS avg_quartile,
      MAX(t.transaction_date)::TEXT AS last_activity,
      BOOL_OR(
        (c.risk_profile = 'conservative' AND f.sector_id = 1) OR
        (c.risk_profile = 'aggressive' AND f.sector_id = 4)
      ) AS has_risk_mismatch,
      COALESCE(SUM(p.current_value), 0) * COALESCE(AVG(frf.peer_group_quartile), 2) / 4.0 AS commission_score
    FROM client c
    JOIN policy p ON p.client_id = c.client_id
    JOIN fund f ON f.fund_id = p.fund_id
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

  return res.rows.map((row) => ({
    client_id: toInt(row.client_id),
    client_name: String(row.client_name),
    risk_profile: String(row.risk_profile),
    status: String(row.status),
    client_since: String(row.client_since),
    total_aum: toNumber(row.total_aum),
    policy_count: toInt(row.policy_count),
    avg_1y_return_pct: toNumber(row.avg_1y_return_pct),
    avg_quartile: toNumber(row.avg_quartile, 2),
    last_activity: formatDate(row.last_activity),
    has_risk_mismatch: Boolean(row.has_risk_mismatch),
    commission_score: toNumber(row.commission_score),
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
        COUNT(*)::INT AS tx_count,
        ROUND(SUM(t.amount)::NUMERIC, 2) AS total_amount
      FROM transaction t
      JOIN policy p ON t.policy_id = p.policy_id
      JOIN client c ON p.client_id = c.client_id
      WHERE c.advisor_id = ${advisorId}
        AND t.transaction_date >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC;
    `,
  ]);

  return {
    risk_profile_breakdown: riskRes.rows.map((row) => ({
      risk_profile: String(row.risk_profile),
      count: toInt(row.count),
    })),
    policy_type_distribution: policyRes.rows.map((row) => ({
      policy_type: String(row.policy_type),
      count: toInt(row.count),
    })),
    transaction_activity: txRes.rows.map((row) => ({
      month: String(row.month),
      tx_count: toInt(row.tx_count),
      total_amount: toNumber(row.total_amount),
    })),
  };
}

export async function getClientDetail(
  advisorId: number,
  clientId: number,
): Promise<ClientDetail | null> {
  const [summaryRes, policiesRes, transactionsRes] = await Promise.all([
    sql`
      SELECT
        c.client_id,
        c.advisor_id,
        a.advisor_name,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        TO_CHAR(c.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        TO_CHAR(c.client_since, 'YYYY-MM-DD') AS client_since,
        c.status,
        c.risk_profile,
        c.id_number,
        COALESCE(SUM(p.current_value), 0)::NUMERIC AS total_aum,
        COUNT(DISTINCT p.policy_id)::INT AS policy_count,
        COUNT(DISTINCT p.policy_id) FILTER (WHERE p.status = 'active')::INT AS active_policy_count,
        ROUND((
          SUM(COALESCE(fpf.return_annualized, 0) * p.current_value)
          / NULLIF(SUM(p.current_value), 0) * 100
        )::NUMERIC, 1) AS avg_1y_return_pct,
        ROUND(AVG(COALESCE(frf.peer_group_quartile, 2))::NUMERIC, 1) AS avg_quartile,
        MAX(t.transaction_date)::TEXT AS last_activity
      FROM client c
      JOIN advisor a ON a.advisor_id = c.advisor_id
      LEFT JOIN policy p ON p.client_id = c.client_id
      LEFT JOIN fund f ON f.fund_id = p.fund_id
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
        AND c.client_id = ${clientId}
      GROUP BY
        c.client_id, c.advisor_id, a.advisor_name, c.first_name, c.last_name,
        c.email, c.phone, c.date_of_birth, c.client_since, c.status,
        c.risk_profile, c.id_number;
    `,
    sql`
      SELECT
        p.policy_id,
        p.policy_number,
        p.policy_type,
        p.status,
        p.fund_id,
        f.fund_name,
        f.ticker,
        f.sector_id,
        s.sector_name,
        pg.display_group_name AS peer_group_name,
        TO_CHAR(p.inception_date, 'YYYY-MM-DD') AS inception_date,
        COALESCE(p.initial_investment, 0)::NUMERIC AS initial_investment,
        COALESCE(p.current_value, 0)::NUMERIC AS current_value,
        ROUND((COALESCE(fpf.return_annualized, 0) * 100)::NUMERIC, 1) AS one_year_return_pct,
        COALESCE(frf.peer_group_quartile, 2)::INT AS quartile
      FROM policy p
      JOIN fund f ON f.fund_id = p.fund_id
      LEFT JOIN sector s ON s.sector_id = f.sector_id
      LEFT JOIN peer_group pg ON pg.peer_group_id = f.peer_group_id
      LEFT JOIN fund_performance_fact fpf ON fpf.fund_id = f.fund_id
        AND fpf.period_id = (
          SELECT period_id FROM period_definition WHERE period_code = '1Y'
        )
      LEFT JOIN fund_ranking_fact frf ON frf.fund_id = f.fund_id
        AND frf.period_id = (
          SELECT period_id FROM period_definition WHERE period_code = '1Y'
        )
      WHERE p.client_id = ${clientId}
      ORDER BY p.current_value DESC, p.policy_id ASC;
    `,
    sql`
      SELECT
        t.transaction_id,
        t.transaction_type,
        TO_CHAR(t.transaction_date, 'YYYY-MM-DD') AS transaction_date,
        COALESCE(t.amount, 0)::NUMERIC AS amount,
        p.policy_number,
        f.fund_name,
        t.status
      FROM transaction t
      JOIN policy p ON p.policy_id = t.policy_id
      JOIN fund f ON f.fund_id = t.fund_id
      WHERE p.client_id = ${clientId}
      ORDER BY t.transaction_date DESC, t.transaction_id DESC
      LIMIT 12;
    `,
  ]);

  const summaryRow = summaryRes.rows[0];
  if (!summaryRow) return null;

  const rawPolicies = policiesRes.rows.map((row) => ({
    policy_id: toInt(row.policy_id),
    policy_number: String(row.policy_number),
    policy_type: String(row.policy_type),
    status: String(row.status),
    fund_id: toInt(row.fund_id),
    fund_name: String(row.fund_name),
    fund_ticker: row.ticker ? String(row.ticker) : null,
    sector_id: row.sector_id === null || row.sector_id === undefined ? null : toInt(row.sector_id),
    sector_name: row.sector_name ? String(row.sector_name) : null,
    peer_group_name: row.peer_group_name ? String(row.peer_group_name) : null,
    inception_date: String(row.inception_date),
    initial_investment: toNumber(row.initial_investment),
    current_value: toNumber(row.current_value),
    one_year_return_pct: toNumber(row.one_year_return_pct),
    quartile: toInt(row.quartile, 2),
  }));

  const totalAum = toNumber(summaryRow.total_aum);
  const policies: ClientPolicySummary[] = rawPolicies.map((policy) => ({
    ...policy,
    allocation_pct: totalAum > 0 ? (policy.current_value / totalAum) * 100 : 0,
  }));

  const hasRiskMismatch = policies.some((policy) => {
    if (String(summaryRow.risk_profile) === "conservative") {
      return policy.sector_id === 1;
    }
    if (String(summaryRow.risk_profile) === "aggressive") {
      return policy.sector_id === 4;
    }
    return false;
  });

  const recentTransactions: ClientTransactionSummary[] = transactionsRes.rows.map((row) => ({
    transaction_id: toInt(row.transaction_id),
    transaction_type: String(row.transaction_type),
    transaction_date: String(row.transaction_date),
    amount: toNumber(row.amount),
    policy_number: String(row.policy_number),
    fund_name: String(row.fund_name),
    status: String(row.status),
  }));

  const detailBase: Omit<ClientDetail, "alerts" | "talking_points"> = {
    client_id: toInt(summaryRow.client_id),
    advisor_id: toInt(summaryRow.advisor_id),
    advisor_name: String(summaryRow.advisor_name),
    client_name: `${summaryRow.first_name} ${summaryRow.last_name}`,
    first_name: String(summaryRow.first_name),
    last_name: String(summaryRow.last_name),
    email: summaryRow.email ? String(summaryRow.email) : null,
    phone: summaryRow.phone ? String(summaryRow.phone) : null,
    date_of_birth: formatDate(summaryRow.date_of_birth),
    age: getAge(formatDate(summaryRow.date_of_birth)),
    risk_profile: String(summaryRow.risk_profile),
    client_since: String(summaryRow.client_since),
    status: String(summaryRow.status),
    id_number: summaryRow.id_number ? String(summaryRow.id_number) : null,
    total_aum: totalAum,
    policy_count: toInt(summaryRow.policy_count),
    active_policy_count: toInt(summaryRow.active_policy_count),
    avg_1y_return_pct: toNumber(summaryRow.avg_1y_return_pct),
    avg_quartile: toNumber(summaryRow.avg_quartile, 2),
    last_activity: formatDate(summaryRow.last_activity),
    has_risk_mismatch: hasRiskMismatch,
    policies,
    recent_transactions: recentTransactions,
  };

  const alerts = buildClientAlerts(detailBase, policies, recentTransactions);
  const talking_points = buildTalkingPoints({ ...detailBase, alerts });

  return {
    ...detailBase,
    alerts,
    talking_points,
  };
}

export async function getClientCommunicationDrafts(
  advisorId: number,
  clientId: number,
): Promise<CommunicationDraft[]> {
  await ensureCommunicationDraftsTable();

  const res = await sql`
    SELECT
      draft_id,
      client_id,
      advisor_id,
      draft_type,
      status,
      subject,
      body,
      attachment_metadata,
      created_at,
      updated_at
    FROM communication_drafts
    WHERE advisor_id = ${advisorId}
      AND client_id = ${clientId}
    ORDER BY updated_at DESC, draft_id DESC;
  `;

  return res.rows.map((row) => ({
    draft_id: toInt(row.draft_id),
    client_id: toInt(row.client_id),
    advisor_id: toInt(row.advisor_id),
    draft_type: String(row.draft_type) as CommunicationDraft["draft_type"],
    status: String(row.status) as CommunicationDraft["status"],
    subject: String(row.subject),
    body: String(row.body),
    attachment_metadata: parseAttachments(row.attachment_metadata),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  }));
}
