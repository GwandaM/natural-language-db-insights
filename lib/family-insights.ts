/**
 * AI-powered insight generation for family investing.
 *
 * Generates four insight cards per family household:
 *   household_overview  — combined wealth, member snapshot, wrapper structure
 *   life_stage_planning — retirement, education funding, accumulation phases
 *   tax_efficiency      — TFSA/RA utilisation, tax-free allowance headroom
 *   wealth_transfer     — estate planning, living annuity sustainability, legacy
 *
 * Results are cached in the client_insights table using a family-scoped key.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { llmModel } from "@/lib/llm";
import { sql } from "@/lib/db";
import { ensureClientInsightsTable } from "@/lib/cockpit-storage";
import {
  FamilyDetail,
  FamilyMemberRow,
  FamilyPolicyBreakdown,
  FamilyWealthSplit,
  getFamilyDetail,
  getFamilyPolicyBreakdown,
  getFamilyWealthSplit,
} from "@/lib/family-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FamilyInsightKey =
  | "household_overview"
  | "life_stage_planning"
  | "tax_efficiency"
  | "wealth_transfer";

export interface FamilyInsightCard {
  key: FamilyInsightKey;
  title: string;
  headline: string;
  body: string;
  items: string[];
  available: boolean;
  unavailable_reason?: string | null;
}

export interface FamilyInsightsPayload {
  cards: FamilyInsightCard[];
}

export interface StoredFamilyInsights {
  insights: FamilyInsightsPayload | null;
  generated_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatZarShort(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

const familyInsightCacheKey = (advisorId: number, familyId: number) =>
  `advisor:${advisorId}:family:${familyId}`;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function getStoredFamilyInsights(
  advisorId: number,
  familyId: number,
): Promise<StoredFamilyInsights> {
  await ensureClientInsightsTable();
  const key = familyInsightCacheKey(advisorId, familyId);
  const res = await sql`
    SELECT data, generated_at
    FROM client_insights
    WHERE insight_key = ${key}
    LIMIT 1;
  `;
  const row = res.rows[0];
  if (!row) return { insights: null, generated_at: null };
  return {
    insights: row.data as FamilyInsightsPayload,
    generated_at: new Date(String(row.generated_at)).toISOString(),
  };
}

async function storeFamilyInsights(
  advisorId: number,
  familyId: number,
  insights: FamilyInsightsPayload,
): Promise<void> {
  await ensureClientInsightsTable();
  const key = familyInsightCacheKey(advisorId, familyId);
  await sql`
    INSERT INTO client_insights (insight_key, advisor_id, data, generated_at)
    VALUES (${key}, ${advisorId}, ${JSON.stringify(insights)}, NOW())
    ON CONFLICT (insight_key)
    DO UPDATE SET
      advisor_id   = EXCLUDED.advisor_id,
      data         = EXCLUDED.data,
      generated_at = EXCLUDED.generated_at;
  `;
}

// ---------------------------------------------------------------------------
// Card generators
// ---------------------------------------------------------------------------

const cardSchema = z.object({
  title: z.string(),
  headline: z.string(),
  body: z.string(),
  items: z.array(z.string()),
});

async function generateHouseholdOverviewCard(
  family: FamilyDetail,
  wealthSplit: FamilyWealthSplit[],
  policyBreakdown: FamilyPolicyBreakdown[],
): Promise<FamilyInsightCard> {
  const memberSummaries = family.members.map((m) => ({
    name: m.client_name,
    relationship: m.relationship,
    age: m.age,
    aum: formatZarShort(m.total_aum),
    policies: m.policy_count,
    risk_profile: m.risk_profile,
    policy_types: m.policy_types,
  }));

  const prompt = [
    `Family: ${family.family_name} (${family.member_count} members)`,
    `Combined household AUM: ${formatZarShort(family.combined_aum)}`,
    `Total active policies: ${family.total_policies}`,
    `Wrapper mix: RA=${family.has_ra}, TFSA=${family.has_tfsa}, Living Annuity=${family.has_living_annuity}, Unit Trust=${family.has_unit_trust}`,
    `Life stage: ${family.life_stage}`,
    `Monthly contributions: ${formatZarShort(family.monthly_contributions)}`,
    `Monthly income drawn: ${formatZarShort(family.monthly_income)}`,
    `Member breakdown: ${JSON.stringify(memberSummaries)}`,
    `Wealth distribution across members: ${JSON.stringify(wealthSplit.map((w) => ({ member: w.member_name, value: formatZarShort(w.total_value) })))}`,
    `Policy type breakdown: ${JSON.stringify(policyBreakdown.map((p) => ({ type: p.policy_type, count: p.count, value: formatZarShort(p.total_value) })))}`,
    `Family goal: ${family.family_goal ?? "Not specified"}`,
    `Write a household overview insight card for a South African investment advisor. ` +
    `The headline (max 12 words) must cite the combined AUM and key structural fact. ` +
    `The body (1–2 sentences) should summarise household wealth structure and wrapper mix. ` +
    `Items: 3–4 punchy bullet points covering household concentration, dominant wrapper, ` +
    `monthly cash flow, and any structural note worth flagging.`,
  ].join("\n");

  const { object } = await generateObject({ model: llmModel, prompt, schema: cardSchema });

  return {
    key: "household_overview",
    title: object.title,
    headline: object.headline,
    body: object.body,
    items: object.items,
    available: true,
  };
}

async function generateLifeStagePlanningCard(
  family: FamilyDetail,
): Promise<FamilyInsightCard> {
  if (family.members.length === 0) {
    return {
      key: "life_stage_planning",
      title: "Life Stage Planning",
      headline: "No member data available",
      body: "Add family members to generate life stage planning insights.",
      items: [],
      available: false,
      unavailable_reason: "No members linked to this family.",
    };
  }

  const memberStages = family.members.map((m: FamilyMemberRow) => ({
    name: m.client_name,
    age: m.age,
    relationship: m.relationship,
    is_post_retirement: m.is_post_retirement,
    years_to_retirement: m.years_to_retirement,
    target_retirement_age: m.target_retirement_age,
    policy_types: m.policy_types,
    aum: formatZarShort(m.total_aum),
  }));

  const prompt = [
    `Family: ${family.family_name}`,
    `Life stage: ${family.life_stage}`,
    `Members and their stages: ${JSON.stringify(memberStages)}`,
    `Education members (under 25): ${family.education_members.length}`,
    `Post-retirement members: ${family.retirement_members.length}`,
    `Monthly income drawn: ${formatZarShort(family.monthly_income)}`,
    `Monthly contributions: ${formatZarShort(family.monthly_contributions)}`,
    `Has RA: ${family.has_ra}, Has Living Annuity: ${family.has_living_annuity}, Has TFSA: ${family.has_tfsa}`,
    `Write a life stage planning insight card for a South African investment advisor. ` +
    `The headline (max 12 words) must call out the most urgent life-stage fact (e.g. years to retirement, education funding need). ` +
    `The body (1–2 sentences) should describe the family's overall planning horizon and where attention is most needed. ` +
    `Items: 3–4 bullets covering: retirement runway for the oldest member, education funding considerations ` +
    `(if children present), accumulation gap, and recommended wrapper or product actions per life stage.`,
  ].join("\n");

  const { object } = await generateObject({ model: llmModel, prompt, schema: cardSchema });

  return {
    key: "life_stage_planning",
    title: object.title,
    headline: object.headline,
    body: object.body,
    items: object.items,
    available: true,
  };
}

async function generateTaxEfficiencyCard(
  family: FamilyDetail,
  policyBreakdown: FamilyPolicyBreakdown[],
): Promise<FamilyInsightCard> {
  const tfsaPolicies = policyBreakdown.filter(
    (p) => p.policy_type.toLowerCase().includes("tfsa") || p.policy_type.toLowerCase().includes("tax free"),
  );
  const raPolicies = policyBreakdown.filter(
    (p) => p.policy_type.toLowerCase().includes("ra") || p.policy_type.toLowerCase().includes("retirement annuity"),
  );
  const tfsaTotalValue = tfsaPolicies.reduce((s, p) => s + p.total_value, 0);
  const raTotalValue = raPolicies.reduce((s, p) => s + p.total_value, 0);

  const memberTaxInfo = family.members.map((m: FamilyMemberRow) => ({
    name: m.client_name,
    age: m.age,
    relationship: m.relationship,
    has_tfsa: m.policy_types.some(
      (t) => t.toLowerCase().includes("tfsa") || t.toLowerCase().includes("tax free"),
    ),
    has_ra: m.policy_types.some(
      (t) => t.toLowerCase().includes("ra") || t.toLowerCase().includes("retirement annuity"),
    ),
    total_aum: formatZarShort(m.total_aum),
  }));

  const prompt = [
    `Family: ${family.family_name} (${family.member_count} members)`,
    `Combined household AUM: ${formatZarShort(family.combined_aum)}`,
    `TFSA holdings: ${tfsaPolicies.length} policies, total value ${formatZarShort(tfsaTotalValue)}`,
    `RA holdings: ${raPolicies.length} policies, total value ${formatZarShort(raTotalValue)}`,
    `Member tax wrapper coverage: ${JSON.stringify(memberTaxInfo)}`,
    `South African context: TFSA annual contribution limit is R36,000 (lifetime R500,000). ` +
    `RA contributions are deductible up to 27.5% of greater of taxable income or remuneration, capped at R350,000 pa.`,
    `Write a tax efficiency insight card for a South African investment advisor. ` +
    `The headline (max 12 words) should cite the key tax wrapper metric (e.g. TFSA coverage, RA deductibility headroom). ` +
    `The body (1–2 sentences) should assess the household's tax efficiency and identify the biggest tax opportunity. ` +
    `Items: 3–4 bullets on: TFSA coverage per eligible member, RA contribution headroom, ` +
    `members missing tax-advantaged wrappers, and any specific action to improve tax efficiency.`,
  ].join("\n");

  const { object } = await generateObject({ model: llmModel, prompt, schema: cardSchema });

  return {
    key: "tax_efficiency",
    title: object.title,
    headline: object.headline,
    body: object.body,
    items: object.items,
    available: true,
  };
}

async function generateWealthTransferCard(
  family: FamilyDetail,
): Promise<FamilyInsightCard> {
  const postRetirementMembers = family.retirement_members.map((m: FamilyMemberRow) => ({
    name: m.client_name,
    age: m.age,
    aum: formatZarShort(m.total_aum),
    policy_types: m.policy_types,
  }));

  const hasLivingAnnuity = family.has_living_annuity;
  const combinedAum = family.combined_aum;

  const prompt = [
    `Family: ${family.family_name}`,
    `Combined household AUM: ${formatZarShort(combinedAum)}`,
    `Post-retirement members: ${JSON.stringify(postRetirementMembers)}`,
    `Has living annuity: ${hasLivingAnnuity}`,
    `Monthly income drawn from portfolio: ${formatZarShort(family.monthly_income)}`,
    `Has TFSA (passes outside estate): ${family.has_tfsa}`,
    `Has RA (does not form part of estate): ${family.has_ra}`,
    `Education-age members (potential beneficiaries): ${family.education_members.length}`,
    `Total active members: ${family.active_member_count}`,
    `South African estate planning context: Living annuities do not form part of the estate. ` +
    `RAs, if nominated, also pass outside the estate. TFSAs form part of the estate unless ` +
    `nominated. Estate duty is 20% on the dutiable estate above R3.5M (or R7M for a surviving spouse rollover).`,
    `Write a wealth transfer insight card for a South African investment advisor. ` +
    `The headline (max 12 words) should highlight the most important estate or intergenerational planning consideration. ` +
    `The body (1–2 sentences) should frame the family's wealth transfer posture and main estate planning gaps. ` +
    `Items: 3–4 bullets covering: which assets pass outside estate, living annuity beneficiary nomination, ` +
    `estate duty exposure estimate, and recommended next step for the advisor.`,
  ].join("\n");

  const { object } = await generateObject({ model: llmModel, prompt, schema: cardSchema });

  return {
    key: "wealth_transfer",
    title: object.title,
    headline: object.headline,
    body: object.body,
    items: object.items,
    available: true,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateFamilyInsights(
  advisorId: number,
  familyId: number,
): Promise<FamilyInsightsPayload> {
  const [family, policyBreakdown, wealthSplit] = await Promise.all([
    getFamilyDetail(familyId),
    getFamilyPolicyBreakdown(familyId),
    getFamilyWealthSplit(familyId),
  ]);

  if (!family) {
    throw new Error(`Family ${familyId} not found`);
  }

  const [
    householdCard,
    lifeStageCard,
    taxCard,
    wealthTransferCard,
  ] = await Promise.all([
    generateHouseholdOverviewCard(family, wealthSplit, policyBreakdown),
    generateLifeStagePlanningCard(family),
    generateTaxEfficiencyCard(family, policyBreakdown),
    generateWealthTransferCard(family),
  ]);

  const payload: FamilyInsightsPayload = {
    cards: [householdCard, lifeStageCard, taxCard, wealthTransferCard],
  };

  await storeFamilyInsights(advisorId, familyId, payload);
  return payload;
}

export async function getFamilyInsights(
  advisorId: number,
  familyId: number,
): Promise<StoredFamilyInsights> {
  const stored = await getStoredFamilyInsights(advisorId, familyId);
  if (stored.insights) return stored;
  const insights = await generateFamilyInsights(advisorId, familyId);
  return { insights, generated_at: new Date().toISOString() };
}
