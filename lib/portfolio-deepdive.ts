/**
 * Portfolio deep-dive aggregations for the Analytics tab.
 *
 * Returns a single snapshot that powers all portfolio-level charts
 * (sector, geography, wrapper mix, top holdings, quartile distribution,
 * cost histogram, vintage, risk-return scatter).
 *
 * Scope:
 *   - `clientId == null` → aggregated over the advisor's whole book
 *   - `clientId != null` → a single client's portfolio
 *
 * Geographic exposure is inferred from fund and sector names (see
 * inferGeographicExposure). This is a temporary heuristic until a
 * dedicated geographic-exposure column lands on the `fund` table.
 */

import { sql } from "@/lib/db";
import { ClientRow, getAdvisorClients } from "@/lib/advisor-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectorAllocationBucket {
  sector_name: string;
  value: number;
  pct: number;
}

export interface GeographicExposureBucket {
  country_iso3: string;
  country_name: string;
  region: string;
  value: number;
  pct: number;
}

export interface WrapperTypeBucket {
  wrapper_type: string;
  display_name: string;
  value: number;
  pct: number;
}

export interface TopHoldingRow {
  fund_id: number;
  fund_name: string;
  sector_name: string | null;
  value: number;
  pct: number;
}

export interface QuartileBucket {
  quartile: 1 | 2 | 3 | 4;
  value: number;
  pct: number;
}

export interface EacHistogramBucket {
  bucket_label: string;
  lower_pct: number;
  upper_pct: number;
  value: number;
  pct: number;
}

export interface VintageBucket {
  decade_label: string;
  decade_start: number;
  value: number;
  pct: number;
}

export interface RiskReturnPoint {
  client_id: number;
  client_name: string;
  one_year_return_pct: number;
  avg_quartile: number;
  total_aum: number;
  has_risk_mismatch: boolean;
}

