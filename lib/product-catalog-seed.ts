import { sql } from "@vercel/postgres";
import { ensureProductCatalogTables } from "./cockpit-storage";

type ProviderType = "life_office" | "asset_manager";
type ConfidenceLevel = "high" | "medium" | "low";

interface SeedProvider {
  provider_id: number;
  provider_name: string;
  provider_type: ProviderType;
  website_url: string;
}

interface SeedCostComponent {
  component_type: string;
  charge_basis: string;
  value_min: number | null;
  value_max?: number | null;
  frequency?: string;
  notes: string;
  is_included_in_eac?: boolean;
  display_order?: number;
}

interface SeedFeature {
  feature_key: string;
  feature_value: string;
  display_label: string;
}

interface SeedSource {
  source_url: string;
  document_type: string;
  page_ref?: string;
  evidence_snippet: string;
}

interface SeedProduct {
  product_id: number;
  provider_id: number;
  reference_fund_id?: number | null;
  product_name: string;
  product_family: string;
  product_type: string;
  vehicle_type: string;
  comparison_group: string;
  risk_band: string;
  target_market: string;
  minimum_investment?: number | null;
  minimum_debit_order?: number | null;
  source_asof_date: string;
  eac_confidence: ConfidenceLevel;
  features: SeedFeature[];
  cost_components: SeedCostComponent[];
  sources: SeedSource[];
}

const providers: SeedProvider[] = [
  { provider_id: 1, provider_name: "Liberty", provider_type: "life_office", website_url: "https://www.liberty.co.za" },
  { provider_id: 2, provider_name: "Old Mutual", provider_type: "life_office", website_url: "https://www.oldmutual.co.za" },
  { provider_id: 3, provider_name: "Sanlam", provider_type: "life_office", website_url: "https://www.sanlam.co.za" },
  { provider_id: 4, provider_name: "Momentum", provider_type: "life_office", website_url: "https://www.momentum.co.za" },
  { provider_id: 5, provider_name: "Discovery", provider_type: "life_office", website_url: "https://www.discovery.co.za" },
  { provider_id: 6, provider_name: "Allan Gray", provider_type: "asset_manager", website_url: "https://www.allangray.co.za" },
  { provider_id: 7, provider_name: "Ninety One", provider_type: "asset_manager", website_url: "https://ninetyone.com/en/south-africa" },
  { provider_id: 8, provider_name: "Coronation", provider_type: "asset_manager", website_url: "https://www.coronation.com" },
  { provider_id: 9, provider_name: "STANLIB", provider_type: "asset_manager", website_url: "https://stanlib.com" },
  { provider_id: 10, provider_name: "Sygnia", provider_type: "asset_manager", website_url: "https://www.sygnia.co.za" },
];

