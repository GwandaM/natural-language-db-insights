import { z } from "zod";

export const COMMISSION_RULE_VERSION = "commission-v1-policy-book-annualised";

export type CommissionSourceType = "policy";

export interface CommissionRateCardEntry {
  canonical_type: string;
  display_name: string;
  annual_rate: number;
  rationale: string;
}

export interface CommissionInputEntry {
  entry_id: string;
  source_type: CommissionSourceType;
  source_label: string;
  product_type: string;
  status?: string | null;
  current_value: number;
}

export interface CommissionBreakdownRow {
  entry_id: string;
  source_type: CommissionSourceType;
  source_label: string;
  product_type: string;
  product_type_label: string;
  status: string | null;
  current_value: number;
  annual_rate: number;
  estimated_annual_commission: number;
  rationale: string;
}

export interface CommissionCalculationResult {
  rule_version: string;
  currency: "ZAR";
  assumptions: string[];
  rate_card: CommissionRateCardEntry[];
  totals: {
    entries_count: number;
    total_current_value: number;
    total_potential_annual_commission: number;
    monthly_commission_equivalent: number;
  };
  breakdown: CommissionBreakdownRow[];
}

const RATE_CARD: Record<string, CommissionRateCardEntry> = {
  retirement_annuity: {
    canonical_type: "retirement_annuity",
    display_name: "Retirement Annuity",
    annual_rate: 0.0075,
    rationale: "Annual servicing estimate for retirement annuity business.",
  },
  tfsa: {
    canonical_type: "tfsa",
    display_name: "TFSA",
    annual_rate: 0.005,
    rationale: "Annual servicing estimate for tax-free savings business.",
  },
  living_annuity: {
    canonical_type: "living_annuity",
    display_name: "Living Annuity",
    annual_rate: 0.01,
    rationale: "Annual servicing estimate for living annuity business.",
  },
  endowment: {
    canonical_type: "endowment",
    display_name: "Endowment",
    annual_rate: 0.0065,
    rationale: "Annual servicing estimate for endowment business.",
  },
  unit_trust: {
    canonical_type: "unit_trust",
    display_name: "Unit Trust",
    annual_rate: 0.006,
    rationale: "Annual servicing estimate for unit trust business.",
  },
  default: {
    canonical_type: "default",
    display_name: "Other",
    annual_rate: 0.0055,
    rationale: "Fallback annual servicing estimate when no specific product rule exists.",
  },
};

export const commissionInputEntrySchema = z.object({
  entry_id: z.string().min(1),
  source_type: z.literal("policy"),
  source_label: z.string().min(1),
  product_type: z.string().min(1),
  status: z.string().optional().nullable(),
  current_value: z.number().finite().nonnegative(),
});

export const commissionCalculationRequestSchema = z
  .object({
    advisor_id: z.number().int().positive().optional(),
    client_id: z.number().int().positive().optional(),
    entries: z.array(commissionInputEntrySchema).min(1).optional(),
  })
  .refine(
    (value) => Boolean(value.entries?.length) || (value.advisor_id != null && value.client_id != null),
    {
      message: "Provide either entries or both advisor_id and client_id.",
      path: ["entries"],
    },
  );

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function canonicaliseCommissionProductType(productType: string): string {
  const normalised = productType.trim().toLowerCase().replaceAll(/[\s-]+/g, "_");

  switch (normalised) {
    case "ra":
    case "retirement_annuity":
      return "retirement_annuity";
    case "tfsa":
      return "tfsa";
    case "living_annuity":
      return "living_annuity";
    case "endowment":
      return "endowment";
    case "unit_trust":
      return "unit_trust";
    default:
      return "default";
  }
}

export function getCommissionRateCard(): CommissionRateCardEntry[] {
  return [
    RATE_CARD.living_annuity,
    RATE_CARD.retirement_annuity,
    RATE_CARD.endowment,
    RATE_CARD.unit_trust,
    RATE_CARD.tfsa,
    RATE_CARD.default,
  ];
}

export function calculateCommission(entries: CommissionInputEntry[]): CommissionCalculationResult {
  const validatedEntries = entries.map((entry) => commissionInputEntrySchema.parse(entry));

  const breakdown = validatedEntries
    .map<CommissionBreakdownRow>((entry) => {
      const canonicalType = canonicaliseCommissionProductType(entry.product_type);
      const rule = RATE_CARD[canonicalType] ?? RATE_CARD.default;
      const estimatedAnnualCommission = roundCurrency(entry.current_value * rule.annual_rate);

      return {
        entry_id: entry.entry_id,
        source_type: entry.source_type,
        source_label: entry.source_label,
        product_type: entry.product_type,
        product_type_label: rule.display_name,
        status: entry.status ?? null,
        current_value: roundCurrency(entry.current_value),
        annual_rate: rule.annual_rate,
        estimated_annual_commission: estimatedAnnualCommission,
        rationale: rule.rationale,
      };
    })
    .sort((left, right) => right.estimated_annual_commission - left.estimated_annual_commission);

  const totalCurrentValue = roundCurrency(
    breakdown.reduce((sum, entry) => sum + entry.current_value, 0),
  );
  const totalPotentialAnnualCommission = roundCurrency(
    breakdown.reduce((sum, entry) => sum + entry.estimated_annual_commission, 0),
  );

  return {
    rule_version: COMMISSION_RULE_VERSION,
    currency: "ZAR",
    assumptions: [
      "Potential annual commission is estimated from the current policy book only.",
      "Each policy is valued using its current value multiplied by the configured annual commission rate for that policy type.",
      "Configured annual rates: Living Annuity 1.00%, Retirement Annuity 0.75%, Endowment 0.65%, Unit Trust 0.60%, TFSA 0.50%, fallback 0.55%.",
    ],
    rate_card: getCommissionRateCard(),
    totals: {
      entries_count: breakdown.length,
      total_current_value: totalCurrentValue,
      total_potential_annual_commission: totalPotentialAnnualCommission,
      monthly_commission_equivalent: roundCurrency(totalPotentialAnnualCommission / 12),
    },
    breakdown,
  };
}