export interface PortfolioDeepDiveSnapshot {
  scope: "advisor" | "client";
  client_id: number | null;
  client_name: string | null;
  total_value: number;
  holdings_count: number;
  weighted_avg_ner_pct: number;
  sector_allocation: SectorAllocationBucket[];
  geographic_exposure: GeographicExposureBucket[];
  wrapper_mix: WrapperTypeBucket[];
  top_holdings: TopHoldingRow[];
  quartile_distribution: QuartileBucket[];
  eac_distribution: EacHistogramBucket[];
  vintage_distribution: VintageBucket[];
  risk_return_scatter: RiskReturnPoint[];
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

function withPct<T extends { value: number }>(rows: T[], total: number): (T & { pct: number })[] {
  if (total <= 0) return rows.map((row) => ({ ...row, pct: 0 }));
  return rows.map((row) => ({ ...row, pct: (row.value / total) * 100 }));
}

// ---------------------------------------------------------------------------
// Geographic exposure heuristic
// ---------------------------------------------------------------------------
//
// Until the `fund` table carries a geographic exposure breakdown, we infer
// exposure from the fund name and sector name. Each fund is mapped to one
// "primary" country bucket plus a region label for bar-chart fallbacks.
// The inference is intentionally conservative: when nothing else matches,
// exposure is attributed to South Africa (the home market).

interface GeoGuess {
  country_iso3: string;
  country_name: string;
  region: string;
}

const GEO_RULES: { pattern: RegExp; guess: GeoGuess }[] = [
  { pattern: /\bglobal\b|\bworldwide\b|\bworld\b/i, guess: { country_iso3: "USA", country_name: "United States", region: "Global (developed)" } },
  { pattern: /\bus\b|\bu\.s\.\b|america|s&p|nasdaq/i, guess: { country_iso3: "USA", country_name: "United States", region: "North America" } },
  { pattern: /europe|eurozone|\beur\b/i, guess: { country_iso3: "DEU", country_name: "Germany", region: "Europe" } },
  { pattern: /united kingdom|\buk\b|britain/i, guess: { country_iso3: "GBR", country_name: "United Kingdom", region: "Europe" } },
  { pattern: /china|\bchinese\b/i, guess: { country_iso3: "CHN", country_name: "China", region: "Asia-Pacific" } },
  { pattern: /japan/i, guess: { country_iso3: "JPN", country_name: "Japan", region: "Asia-Pacific" } },
  { pattern: /india/i, guess: { country_iso3: "IND", country_name: "India", region: "Asia-Pacific" } },
  { pattern: /emerging markets|\bem\b/i, guess: { country_iso3: "BRA", country_name: "Brazil", region: "Emerging markets" } },
  { pattern: /africa(?!.*south)/i, guess: { country_iso3: "NGA", country_name: "Nigeria", region: "Rest of Africa" } },
  { pattern: /offshore|international|foreign/i, guess: { country_iso3: "USA", country_name: "United States", region: "Global (developed)" } },
];

const ZA_GUESS: GeoGuess = {
  country_iso3: "ZAF",
  country_name: "South Africa",
  region: "South Africa",
};

function inferGeographicExposure(fundName: string, sectorName: string | null): GeoGuess {
  const haystack = `${fundName} ${sectorName ?? ""}`;
  for (const rule of GEO_RULES) {
    if (rule.pattern.test(haystack)) return rule.guess;
  }
  return ZA_GUESS;
}

// ---------------------------------------------------------------------------
// Wrapper-type display labels
// ---------------------------------------------------------------------------

const WRAPPER_TYPE_LABELS: Record<string, string> = {
  retirement_annuity: "Retirement Annuity",
  tfsa: "Tax-Free Savings",
  endowment: "Endowment",
  living_annuity: "Living Annuity",
  preservation_fund: "Preservation Fund",
  unit_trust: "Unit Trust",
  guaranteed_annuity: "Guaranteed Annuity",
};

// ---------------------------------------------------------------------------
// Holding-level row shape returned by the aggregation query
// ---------------------------------------------------------------------------

interface HoldingRow {
  client_id: number;
  fund_id: number;
  fund_name: string;
  fund_inception_year: number | null;
  net_expense_ratio: number | null;
  sector_name: string | null;
  current_value: number;
  quartile: number | null;
}

async function fetchHoldings(
  advisorId: number,
  clientId: number | null,
): Promise<HoldingRow[]> {
  const res = clientId == null
    ? await sql`
        WITH latest_holdings AS (
          SELECT DISTINCT ON (pfhs.policy_id, pfhs.fund_id)
            pfhs.policy_id,
            pfhs.fund_id,
            pfhs.current_value,
            pfhs.as_of_date
          FROM policy_fund_holding_snapshot pfhs
          ORDER BY pfhs.policy_id, pfhs.fund_id, pfhs.as_of_date DESC, pfhs.holding_id DESC
        )
        SELECT
          c.client_id,
          f.fund_id,
          f.fund_name,
          EXTRACT(YEAR FROM f.inception_date)::INT AS fund_inception_year,
          f.net_expense_ratio::NUMERIC AS net_expense_ratio,
          s.sector_name,
          COALESCE(lh.current_value, 0)::NUMERIC AS current_value,
          COALESCE(frf.peer_group_quartile, 2)::INT AS quartile
        FROM latest_holdings lh
        JOIN policy p ON p.policy_id = lh.policy_id
        JOIN client c ON c.client_id = p.client_id
        JOIN fund f ON f.fund_id = lh.fund_id
        LEFT JOIN sector s ON s.sector_id = f.sector_id
        LEFT JOIN fund_ranking_fact frf ON frf.fund_id = f.fund_id
          AND frf.period_id = (
            SELECT period_id FROM period_definition WHERE period_code = '1Y'
          )
        WHERE c.advisor_id = ${advisorId};
      `
    : await sql`
        WITH latest_holdings AS (
          SELECT DISTINCT ON (pfhs.policy_id, pfhs.fund_id)
            pfhs.policy_id,
            pfhs.fund_id,
            pfhs.current_value,
            pfhs.as_of_date
          FROM policy_fund_holding_snapshot pfhs
          JOIN policy p ON p.policy_id = pfhs.policy_id
          WHERE p.client_id = ${clientId}
          ORDER BY pfhs.policy_id, pfhs.fund_id, pfhs.as_of_date DESC, pfhs.holding_id DESC
        )
        SELECT
          c.client_id,
          f.fund_id,
          f.fund_name,
          EXTRACT(YEAR FROM f.inception_date)::INT AS fund_inception_year,
          f.net_expense_ratio::NUMERIC AS net_expense_ratio,
          s.sector_name,
          COALESCE(lh.current_value, 0)::NUMERIC AS current_value,
          COALESCE(frf.peer_group_quartile, 2)::INT AS quartile
        FROM latest_holdings lh
        JOIN policy p ON p.policy_id = lh.policy_id
        JOIN client c ON c.client_id = p.client_id
        JOIN fund f ON f.fund_id = lh.fund_id
        LEFT JOIN sector s ON s.sector_id = f.sector_id
        LEFT JOIN fund_ranking_fact frf ON frf.fund_id = f.fund_id
          AND frf.period_id = (
            SELECT period_id FROM period_definition WHERE period_code = '1Y'
          )
        WHERE c.advisor_id = ${advisorId}
          AND c.client_id = ${clientId};
      `;

  return res.rows.map((row) => ({
    client_id: toInt(row.client_id),
    fund_id: toInt(row.fund_id),
    fund_name: String(row.fund_name),
    fund_inception_year:
      row.fund_inception_year == null ? null : toInt(row.fund_inception_year),
    net_expense_ratio:
      row.net_expense_ratio == null ? null : toNumber(row.net_expense_ratio),
    sector_name: row.sector_name ? String(row.sector_name) : null,
    current_value: toNumber(row.current_value),
    quartile: row.quartile == null ? null : toInt(row.quartile, 2),
  }));
}

interface WrapperRow {
  wrapper_type: string;
  value: number;
}

async function fetchWrapperMix(
  advisorId: number,
  clientId: number | null,
): Promise<WrapperRow[]> {
  const res = clientId == null
    ? await sql`
        SELECT
          p.policy_type AS wrapper_type,
          SUM(COALESCE(p.current_value, 0))::NUMERIC AS value
        FROM policy p
        JOIN client c ON c.client_id = p.client_id
        WHERE c.advisor_id = ${advisorId}
        GROUP BY p.policy_type
        ORDER BY value DESC;
      `
    : await sql`
        SELECT
          p.policy_type AS wrapper_type,
          SUM(COALESCE(p.current_value, 0))::NUMERIC AS value
        FROM policy p
        JOIN client c ON c.client_id = p.client_id
        WHERE c.advisor_id = ${advisorId}
          AND c.client_id = ${clientId};
      `;
  return res.rows.map((row) => ({
    wrapper_type: String(row.wrapper_type),
    value: toNumber(row.value),
  }));
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function aggregate(
  holdings: HoldingRow[],
  wrapperRows: WrapperRow[],
  clients: ClientRow[],
  scope: "advisor" | "client",
  clientId: number | null,
): PortfolioDeepDiveSnapshot {
  const totalValue = holdings.reduce((sum, h) => sum + h.current_value, 0);

  // Sector allocation
  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    const key = h.sector_name ?? "Unclassified";
    sectorMap.set(key, (sectorMap.get(key) ?? 0) + h.current_value);
  }
  const sectorAllocation = withPct(
    Array.from(sectorMap, ([sector_name, value]) => ({ sector_name, value })).sort(
      (a, b) => b.value - a.value,
    ),
    totalValue,
  );

  // Geographic exposure (inferred)
  const geoMap = new Map<string, { guess: GeoGuess; value: number }>();
  for (const h of holdings) {
    const guess = inferGeographicExposure(h.fund_name, h.sector_name);
    const existing = geoMap.get(guess.country_iso3);
    if (existing) {
      existing.value += h.current_value;
    } else {
      geoMap.set(guess.country_iso3, { guess, value: h.current_value });
    }
  }
  const geographicExposure = withPct(
    Array.from(geoMap.values(), ({ guess, value }) => ({
      country_iso3: guess.country_iso3,
      country_name: guess.country_name,
      region: guess.region,
      value,
    })).sort((a, b) => b.value - a.value),
    totalValue,
  );

  // Wrapper mix
  const wrapperTotal = wrapperRows.reduce((sum, row) => sum + row.value, 0);
  const wrapperMix = withPct(
    wrapperRows.map((row) => ({
      wrapper_type: row.wrapper_type,
      display_name: WRAPPER_TYPE_LABELS[row.wrapper_type] ?? row.wrapper_type,
      value: row.value,
    })),
    wrapperTotal,
  );

  // Top holdings (aggregate by fund)
  const fundMap = new Map<number, { fund_name: string; sector_name: string | null; value: number }>();
  for (const h of holdings) {
    const existing = fundMap.get(h.fund_id);
    if (existing) {
      existing.value += h.current_value;
    } else {
      fundMap.set(h.fund_id, {
        fund_name: h.fund_name,
        sector_name: h.sector_name,
        value: h.current_value,
      });
    }
  }
  const topHoldings = withPct(
    Array.from(fundMap, ([fund_id, info]) => ({
      fund_id,
      fund_name: info.fund_name,
      sector_name: info.sector_name,
      value: info.value,
    }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    totalValue,
  );

  // Quartile distribution
  const quartileMap = new Map<1 | 2 | 3 | 4, number>([
    [1, 0], [2, 0], [3, 0], [4, 0],
  ]);
  for (const h of holdings) {
    const q = (h.quartile ?? 2) as 1 | 2 | 3 | 4;
    const clamped = (q < 1 ? 1 : q > 4 ? 4 : q) as 1 | 2 | 3 | 4;
    quartileMap.set(clamped, (quartileMap.get(clamped) ?? 0) + h.current_value);
  }
  const quartileDistribution = withPct(
    Array.from(quartileMap, ([quartile, value]) => ({ quartile, value })),
    totalValue,
  );

  // EAC histogram (net_expense_ratio weighted by AUM)
  const eacBuckets: EacHistogramBucket[] = [
    { bucket_label: "<0.75%",   lower_pct: 0.0,  upper_pct: 0.75, value: 0, pct: 0 },
    { bucket_label: "0.75–1.0%", lower_pct: 0.75, upper_pct: 1.0,  value: 0, pct: 0 },
    { bucket_label: "1.0–1.25%", lower_pct: 1.0,  upper_pct: 1.25, value: 0, pct: 0 },
    { bucket_label: "1.25–1.5%", lower_pct: 1.25, upper_pct: 1.5,  value: 0, pct: 0 },
    { bucket_label: "≥1.5%",    lower_pct: 1.5,  upper_pct: 100,  value: 0, pct: 0 },
  ];
  let weightedNerSum = 0;
  let weightedNerWeight = 0;
  for (const h of holdings) {
    if (h.net_expense_ratio == null) continue;
    const nerPct = h.net_expense_ratio * 100;
    weightedNerSum += nerPct * h.current_value;
    weightedNerWeight += h.current_value;
    const bucket = eacBuckets.find(
      (b) => nerPct >= b.lower_pct && nerPct < b.upper_pct,
    );
    if (bucket) bucket.value += h.current_value;
  }
  const eacTotal = eacBuckets.reduce((sum, b) => sum + b.value, 0);
  for (const b of eacBuckets) {
    b.pct = eacTotal > 0 ? (b.value / eacTotal) * 100 : 0;
  }
  const weightedAvgNer = weightedNerWeight > 0 ? weightedNerSum / weightedNerWeight : 0;

  // Vintage (decades of fund inception)
  const vintageMap = new Map<number, number>();
  for (const h of holdings) {
    if (h.fund_inception_year == null) continue;
    const decadeStart = Math.floor(h.fund_inception_year / 10) * 10;
    vintageMap.set(decadeStart, (vintageMap.get(decadeStart) ?? 0) + h.current_value);
  }
  const vintageDistribution = withPct(
    Array.from(vintageMap, ([decade_start, value]) => ({
      decade_start,
      decade_label: `${decade_start}s`,
      value,
    })).sort((a, b) => a.decade_start - b.decade_start),
    totalValue,
  );

  // Risk-return scatter (advisor scope only; per-client view is meaningless here)
  const riskReturnScatter: RiskReturnPoint[] =
    scope === "advisor"
      ? clients.map((client) => ({
          client_id: client.client_id,
          client_name: client.client_name,
          one_year_return_pct: client.avg_1y_return_pct,
          avg_quartile: client.avg_quartile,
          total_aum: client.total_aum,
          has_risk_mismatch: client.has_risk_mismatch,
        }))
      : [];

  const selectedClient = clientId == null ? null : clients.find((c) => c.client_id === clientId) ?? null;

  return {
    scope,
    client_id: clientId,
    client_name: selectedClient?.client_name ?? null,
    total_value: totalValue,
    holdings_count: holdings.length,
    weighted_avg_ner_pct: weightedAvgNer,
    sector_allocation: sectorAllocation,
    geographic_exposure: geographicExposure,
    wrapper_mix: wrapperMix,
    top_holdings: topHoldings,
    quartile_distribution: quartileDistribution,
    eac_distribution: eacBuckets,
    vintage_distribution: vintageDistribution,
    risk_return_scatter: riskReturnScatter,
  };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export async function getPortfolioDeepDiveSnapshot(
  advisorId: number,
  clientId: number | null,
): Promise<PortfolioDeepDiveSnapshot> {
  const scope = clientId == null ? "advisor" : "client";
  const [holdings, wrapperRows, clients] = await Promise.all([
    fetchHoldings(advisorId, clientId),
    fetchWrapperMix(advisorId, clientId),
    scope === "advisor" ? getAdvisorClients(advisorId) : Promise.resolve([]),
  ]);

  return aggregate(holdings, wrapperRows, clients, scope, clientId);
}
