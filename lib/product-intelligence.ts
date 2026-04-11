import { sql } from "@vercel/postgres";
import { ensureProductCatalogTables } from "@/lib/cockpit-storage";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ProviderRecord {
  provider_id: number;
  provider_name: string;
  provider_type: "life_office" | "asset_manager";
  website_url: string | null;
  active: boolean;
}

export interface ProductCostComponentRecord {
  component_id: number;
  product_id: number;
  component_type: string;
  charge_basis: string;
  value_min: number | null;
  value_max: number | null;
  frequency: string;
  notes: string;
  is_included_in_eac: boolean;
  display_order: number;
}

export interface ProductFeatureRecord {
  feature_id: number;
  product_id: number;
  feature_key: string;
  feature_value: string;
  display_label: string;
}

export interface ProductSourceRecord {
  source_id: number;
  product_id: number;
  source_url: string;
  document_type: string;
  page_ref: string | null;
  evidence_snippet: string;
  captured_at: string;
}

export interface ProductListItem {
  product_id: number;
  provider_id: number;
  provider_name: string;
  provider_type: "life_office" | "asset_manager";
  reference_fund_id: number | null;
  product_name: string;
  product_family: string;
  product_type: string;
  vehicle_type: string;
  comparison_group: string;
  risk_band: string;
  target_market: string | null;
  minimum_investment: number | null;
  minimum_debit_order: number | null;
  source_asof_date: string | null;
  eac_confidence: ConfidenceLevel;
  active: boolean;
}

export interface EacComponent {
  component_type: string;
  label: string;
  value_pct: number | null;
  notes: string;
}

export interface EacBreakdown {
  product_id: number;
  provider_name: string;
  product_name: string;
  product_family: string;
  vehicle_type: string;
  comparison_group: string;
  headline_eac_pct: number | null;
  included_components: EacComponent[];
  excluded_components: EacComponent[];
  upfront_costs: EacComponent[];
  assumption_notes: string[];
  confidence_level: ConfidenceLevel;
  source_count: number;
  sources: ProductSourceRecord[];
}

export interface ProductDetail extends ProductListItem {
  features: ProductFeatureRecord[];
  cost_components: ProductCostComponentRecord[];
  sources: ProductSourceRecord[];
  eac: EacBreakdown;
}

export interface ProductQueryFilters {
  providerId?: number | null;
  providerType?: string | null;
  vehicleType?: string | null;
  productFamily?: string | null;
  query?: string | null;
}

export interface EacAssumptions {
  investmentAmount?: number | null;
  ongoingAdvicePct?: number | null;
  initialAdvicePct?: number | null;
}

export interface AlternativeProductCandidate {
  product_id: number;
  provider_name: string;
  product_name: string;
  headline_eac_pct: number | null;
  rationale: string;
}

