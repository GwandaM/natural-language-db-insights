/**
 * Family-level SQL queries for the family investing view.
 * Groups individual clients into household units and aggregates
 * wealth, policy structure, life stage, and tax-wrapper usage.
 */

import { sql } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FamilyRow {
  family_id: number;
  family_name: string;
  family_goal: string | null;
  advisor_id: number;
  member_count: number;
  combined_aum: number;
  policy_count: number;
  avg_1y_return_pct: number;
  has_living_annuity: boolean;
  has_tfsa: boolean;
  has_ra: boolean;
  life_stage: "pre_retirement" | "post_retirement" | "mixed" | "education_focus";
}

export interface FamilyMemberRow {
  client_id: number;
  family_member_id: number;
  relationship: string;
  is_primary: boolean;
  first_name: string;
  last_name: string;
  client_name: string;
  date_of_birth: string | null;
  age: number | null;
  risk_profile: string | null;
  status: string;
  total_aum: number;
  policy_count: number;
  avg_1y_return_pct: number;
  target_retirement_age: number | null;
  years_to_retirement: number | null;
  is_post_retirement: boolean;
  policy_types: string[];
}

export interface FamilyDetail {
  family_id: number;
  family_name: string;
  family_goal: string | null;
  advisor_id: number;
  members: FamilyMemberRow[];
  combined_aum: number;
  total_policies: number;
  life_stage: string;
  has_living_annuity: boolean;
  has_tfsa: boolean;
  has_ra: boolean;
  has_unit_trust: boolean;
  monthly_contributions: number;
  monthly_income: number;
  education_members: FamilyMemberRow[];
  retirement_members: FamilyMemberRow[];
  active_member_count: number;
}

export interface FamilyPolicyBreakdown {
  family_id: number;
  policy_type: string;
  count: number;
  total_value: number;
}