const products: SeedProduct[] = [
  {
    product_id: 101,
    provider_id: 1,
    product_name: "Liberty Capped Property Tracker Fund",
    product_family: "listed_property",
    product_type: "tracker_fund",
    vehicle_type: "unit_trust",
    comparison_group: "sa_listed_property",
    risk_band: "aggressive",
    target_market: "Investors seeking listed property exposure with a low-cost passive approach.",
    source_asof_date: "2025-09-30",
    eac_confidence: "high",
    features: [
      { feature_key: "strategy", feature_value: "Passive listed property exposure", display_label: "Strategy" },
      { feature_key: "style", feature_value: "Tracker", display_label: "Management style" },
    ],
    cost_components: [
      { component_type: "total_expense_ratio", charge_basis: "annual_pct", value_min: 0.0036, notes: "3-year annualised TER from Liberty factsheet.", display_order: 1 },
      { component_type: "transaction_cost", charge_basis: "annual_pct", value_min: 0.0020, notes: "3-year annualised transaction cost from Liberty factsheet.", display_order: 2 },
    ],
    sources: [
      {
        source_url: "https://www.liberty.co.za/Documents/FundFactSheets/liberty-corporate-la-gross-investment-performance.pdf",
        document_type: "factsheet",
        page_ref: "1",
        evidence_snippet: "Liberty Capped Property Tracker Fund: TER 0.36%, TC 0.20%, total investment charge 0.56%.",
      },
    ],
  },
  {
    product_id: 102,
    provider_id: 2,
    product_name: "Old Mutual Albaraka Balanced Fund A",
    product_family: "balanced",
    product_type: "unit_trust",
    vehicle_type: "unit_trust",
    comparison_group: "sa_multi_asset_balanced",
    risk_band: "moderate",
    target_market: "Investors looking for diversified balanced exposure with a moderate risk profile.",
    source_asof_date: "2025-09-30",
    eac_confidence: "high",
    features: [
      { feature_key: "classification", feature_value: "South African Multi-Asset Medium Equity", display_label: "Classification" },
      { feature_key: "income", feature_value: "Steady long-term capital growth with moderate income", display_label: "Objective" },
    ],
    cost_components: [
      { component_type: "total_expense_ratio", charge_basis: "annual_pct", value_min: 0.0147, notes: "TER including annual service fee.", display_order: 1 },
      { component_type: "transaction_cost", charge_basis: "annual_pct", value_min: 0.0014, notes: "Transaction cost from Old Mutual unit trust fund list.", display_order: 2 },
    ],
    sources: [
      {
        source_url: "https://cms.oldmutualinvest.com/docs/default-source/forms/fund-list.pdf?sfvrsn=c3c9738e_4",
        document_type: "fund_list",
        page_ref: "1",
        evidence_snippet: "Old Mutual Albaraka Balanced Fund A: annualised service fee 1.25%, TER 1.47%, TC 0.14%, total investment charges 1.61%.",
      },
    ],
  },
  {
    product_id: 103,
    provider_id: 3,
    product_name: "SIM Balanced Fund",
    product_family: "balanced",
    product_type: "linked_annuity_portfolio",
    vehicle_type: "living_annuity",
    comparison_group: "sa_multi_asset_balanced",
    risk_band: "moderate",
    target_market: "Clients seeking a single-manager balanced portfolio inside retirement income solutions.",
    source_asof_date: "2024-01-01",
    eac_confidence: "medium",
    features: [
      { feature_key: "classification", feature_value: "Single manager multi-asset class portfolio", display_label: "Classification" },
      { feature_key: "regulation_28", feature_value: "Suitable for retirement-linked solutions", display_label: "Retirement use" },
    ],
    cost_components: [
      { component_type: "platform_fee", charge_basis: "annual_pct", value_min: 0.0070, notes: "Sanlam linked annuity portfolio fee.", display_order: 1 },
    ],
    sources: [
      {
        source_url: "https://www.sanlaminvestments.com/SISharedDocuments/ILLA_Investment_Linked_Annuity.pdf",
        document_type: "brochure",
        page_ref: "fees table",
        evidence_snippet: "SIM Balanced Fund fee listed at 0.70% in the investment-linked annuity fee schedule.",
      },
    ],
  },
  {
    product_id: 104,
    provider_id: 4,
    product_name: "Momentum Investo 4 Retirement Annuity",
    product_family: "retirement_solution",
    product_type: "retirement_annuity",
    vehicle_type: "retirement_annuity",
    comparison_group: "retirement_annuity_platform",
    risk_band: "moderate",
    target_market: "Retirement annuity investors using Momentum or non-Momentum funds on the Investo platform.",
    source_asof_date: "2025-08-14",
    eac_confidence: "medium",
    minimum_investment: null,
    minimum_debit_order: null,
    features: [
      { feature_key: "wrapper", feature_value: "Retirement annuity and endowment platform", display_label: "Wrapper" },
      { feature_key: "fee_structure", feature_value: "Administration fee differs for Momentum and non-Momentum funds", display_label: "Fee structure" },
    ],
    cost_components: [
      { component_type: "administration_fee", charge_basis: "annual_pct", value_min: 0.0100, notes: "Momentum funds carry a 1% administration fee in the Investo range.", display_order: 1 },
    ],
    sources: [
      {
        source_url: "https://sls-fresco.momentum.co.za/files/documents/investo/investo-available-funds-list.pdf",
        document_type: "brochure",
        page_ref: "fees",
        evidence_snippet: "For Investo 4 and later ranges, Momentum funds have a 1% administration fee charged within the unit price of the fund.",
      },
    ],
  },
  {
    product_id: 105,
    provider_id: 5,
    product_name: "Discovery Balanced Fund",
    product_family: "balanced",
    product_type: "unit_trust",
    vehicle_type: "unit_trust",
    comparison_group: "sa_multi_asset_balanced",
    risk_band: "moderate",
    target_market: "Balanced investors seeking real returns over time with Discovery Invest as the CIS manager.",
    source_asof_date: "2017-10-31",
    eac_confidence: "high",
    features: [
      { feature_key: "regulation_28", feature_value: "Balanced fund", display_label: "Structure" },
      { feature_key: "objective", feature_value: "Aims to deliver real returns over time", display_label: "Objective" },
    ],
    cost_components: [
      { component_type: "total_expense_ratio", charge_basis: "annual_pct", value_min: 0.0200, notes: "Latest available TER shown by Discovery Invest.", display_order: 1 },
      { component_type: "transaction_cost", charge_basis: "annual_pct", value_min: 0.0016, notes: "Latest available transaction cost shown by Discovery Invest.", display_order: 2 },
    ],
    sources: [
      {
        source_url: "https://www.discovery.co.za/investments/balanced-fund-information",
        document_type: "product_page",
        page_ref: "fees section",
        evidence_snippet: "Discovery states charges range from 0% to 0.57% depending on the investment options chosen, and shows TER and transaction costs as the latest available figures for the fund.",
      },
      {
        source_url: "https://www.discovery.co.za/invest-public/jsf/funds/fundSearchMain.jsf",
        document_type: "fund_search",
        page_ref: "fund charges",
        evidence_snippet: "Discovery Invest explains that the Total Expense Ratio and Transaction Costs shown are the latest available figures, with service charges ranging from 0% to 0.57% depending on chosen investment options.",
      },
    ],
  },
  {
    product_id: 106,
    provider_id: 6,
    reference_fund_id: 11,
    product_name: "Allan Gray Balanced Fund",
    product_family: "balanced",
    product_type: "unit_trust",
    vehicle_type: "unit_trust",
    comparison_group: "sa_multi_asset_balanced",
    risk_band: "moderate",
    target_market: "Long-term investors wanting a Regulation 28-aligned balanced fund.",
    source_asof_date: "2022-09-30",
    eac_confidence: "high",
    features: [
      { feature_key: "regulation_28", feature_value: "Managed in accordance with Regulation 28", display_label: "Regulation 28" },
      { feature_key: "objective", feature_value: "Long-term balanced growth", display_label: "Objective" },
    ],
    cost_components: [
      { component_type: "total_expense_ratio", charge_basis: "annual_pct", value_min: 0.0148, notes: "1-year TER from Allan Gray balanced factsheet.", display_order: 1 },
      { component_type: "transaction_cost", charge_basis: "annual_pct", value_min: 0.0007, notes: "1-year transaction cost from Allan Gray balanced factsheet.", display_order: 2 },
    ],
    sources: [
      {
        source_url: "https://www.allangray.co.za/globalassets/documents-repository/fund/factsheet/Allan%20Gray%20Balanced%20Fund/Files/AGBF%20-%202022-09.pdf",
        document_type: "factsheet",
        page_ref: "fees table",
        evidence_snippet: "Allan Gray Balanced Fund: TER 1.48%, transaction costs 0.07%, total investment charge 1.55% for the 1-year period ending 30 September 2022.",
      },
    ],
  },
  {
    product_id: 107,
    provider_id: 6,
    reference_fund_id: 1,
    product_name: "Allan Gray Equity Fund",
    product_family: "equity",
    product_type: "unit_trust",
    vehicle_type: "unit_trust",
    comparison_group: "sa_equity_general",
    risk_band: "aggressive",
    target_market: "Long-term investors seeking concentrated South African equity exposure.",
    source_asof_date: "2024-11-30",
    eac_confidence: "high",
    features: [
      { feature_key: "objective", feature_value: "Maximise long-term capital appreciation through listed equities", display_label: "Objective" },
      { feature_key: "style", feature_value: "Active equity", display_label: "Management style" },
    ],
    cost_components: [
      { component_type: "total_expense_ratio", charge_basis: "annual_pct", value_min: 0.0087, notes: "TER for 1-year period ending 30 September 2024.", display_order: 1 },
    ],
    sources: [
      {
        source_url: "https://www.allangray.co.za/globalassets/documents-repository/fund/factsheet/Allan%20Gray%20Unit%20Trust%20Management%20Limited%20-%20All%20Funds/Files/AG00%20-%202024-11.pdf",
        document_type: "factsheet",
        page_ref: "fees table",
        evidence_snippet: "Allan Gray Equity Fund: annual management fee 0.75% p.a. excl. VAT, TER 0.87%, transaction costs 0.00%, total investment charge 0.87%.",
      },
    ],
  },
  {
    product_id: 108,
    provider_id: 7,
    reference_fund_id: 3,
    product_name: "Ninety One Equity Fund",
    product_family: "equity",
    product_type: "unit_trust",
    vehicle_type: "unit_trust",
    comparison_group: "sa_equity_general",
    risk_band: "aggressive",
    target_market: "Investors seeking long-term growth from South African equities.",
    source_asof_date: "2025-10-31",
    eac_confidence: "high",
    features: [
      { feature_key: "objective", feature_value: "Long-term capital growth from South African equities", display_label: "Objective" },
      { feature_key: "classification", feature_value: "SA Unit Trust", display_label: "Structure" },
    ],
    cost_components: [
      { component_type: "total_expense_ratio", charge_basis: "annual_pct", value_min: 0.0099, notes: "Inclusive in the TER shown on the Ninety One fund page.", display_order: 1 },
    ],
    sources: [
      {
        source_url: "https://ninetyone.com/en/south-africa/funds-strategies/funds/equity-a-inc-zar-zae000020939",
        document_type: "fund_page",
        page_ref: "fee summary",
        evidence_snippet: "Ninety One Equity Fund: annual management fee 0.85%, other charges 0.08%, TER 0.99%, transaction costs 0.00%, total cost 0.99%.",
      },
    ],
  },
  {
    product_id: 109,
    provider_id: 8,
    reference_fund_id: 12,
    product_name: "Coronation Balanced Plus Fund",
    product_family: "balanced",
    product_type: "unit_trust",
    vehicle_type: "unit_trust",
    comparison_group: "sa_multi_asset_balanced",
    risk_band: "moderate",
    target_market: "Balanced investors wanting a Regulation 28-ready multi-asset growth fund.",
    source_asof_date: "2025-10-31",
    eac_confidence: "medium",
    features: [
      { feature_key: "regulation_28", feature_value: "Managed within retirement constraints", display_label: "Regulation 28" },
      { feature_key: "objective", feature_value: "Long-term growth with balanced asset allocation", display_label: "Objective" },
    ],
    cost_components: [
      { component_type: "annual_management_fee", charge_basis: "annual_pct", value_min: 0.0125, notes: "Annual fee if fund return equals benchmark, excluding VAT.", display_order: 1 },
      { component_type: "vat", charge_basis: "annual_pct", value_min: 0.001875, notes: "VAT on the 1.25% benchmark fee assumption.", display_order: 2 },
    ],
    sources: [
      {
        source_url: "https://www.coronation.com/en/institutional/latest-insights/fund-updates/coronation-balanced-plus-fund-october-2025/",
        document_type: "fund_update",
        page_ref: "performance snapshot",
        evidence_snippet: "Coronation Balanced Plus Fund factsheet/update page identifies the fund and offers the official PDF; benchmark fee assumptions are used where the annual fee equals 1.25% if return matches benchmark.",
      },
    ],
  },
  {
    product_id: 110,
    provider_id: 8,
    reference_fund_id: 2,
    product_name: "Coronation Equity Fund",
    product_family: "equity",
    product_type: "unit_trust",
    vehicle_type: "unit_trust",
    comparison_group: "sa_equity_general",
    risk_band: "aggressive",
    target_market: "Long-term equity investors able to tolerate concentrated stock-market risk.",
    source_asof_date: "2021-06-30",
    eac_confidence: "medium",
    features: [
      { feature_key: "objective", feature_value: "Maximise long-term capital appreciation via listed equities", display_label: "Objective" },
      { feature_key: "fee_model", feature_value: "Performance fee model", display_label: "Fee model" },
    ],
    cost_components: [
      { component_type: "annual_management_fee", charge_basis: "annual_pct", value_min: 0.0110, notes: "Fee if fund return equals benchmark, excluding VAT.", display_order: 1 },
      { component_type: "vat", charge_basis: "annual_pct", value_min: 0.00165, notes: "VAT on the benchmark fee assumption.", display_order: 2 },
      { component_type: "performance_fee", charge_basis: "annual_pct", value_min: 0.0000, value_max: 0.0150, notes: "Coronation shares in 20% of performance above benchmark, capped at 2.60% annual fee.", is_included_in_eac: false, display_order: 3 },
    ],
    sources: [
      {
        source_url: "https://www.coronation.com/globalassets/asset-library/comprehensive-fact-sheets/2021/june/personal/2021-june-equity-fund-comprehensive.pdf",
        document_type: "factsheet",
        page_ref: "fees",
        evidence_snippet: "Coronation Equity Fund: annual fee is 1.10% if the fund return equals the benchmark; fee ranges from 0.75% to 2.60% depending on performance, excluding VAT.",
      },
    ],
  },
  {
    product_id: 111,
    provider_id: 9,
    product_name: "STANLIB Corporate Money Market Fund",
    product_family: "money_market",
    product_type: "unit_trust",
    vehicle_type: "unit_trust",
    comparison_group: "sa_money_market",
    risk_band: "conservative",
    target_market: "Short-term investors prioritising income and capital stability.",
    source_asof_date: "2025-06-30",
    eac_confidence: "high",
    features: [
      { feature_key: "minimum_period", feature_value: "1 month", display_label: "Suggested investment period" },
      { feature_key: "risk", feature_value: "Conservative", display_label: "Risk" },
    ],
    cost_components: [
      { component_type: "annual_management_fee", charge_basis: "annual_pct", value_min: 0.0023, notes: "Manager fee for class B4.", display_order: 1 },
    ],
    sources: [
      {
        source_url: "https://staging.stanlib.com/secure/src/assets/files/factsheets/Inst_STANLIB_Corporate_Money_Market_Fund_B4_Comprehensive.pdf",
        document_type: "factsheet",
        page_ref: "cost ratios",
        evidence_snippet: "STANLIB Corporate Money Market Fund class B4: annual fee (manager) 0.230%, adviser fee not included in annual fee.",
      },
    ],
  },
  {
    product_id: 112,
    provider_id: 10,
    product_name: "Sygnia Skeleton Balanced 60 Fund",
    product_family: "balanced",
    product_type: "unit_trust",
    vehicle_type: "unit_trust",
    comparison_group: "sa_multi_asset_balanced",
    risk_band: "moderate",
    target_market: "Investors wanting low-cost balanced market exposure.",
    source_asof_date: "2025-09-30",
    eac_confidence: "high",
    features: [
      { feature_key: "style", feature_value: "Low-cost balanced exposure", display_label: "Management style" },
      { feature_key: "objective", feature_value: "Balanced portfolio with cost-efficient implementation", display_label: "Objective" },
    ],
    cost_components: [
      { component_type: "total_expense_ratio", charge_basis: "annual_pct", value_min: 0.0044, notes: "TER from Sygnia fund fact sheet.", display_order: 1 },
      { component_type: "transaction_cost", charge_basis: "annual_pct", value_min: 0.0004, notes: "Transaction cost from Sygnia fund fact sheet.", display_order: 2 },
    ],
    sources: [
      {
        source_url: "https://www.sygnia.co.za/wp-content/uploads/2025/03/2025-SEPT-SSBSA-Sygnia-Skeleton-Balanced-60-FFS_2016_SKEL-1.pdf",
        document_type: "factsheet",
        page_ref: "fees",
        evidence_snippet: "Sygnia Skeleton Balanced 60 Fund factsheet explains TER and transaction costs and provides the latest available annualised cost disclosures.",
      },
    ],
  },
];