export interface ClientProductSignal {
  client_id: number;
  client_name: string;
  policy_id: number;
  policy_number: string;
  product_id: number;
  provider_name: string;
  product_name: string;
  headline_eac_pct: number | null;
  confidence_level: ConfidenceLevel;
  fit_issue: string | null;
  cost_issue: string | null;
  summary: string;
  alternative_products: AlternativeProductCandidate[];
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

function asIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

function mapListRow(row: Record<string, unknown>): ProductListItem {
  return {
    product_id: toInt(row.product_id),
    provider_id: toInt(row.provider_id),
    provider_name: String(row.provider_name),
    provider_type: String(row.provider_type) as ProductListItem["provider_type"],
    reference_fund_id: row.reference_fund_id == null ? null : toInt(row.reference_fund_id),
    product_name: String(row.product_name),
    product_family: String(row.product_family),
    product_type: String(row.product_type),
    vehicle_type: String(row.vehicle_type),
    comparison_group: String(row.comparison_group),
    risk_band: String(row.risk_band),
    target_market: row.target_market ? String(row.target_market) : null,
    minimum_investment: row.minimum_investment == null ? null : toNumber(row.minimum_investment),
    minimum_debit_order: row.minimum_debit_order == null ? null : toNumber(row.minimum_debit_order),
    source_asof_date: asIsoDate(row.source_asof_date),
    eac_confidence: String(row.eac_confidence) as ConfidenceLevel,
    active: Boolean(row.active),
  };
}

function componentLabel(componentType: string): string {
  switch (componentType) {
    case "total_expense_ratio":
      return "TER";
    case "transaction_cost":
      return "Transaction cost";
    case "annual_management_fee":
      return "Annual management fee";
    case "platform_fee":
      return "Platform fee";
    case "administration_fee":
      return "Administration fee";
    case "performance_fee":
      return "Performance fee";
    case "vat":
      return "VAT";
    case "advice_ongoing":
      return "Adviser ongoing fee";
    case "advice_initial":
      return "Adviser initial fee";
    default:
      return componentType.replaceAll("_", " ");
  }
}

function normaliseComponentValue(
  component: ProductCostComponentRecord,
  assumptions: EacAssumptions,
): number | null {
  if (component.charge_basis === "annual_pct") {
    if (component.value_min == null && component.value_max == null) return null;
    if (component.value_min != null && component.value_max != null) {
      return (component.value_min + component.value_max) / 2;
    }
    return component.value_min ?? component.value_max ?? null;
  }

  if (component.charge_basis === "tiered_pct") {
    return component.value_min ?? component.value_max ?? null;
  }

  if (component.charge_basis === "flat_amount") {
    const investmentAmount = assumptions.investmentAmount ?? null;
    if (!investmentAmount || investmentAmount <= 0 || component.value_min == null) return null;
    return component.value_min / investmentAmount;
  }

  return component.value_min ?? component.value_max ?? null;
}

function downgradeConfidence(current: ConfidenceLevel): ConfidenceLevel {
  if (current === "high") return "medium";
  return "low";
}

function buildEacFromRecords(
  product: ProductListItem,
  costComponents: ProductCostComponentRecord[],
  sources: ProductSourceRecord[],
  assumptions: EacAssumptions = {},
): EacBreakdown {
  let confidence = product.eac_confidence;
  const assumptionNotes: string[] = [];
  const includedComponents: EacComponent[] = [];
  const excludedComponents: EacComponent[] = [];
  const upfrontCosts: EacComponent[] = [];

  for (const component of costComponents) {
    const value = normaliseComponentValue(component, assumptions);
    const mapped: EacComponent = {
      component_type: component.component_type,
      label: componentLabel(component.component_type),
      value_pct: value,
      notes: component.notes,
    };

    if (component.charge_basis === "once_off_pct" || component.component_type === "advice_initial") {
      upfrontCosts.push(mapped);
      continue;
    }

    if (component.is_included_in_eac) {
      includedComponents.push(mapped);
      if (value == null) {
        confidence = downgradeConfidence(confidence);
      }
    } else {
      excludedComponents.push(mapped);
    }
  }

  if (assumptions.ongoingAdvicePct != null && assumptions.ongoingAdvicePct > 0) {
    includedComponents.push({
      component_type: "advice_ongoing",
      label: "Adviser ongoing fee",
      value_pct: assumptions.ongoingAdvicePct,
      notes: "Added from request assumptions.",
    });
    assumptionNotes.push(
      `Included adviser ongoing fee assumption of ${(assumptions.ongoingAdvicePct * 100).toFixed(2)}%.`,
    );
  }

  if (assumptions.initialAdvicePct != null && assumptions.initialAdvicePct > 0) {
    upfrontCosts.push({
      component_type: "advice_initial",
      label: "Adviser initial fee",
      value_pct: assumptions.initialAdvicePct,
      notes: "Added from request assumptions.",
    });
    assumptionNotes.push(
      `Excluded adviser initial fee assumption of ${(assumptions.initialAdvicePct * 100).toFixed(2)}% from headline EAC.`,
    );
  }

  const headline = includedComponents
    .filter((component) => component.value_pct != null)
    .reduce((sum, component) => sum + (component.value_pct ?? 0), 0);

  const headlineEac = includedComponents.some((component) => component.value_pct != null)
    ? Number(headline.toFixed(6))
    : null;

  if (headlineEac == null) {
    confidence = "low";
    assumptionNotes.push("Headline EAC is unavailable because the curated source set does not contain enough numeric recurring-cost fields.");
  }

  if (costComponents.some((component) => component.component_type === "performance_fee")) {
    assumptionNotes.push("Performance fee disclosures are shown separately and excluded from the headline EAC unless a deterministic rate is supplied.");
  }

  return {
    product_id: product.product_id,
    provider_name: product.provider_name,
    product_name: product.product_name,
    product_family: product.product_family,
    vehicle_type: product.vehicle_type,
    comparison_group: product.comparison_group,
    headline_eac_pct: headlineEac,
    included_components: includedComponents,
    excluded_components: excludedComponents,
    upfront_costs: upfrontCosts,
    assumption_notes: assumptionNotes,
    confidence_level: confidence,
    source_count: sources.length,
    sources,
  };
}

async function getCostComponents(productId: number): Promise<ProductCostComponentRecord[]> {
  const result = await sql`
    SELECT *
    FROM product_cost_component
    WHERE product_id = ${productId}
    ORDER BY display_order ASC, component_id ASC;
  `;

  return result.rows.map((row) => ({
    component_id: toInt(row.component_id),
    product_id: toInt(row.product_id),
    component_type: String(row.component_type),
    charge_basis: String(row.charge_basis),
    value_min: row.value_min == null ? null : toNumber(row.value_min),
    value_max: row.value_max == null ? null : toNumber(row.value_max),
    frequency: String(row.frequency),
    notes: String(row.notes ?? ""),
    is_included_in_eac: Boolean(row.is_included_in_eac),
    display_order: toInt(row.display_order, 1),
  }));
}

async function getFeatures(productId: number): Promise<ProductFeatureRecord[]> {
  const result = await sql`
    SELECT *
    FROM product_feature
    WHERE product_id = ${productId}
    ORDER BY feature_id ASC;
  `;

  return result.rows.map((row) => ({
    feature_id: toInt(row.feature_id),
    product_id: toInt(row.product_id),
    feature_key: String(row.feature_key),
    feature_value: String(row.feature_value),
    display_label: String(row.display_label),
  }));
}

async function getSources(productId: number): Promise<ProductSourceRecord[]> {
  const result = await sql`
    SELECT *
    FROM product_source
    WHERE product_id = ${productId}
    ORDER BY source_id ASC;
  `;

  return result.rows.map((row) => ({
    source_id: toInt(row.source_id),
    product_id: toInt(row.product_id),
    source_url: String(row.source_url),
    document_type: String(row.document_type),
    page_ref: row.page_ref ? String(row.page_ref) : null,
    evidence_snippet: String(row.evidence_snippet),
    captured_at: new Date(String(row.captured_at)).toISOString(),
  }));
}

export async function getProviders(providerType?: string | null): Promise<ProviderRecord[]> {
  await ensureProductCatalogTables();

  const result = providerType
    ? await sql`
        SELECT *
        FROM provider
        WHERE active = TRUE
          AND provider_type = ${providerType}
        ORDER BY provider_name ASC;
      `
    : await sql`
        SELECT *
        FROM provider
        WHERE active = TRUE
        ORDER BY provider_name ASC;
      `;

  return result.rows.map((row) => ({
    provider_id: toInt(row.provider_id),
    provider_name: String(row.provider_name),
    provider_type: String(row.provider_type) as ProviderRecord["provider_type"],
    website_url: row.website_url ? String(row.website_url) : null,
    active: Boolean(row.active),
  }));
}

export async function getProducts(filters: ProductQueryFilters = {}): Promise<ProductListItem[]> {
  await ensureProductCatalogTables();

  const clauses: string[] = ["pp.active = TRUE"];
  const values: unknown[] = [];

  if (filters.providerId) {
    values.push(filters.providerId);
    clauses.push(`pp.provider_id = $${values.length}`);
  }
  if (filters.providerType) {
    values.push(filters.providerType);
    clauses.push(`p.provider_type = $${values.length}`);
  }
  if (filters.vehicleType) {
    values.push(filters.vehicleType);
    clauses.push(`pp.vehicle_type = $${values.length}`);
  }
  if (filters.productFamily) {
    values.push(filters.productFamily);
    clauses.push(`pp.product_family = $${values.length}`);
  }
  if (filters.query) {
    values.push(`%${filters.query.toLowerCase()}%`);
    clauses.push(`(LOWER(pp.product_name) LIKE $${values.length} OR LOWER(p.provider_name) LIKE $${values.length})`);
  }

  const query = `
    SELECT
      pp.*,
      p.provider_name,
      p.provider_type
    FROM provider_product pp
    JOIN provider p ON p.provider_id = pp.provider_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY p.provider_name ASC, pp.product_name ASC
  `;

  const result = await sql.query(query, values);
  return result.rows.map((row) => mapListRow(row as Record<string, unknown>));
}

export async function calculateProductEac(
  productId: number,
  assumptions: EacAssumptions = {},
): Promise<EacBreakdown | null> {
  const product = await getProductById(productId);
  if (!product) return null;
  const [costComponents, sources] = await Promise.all([
    getCostComponents(productId),
    getSources(productId),
  ]);
  return buildEacFromRecords(product, costComponents, sources, assumptions);
}

export async function calculateProductEacs(
  productIds: number[],
  assumptions: EacAssumptions = {},
): Promise<EacBreakdown[]> {
  const uniqueIds = Array.from(new Set(productIds.filter((id) => Number.isFinite(id))));
  const results = await Promise.all(uniqueIds.map((productId) => calculateProductEac(productId, assumptions)));
  return results.filter((result): result is EacBreakdown => Boolean(result));
}

export async function getProductById(productId: number): Promise<ProductListItem | null> {
  await ensureProductCatalogTables();
  const result = await sql`
    SELECT
      pp.*,
      p.provider_name,
      p.provider_type
    FROM provider_product pp
    JOIN provider p ON p.provider_id = pp.provider_id
    WHERE pp.product_id = ${productId}
    LIMIT 1;
  `;

  const row = result.rows[0];
  return row ? mapListRow(row as Record<string, unknown>) : null;
}

export async function getProductDetail(productId: number): Promise<ProductDetail | null> {
  const product = await getProductById(productId);
  if (!product) return null;

  const [costComponents, features, sources] = await Promise.all([
    getCostComponents(productId),
    getFeatures(productId),
    getSources(productId),
  ]);

  return {
    ...product,
    features,
    cost_components: costComponents,
    sources,
    eac: buildEacFromRecords(product, costComponents, sources),
  };
}

interface ClientMappingRow {
  client_id: number;
  client_name: string;
  risk_profile: string;
  policy_id: number;
  policy_number: string;
  product_id: number;
}

function fitIssueFor(riskProfile: string, productRiskBand: string): string | null {
  if (riskProfile === "conservative" && productRiskBand === "aggressive") {
    return "Current product risk looks high for a conservative client profile.";
  }
  if (riskProfile === "moderate" && productRiskBand === "aggressive") {
    return "Current product risk may be high for a moderate client profile.";
  }
  if (riskProfile === "aggressive" && productRiskBand === "conservative") {
    return "Current product may be too defensive for an aggressive client profile.";
  }
  return null;
}

function severityScore(signal: Pick<ClientProductSignal, "fit_issue" | "cost_issue" | "headline_eac_pct">): number {
  let score = 0;
  if (signal.fit_issue) score += 80;
  if (signal.cost_issue) score += 60;
  if ((signal.headline_eac_pct ?? 0) >= 0.015) score += 20;
  return score;
}

async function getAdvisorClientMappings(advisorId: number): Promise<ClientMappingRow[]> {
  await ensureProductCatalogTables();

  const result = await sql`
    SELECT
      c.client_id,
      c.first_name || ' ' || c.last_name AS client_name,
      c.risk_profile,
      p.policy_id,
      p.policy_number,
      m.product_id
    FROM client_product_mapping m
    JOIN client c ON c.client_id = m.client_id
    LEFT JOIN policy p ON p.policy_id = m.policy_id
    WHERE c.advisor_id = ${advisorId}
      AND m.policy_id IS NOT NULL
    ORDER BY c.client_id ASC, p.policy_id ASC;
  `;

  return result.rows.map((row) => ({
    client_id: toInt(row.client_id),
    client_name: String(row.client_name),
    risk_profile: String(row.risk_profile),
    policy_id: toInt(row.policy_id),
    policy_number: String(row.policy_number),
    product_id: toInt(row.product_id),
  }));
}

async function getClientMappings(advisorId: number, clientId: number): Promise<ClientMappingRow[]> {
  const rows = await getAdvisorClientMappings(advisorId);
  return rows.filter((row) => row.client_id === clientId);
}

function differenceLabel(current: number, alternative: number): string {
  return `${((current - alternative) * 100).toFixed(2)}% lower estimated annual cost`;
}

export async function getAdvisorClientProductSignals(
  advisorId: number,
): Promise<Map<number, ClientProductSignal>> {
  const mappingRows = await getAdvisorClientMappings(advisorId);
  if (mappingRows.length === 0) return new Map();

  const currentProducts = await Promise.all(
    Array.from(new Set(mappingRows.map((row) => row.product_id))).map((productId) =>
      getProductDetail(productId),
    ),
  );
  const productMap = new Map(
    currentProducts
      .filter((product): product is ProductDetail => Boolean(product))
      .map((product) => [product.product_id, product]),
  );

  const allProducts = await getProducts();
  const allProductDetails = await Promise.all(allProducts.map((product) => getProductDetail(product.product_id)));
  const detailedProducts = allProductDetails.filter((product): product is ProductDetail => Boolean(product));
  const byComparisonGroup = new Map<string, ProductDetail[]>();
  for (const product of detailedProducts) {
    const bucket = byComparisonGroup.get(product.comparison_group) ?? [];
    bucket.push(product);
    byComparisonGroup.set(product.comparison_group, bucket);
  }

  const signalsByClient = new Map<number, ClientProductSignal>();

  for (const row of mappingRows) {
    const product = productMap.get(row.product_id);
    if (!product) continue;

    const currentEac = product.eac.headline_eac_pct;
    const alternatives = (byComparisonGroup.get(product.comparison_group) ?? [])
      .filter((candidate) => candidate.product_id !== product.product_id)
      .filter((candidate) => candidate.eac.headline_eac_pct != null)
      .sort(
        (left, right) =>
          (left.eac.headline_eac_pct ?? Number.POSITIVE_INFINITY) -
          (right.eac.headline_eac_pct ?? Number.POSITIVE_INFINITY),
      );

    const cheaperAlternatives = alternatives
      .filter(
        (candidate) =>
          currentEac != null &&
          candidate.eac.headline_eac_pct != null &&
          candidate.eac.headline_eac_pct <= currentEac - 0.0025,
      )
      .slice(0, 2)
      .map((candidate) => ({
        product_id: candidate.product_id,
        provider_name: candidate.provider_name,
        product_name: candidate.product_name,
        headline_eac_pct: candidate.eac.headline_eac_pct,
        rationale:
          currentEac != null && candidate.eac.headline_eac_pct != null
            ? differenceLabel(currentEac, candidate.eac.headline_eac_pct)
            : "Comparable product in the same category.",
      }));

    const fitIssue = fitIssueFor(row.risk_profile, product.risk_band);
    const costIssue =
      currentEac != null && cheaperAlternatives.length > 0
        ? `${product.product_name} sits above lower-cost alternatives in the same comparison group.`
        : null;

    const signal: ClientProductSignal = {
      client_id: row.client_id,
      client_name: row.client_name,
      policy_id: row.policy_id,
      policy_number: row.policy_number,
      product_id: product.product_id,
      provider_name: product.provider_name,
      product_name: product.product_name,
      headline_eac_pct: currentEac,
      confidence_level: product.eac.confidence_level,
      fit_issue: fitIssue,
      cost_issue: costIssue,
      summary:
        fitIssue || costIssue
          ? `${product.product_name} (${product.provider_name}) needs a product review.`
          : `${product.product_name} (${product.provider_name}) cost profile is captured for ongoing servicing.`,
      alternative_products: cheaperAlternatives,
    };

    const existing = signalsByClient.get(row.client_id);
    if (!existing || severityScore(signal) > severityScore(existing)) {
      signalsByClient.set(row.client_id, signal);
    }
  }

  return signalsByClient;
}

export async function getClientProductIntelligence(
  advisorId: number,
  clientId: number,
): Promise<{
  mapped_products: ProductDetail[];
  primary_signal: ClientProductSignal | null;
}> {
  const rows = await getClientMappings(advisorId, clientId);
  const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
  const mappedProducts = await Promise.all(productIds.map((productId) => getProductDetail(productId)));
  const signals = await getAdvisorClientProductSignals(advisorId);

  return {
    mapped_products: mappedProducts.filter((product): product is ProductDetail => Boolean(product)),
    primary_signal: signals.get(clientId) ?? null,
  };
}

export async function summariseAdvisorProductSignals(advisorId: number): Promise<{
  mapped_client_count: number;
  cost_review_count: number;
  fit_review_count: number;
  top_signals: ClientProductSignal[];
}> {
  const signals = Array.from((await getAdvisorClientProductSignals(advisorId)).values());
  return {
    mapped_client_count: signals.length,
    cost_review_count: signals.filter((signal) => Boolean(signal.cost_issue)).length,
    fit_review_count: signals.filter((signal) => Boolean(signal.fit_issue)).length,
    top_signals: signals
      .sort((left, right) => severityScore(right) - severityScore(left))
      .slice(0, 3),
  };
}