export interface FamilyWealthSplit {
  family_id: number;
  member_name: string;
  total_value: number;
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

function inferLifeStage(members: FamilyMemberRow[]): FamilyRow["life_stage"] {
  const hasUnder25 = members.some((m) => m.age !== null && m.age < 25);
  const allPostRetirement = members.every((m) => m.is_post_retirement);
  const anyPostRetirement = members.some((m) => m.is_post_retirement);

  if (hasUnder25 && !allPostRetirement) return "education_focus";
  if (allPostRetirement) return "post_retirement";
  if (anyPostRetirement) return "mixed";
  return "pre_retirement";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getFamiliesByAdvisor(advisorId: number): Promise<FamilyRow[]> {
  const res = await sql`
    SELECT
      f.family_id,
      f.family_name,
      f.family_goal,
      f.advisor_id,
      COUNT(DISTINCT fm.client_id)::INT                          AS member_count,
      COALESCE(SUM(p.current_value), 0)                         AS combined_aum,
      COUNT(p.policy_id)::INT                                    AS policy_count,
      COALESCE(
        AVG(pfh.return_annualized) FILTER (WHERE pfh.return_annualized IS NOT NULL),
        0
      ) * 100                                                    AS avg_1y_return_pct,
      BOOL_OR(LOWER(p.policy_type) LIKE '%living annuity%'
           OR LOWER(p.policy_type) LIKE '%la%')                  AS has_living_annuity,
      BOOL_OR(LOWER(p.policy_type) LIKE '%tfsa%'
           OR LOWER(p.policy_type) LIKE '%tax free%')            AS has_tfsa,
      BOOL_OR(LOWER(p.policy_type) LIKE '%ra%'
           OR LOWER(p.policy_type) LIKE '%retirement annuity%')  AS has_ra
    FROM family f
    JOIN family_member fm ON fm.family_id = f.family_id
    JOIN client c         ON c.client_id  = fm.client_id
    LEFT JOIN policy p    ON p.client_id  = c.client_id
                          AND p.status NOT IN ('lapsed','inactive')
    LEFT JOIN (
      SELECT DISTINCT ON (pfhs.policy_id)
        pfhs.policy_id,
        fps.return_annualized
      FROM policy_fund_holding_snapshot pfhs
      JOIN fund_performance_snapshot fps
        ON fps.fund_id = pfhs.fund_id
       AND fps.period_code = '1Y'
       AND fps.as_of_date = (
         SELECT MAX(as_of_date) FROM fund_performance_snapshot
         WHERE fund_id = pfhs.fund_id AND period_code = '1Y'
       )
      ORDER BY pfhs.policy_id, pfhs.as_of_date DESC
    ) pfh ON pfh.policy_id = p.policy_id
    WHERE f.advisor_id = ${advisorId}
    GROUP BY f.family_id, f.family_name, f.family_goal, f.advisor_id
    ORDER BY combined_aum DESC;
  `;

  return res.rows.map((row) => {
    const memberRows: FamilyMemberRow[] = [];
    const lifeStage = inferLifeStage(memberRows);
    return {
      family_id: toInt(row.family_id),
      family_name: String(row.family_name),
      family_goal: row.family_goal ? String(row.family_goal) : null,
      advisor_id: toInt(row.advisor_id),
      member_count: toInt(row.member_count),
      combined_aum: toNumber(row.combined_aum),
      policy_count: toInt(row.policy_count),
      avg_1y_return_pct: toNumber(row.avg_1y_return_pct),
      has_living_annuity: Boolean(row.has_living_annuity),
      has_tfsa: Boolean(row.has_tfsa),
      has_ra: Boolean(row.has_ra),
      life_stage: lifeStage,
    };
  });
}

export async function getFamilyMembers(familyId: number): Promise<FamilyMemberRow[]> {
  const res = await sql`
    SELECT
      c.client_id,
      fm.family_member_id,
      fm.relationship::TEXT,
      fm.is_primary,
      c.first_name,
      c.last_name,
      c.first_name || ' ' || c.last_name                           AS client_name,
      TO_CHAR(c.date_of_birth, 'YYYY-MM-DD')                       AS date_of_birth,
      DATE_PART('year', AGE(c.date_of_birth))::INT                 AS age,
      c.risk_profile,
      c.status,
      c.target_retirement_age,
      COALESCE(SUM(p.current_value), 0)                            AS total_aum,
      COUNT(p.policy_id)::INT                                       AS policy_count,
      COALESCE(
        AVG(pfh.return_annualized) FILTER (WHERE pfh.return_annualized IS NOT NULL),
        0
      ) * 100                                                       AS avg_1y_return_pct,
      ARRAY_AGG(DISTINCT p.policy_type)
        FILTER (WHERE p.policy_type IS NOT NULL)                   AS policy_types
    FROM family_member fm
    JOIN client c      ON c.client_id  = fm.client_id
    LEFT JOIN policy p ON p.client_id  = c.client_id
                       AND p.status NOT IN ('lapsed','inactive')
    LEFT JOIN (
      SELECT DISTINCT ON (pfhs.policy_id)
        pfhs.policy_id,
        fps.return_annualized
      FROM policy_fund_holding_snapshot pfhs
      JOIN fund_performance_snapshot fps
        ON fps.fund_id = pfhs.fund_id
       AND fps.period_code = '1Y'
       AND fps.as_of_date = (
         SELECT MAX(as_of_date) FROM fund_performance_snapshot
         WHERE fund_id = pfhs.fund_id AND period_code = '1Y'
       )
      ORDER BY pfhs.policy_id, pfhs.as_of_date DESC
    ) pfh ON pfh.policy_id = p.policy_id
    WHERE fm.family_id = ${familyId}
    GROUP BY
      c.client_id, fm.family_member_id, fm.relationship, fm.is_primary,
      c.first_name, c.last_name, c.date_of_birth, c.risk_profile,
      c.status, c.target_retirement_age
    ORDER BY fm.is_primary DESC, c.date_of_birth ASC NULLS LAST;
  `;

  return res.rows.map((row) => {
    const age = row.age != null ? toInt(row.age) : null;
    const targetRetirementAge = row.target_retirement_age != null
      ? toInt(row.target_retirement_age)
      : null;
    const yearsToRetirement =
      age !== null && targetRetirementAge !== null
        ? Math.max(0, targetRetirementAge - age)
        : null;
    const isPostRetirement =
      age !== null &&
      targetRetirementAge !== null &&
      age >= targetRetirementAge;

    const policyTypes: string[] = Array.isArray(row.policy_types)
      ? (row.policy_types as string[]).filter(Boolean)
      : [];

    return {
      client_id: toInt(row.client_id),
      family_member_id: toInt(row.family_member_id),
      relationship: String(row.relationship),
      is_primary: Boolean(row.is_primary),
      first_name: String(row.first_name),
      last_name: String(row.last_name),
      client_name: String(row.client_name),
      date_of_birth: row.date_of_birth ? String(row.date_of_birth) : null,
      age,
      risk_profile: row.risk_profile ? String(row.risk_profile) : null,
      status: String(row.status),
      total_aum: toNumber(row.total_aum),
      policy_count: toInt(row.policy_count),
      avg_1y_return_pct: toNumber(row.avg_1y_return_pct),
      target_retirement_age: targetRetirementAge,
      years_to_retirement: yearsToRetirement,
      is_post_retirement: isPostRetirement,
      policy_types: policyTypes,
    };
  });
}

export async function getFamilyDetail(familyId: number): Promise<FamilyDetail | null> {
  const familyRes = await sql`
    SELECT family_id, family_name, family_goal, advisor_id
    FROM family
    WHERE family_id = ${familyId}
    LIMIT 1;
  `;

  const familyRow = familyRes.rows[0];
  if (!familyRow) return null;

  const members = await getFamilyMembers(familyId);

  const aggregateRes = await sql`
    SELECT
      COALESCE(SUM(p.current_value), 0)              AS combined_aum,
      COUNT(p.policy_id)::INT                         AS total_policies,
      COALESCE(SUM(p.monthly_contribution), 0)        AS monthly_contributions,
      COALESCE(SUM(p.monthly_income), 0)              AS monthly_income,
      BOOL_OR(LOWER(p.policy_type) LIKE '%living annuity%'
           OR LOWER(p.policy_type) LIKE '%la%')       AS has_living_annuity,
      BOOL_OR(LOWER(p.policy_type) LIKE '%tfsa%'
           OR LOWER(p.policy_type) LIKE '%tax free%') AS has_tfsa,
      BOOL_OR(LOWER(p.policy_type) LIKE '%ra%'
           OR LOWER(p.policy_type) LIKE '%retirement annuity%') AS has_ra,
      BOOL_OR(LOWER(p.policy_type) LIKE '%unit trust%'
           OR LOWER(p.policy_type) LIKE '%ut%')       AS has_unit_trust
    FROM family_member fm
    JOIN client c      ON c.client_id  = fm.client_id
    LEFT JOIN policy p ON p.client_id  = c.client_id
                       AND p.status NOT IN ('lapsed','inactive')
    WHERE fm.family_id = ${familyId};
  `;

  const agg = aggregateRes.rows[0] ?? {};

  const educationMembers = members.filter(
    (m) => m.age !== null && m.age < 25 && !m.is_post_retirement,
  );
  const retirementMembers = members.filter((m) => m.is_post_retirement);
  const lifeStage = inferLifeStage(members);

  return {
    family_id: toInt(familyRow.family_id),
    family_name: String(familyRow.family_name),
    family_goal: familyRow.family_goal ? String(familyRow.family_goal) : null,
    advisor_id: toInt(familyRow.advisor_id),
    members,
    combined_aum: toNumber(agg.combined_aum),
    total_policies: toInt(agg.total_policies),
    life_stage: lifeStage,
    has_living_annuity: Boolean(agg.has_living_annuity),
    has_tfsa: Boolean(agg.has_tfsa),
    has_ra: Boolean(agg.has_ra),
    has_unit_trust: Boolean(agg.has_unit_trust),
    monthly_contributions: toNumber(agg.monthly_contributions),
    monthly_income: toNumber(agg.monthly_income),
    education_members: educationMembers,
    retirement_members: retirementMembers,
    active_member_count: members.filter((m) => m.status === "active").length,
  };
}

export async function getFamilyPolicyBreakdown(familyId: number): Promise<FamilyPolicyBreakdown[]> {
  const res = await sql`
    SELECT
      ${familyId}::INT                AS family_id,
      p.policy_type,
      COUNT(*)::INT                    AS count,
      COALESCE(SUM(p.current_value), 0) AS total_value
    FROM family_member fm
    JOIN client c      ON c.client_id = fm.client_id
    JOIN policy p      ON p.client_id = c.client_id
                       AND p.status NOT IN ('lapsed','inactive')
    WHERE fm.family_id = ${familyId}
    GROUP BY p.policy_type
    ORDER BY total_value DESC;
  `;

  return res.rows.map((row) => ({
    family_id: toInt(row.family_id),
    policy_type: String(row.policy_type),
    count: toInt(row.count),
    total_value: toNumber(row.total_value),
  }));
}

export async function getFamilyWealthSplit(familyId: number): Promise<FamilyWealthSplit[]> {
  const res = await sql`
    SELECT
      ${familyId}::INT                                AS family_id,
      c.first_name || ' ' || c.last_name             AS member_name,
      COALESCE(SUM(p.current_value), 0)              AS total_value
    FROM family_member fm
    JOIN client c      ON c.client_id = fm.client_id
    LEFT JOIN policy p ON p.client_id = c.client_id
                       AND p.status NOT IN ('lapsed','inactive')
    WHERE fm.family_id = ${familyId}
    GROUP BY c.client_id, c.first_name, c.last_name
    ORDER BY total_value DESC;
  `;

  return res.rows.map((row) => ({
    family_id: toInt(row.family_id),
    member_name: String(row.member_name),
    total_value: toNumber(row.total_value),
  }));
}

export async function getFamilyCountByAdvisor(advisorId: number): Promise<number> {
  const res = await sql`
    SELECT COUNT(*)::INT AS count
    FROM family
    WHERE advisor_id = ${advisorId};
  `;
  return toInt(res.rows[0]?.count);
}