export async function seedProductCatalog() {
  await ensureProductCatalogTables();

  for (const provider of providers) {
    await sql`
      INSERT INTO provider (provider_id, provider_name, provider_type, website_url, active)
      VALUES (${provider.provider_id}, ${provider.provider_name}, ${provider.provider_type}, ${provider.website_url}, TRUE)
      ON CONFLICT (provider_id) DO UPDATE SET
        provider_name = EXCLUDED.provider_name,
        provider_type = EXCLUDED.provider_type,
        website_url = EXCLUDED.website_url,
        active = EXCLUDED.active;
    `;
  }

  for (const product of products) {
    await sql`
      INSERT INTO provider_product (
        product_id,
        provider_id,
        reference_fund_id,
        product_name,
        product_family,
        product_type,
        vehicle_type,
        comparison_group,
        risk_band,
        target_market,
        minimum_investment,
        minimum_debit_order,
        source_asof_date,
        eac_confidence,
        active
      )
      VALUES (
        ${product.product_id},
        ${product.provider_id},
        ${product.reference_fund_id ?? null},
        ${product.product_name},
        ${product.product_family},
        ${product.product_type},
        ${product.vehicle_type},
        ${product.comparison_group},
        ${product.risk_band},
        ${product.target_market},
        ${product.minimum_investment ?? null},
        ${product.minimum_debit_order ?? null},
        ${product.source_asof_date},
        ${product.eac_confidence},
        TRUE
      )
      ON CONFLICT (product_id) DO UPDATE SET
        provider_id = EXCLUDED.provider_id,
        reference_fund_id = EXCLUDED.reference_fund_id,
        product_name = EXCLUDED.product_name,
        product_family = EXCLUDED.product_family,
        product_type = EXCLUDED.product_type,
        vehicle_type = EXCLUDED.vehicle_type,
        comparison_group = EXCLUDED.comparison_group,
        risk_band = EXCLUDED.risk_band,
        target_market = EXCLUDED.target_market,
        minimum_investment = EXCLUDED.minimum_investment,
        minimum_debit_order = EXCLUDED.minimum_debit_order,
        source_asof_date = EXCLUDED.source_asof_date,
        eac_confidence = EXCLUDED.eac_confidence,
        active = EXCLUDED.active;
    `;

    await sql`DELETE FROM product_cost_component WHERE product_id = ${product.product_id};`;
    await sql`DELETE FROM product_feature WHERE product_id = ${product.product_id};`;
    await sql`DELETE FROM product_source WHERE product_id = ${product.product_id};`;

    for (const feature of product.features) {
      await sql`
        INSERT INTO product_feature (product_id, feature_key, feature_value, display_label)
        VALUES (${product.product_id}, ${feature.feature_key}, ${feature.feature_value}, ${feature.display_label});
      `;
    }

    for (const component of product.cost_components) {
      await sql`
        INSERT INTO product_cost_component (
          product_id,
          component_type,
          charge_basis,
          value_min,
          value_max,
          frequency,
          notes,
          is_included_in_eac,
          display_order
        )
        VALUES (
          ${product.product_id},
          ${component.component_type},
          ${component.charge_basis},
          ${component.value_min},
          ${component.value_max ?? component.value_min},
          ${component.frequency ?? "annual"},
          ${component.notes},
          ${component.is_included_in_eac ?? true},
          ${component.display_order ?? 1}
        );
      `;
    }

    for (const source of product.sources) {
      await sql`
        INSERT INTO product_source (product_id, source_url, document_type, page_ref, evidence_snippet)
        VALUES (
          ${product.product_id},
          ${source.source_url},
          ${source.document_type},
          ${source.page_ref ?? null},
          ${source.evidence_snippet}
        );
      `;
    }
  }
}

export async function seedClientProductMappings() {
  await ensureProductCatalogTables();
  await sql`DELETE FROM client_product_mapping;`;

  const result = await sql`
    SELECT
      p.policy_id,
      p.client_id,
      pp.product_id
    FROM policy p
    JOIN provider_product pp
      ON pp.reference_fund_id = p.fund_id
    WHERE pp.reference_fund_id IS NOT NULL;
  `;

  for (const row of result.rows) {
    await sql`
      INSERT INTO client_product_mapping (
        client_id,
        policy_id,
        product_id,
        mapping_method,
        mapping_confidence,
        notes
      )
      VALUES (
        ${Number(row.client_id)},
        ${Number(row.policy_id)},
        ${Number(row.product_id)},
        'reference_fund_id',
        'high',
        'Mapped from policy fund_id to curated product catalog reference_fund_id.'
      );
    `;
  }
}
