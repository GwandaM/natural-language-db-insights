/**
 * Data queries for the Deep Dives analytics tab.
 * All queries are scoped to a single advisor's client book.
 */

import { sql } from "@/lib/db";

// ---------------------------------------------------------------------------
// Geographic region mapping — derived from SA fund sector allocations
// Multi-Asset balanced funds typically carry ~35% offshore (Reg 28 ceiling 45%).
// ---------------------------------------------------------------------------
const SECTOR_GEO_SPLIT: Record<string, Record<string, number>> = {
  "SA Equity":    { "South Africa": 1.0 },
  "Fixed Income": { "South Africa": 1.0 },
  "Multi-Asset":  { "South Africa": 0.62, "North America": 0.15, "Europe": 0.13, "Asia Pacific": 0.07, "Rest of Africa": 0.03 },
  "Money Market": { "South Africa": 1.0 },
  "Real Estate":  { "South Africa": 0.85, "Europe": 0.10, "North America": 0.05 },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectorAllocation {
  sector_name: string;
  total_value: number;
  pct: number;
}

export interface GeographicAllocation {
  region: string;
  total_value: number;
  pct: number;
}

export interface RiskReturnPoint {
  fund_name: string;
  return_1y: number;
  std_dev: number;
  sector_name: string;
  fund_size: number;
}

export interface HoldingConcentration {
  fund_name: string;
  total_value: number;
  pct: number;
  sector_name: string;
}

export interface FeeComparison {
  fund_name: string;
  management_fee_pct: number;
  return_1y_pct: number;
  sector_name: string;
}

export interface DeepDiveData {
  sectorAllocation: SectorAllocation[];
  geographicAllocation: GeographicAllocation[];
  riskReturn: RiskReturnPoint[];
  topHoldings: HoldingConcentration[];
  feeVsReturn: FeeComparison[];
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getDeepDiveData(advisorId: number): Promise<DeepDiveData> {
  // 1. Sector allocation from client fund holdings
  const sectorResult = await sql<{ sector_name: string; total_value: string }>`
    SELECT s.sector_name, SUM(fh.current_value)::text AS total_value
    FROM fund_holding fh
    JOIN wrapper w ON w.wrapper_id = fh.wrapper_id
    JOIN client c ON c.client_id = w.client_id
    JOIN fund f ON f.fund_id = fh.fund_id
    JOIN sector s ON s.sector_id = f.sector_id
    WHERE c.advisor_id = ${advisorId}
    GROUP BY s.sector_name
    ORDER BY SUM(fh.current_value) DESC
  `;

  const sectorTotal = sectorResult.rows.reduce((sum, r) => sum + Number(r.total_value), 0);
  const sectorAllocation: SectorAllocation[] = sectorResult.rows.map((r) => ({
    sector_name: r.sector_name,
    total_value: Number(r.total_value),
    pct: sectorTotal > 0 ? (Number(r.total_value) / sectorTotal) * 100 : 0,
  }));

  // 2. Geographic allocation (derived from sector exposure splits)
  const geoMap: Record<string, number> = {};
  for (const sector of sectorAllocation) {
    const splits = SECTOR_GEO_SPLIT[sector.sector_name] ?? { "South Africa": 1.0 };
    for (const [region, weight] of Object.entries(splits)) {
      geoMap[region] = (geoMap[region] ?? 0) + sector.total_value * weight;
    }
  }
  const geoTotal = Object.values(geoMap).reduce((s, v) => s + v, 0);
  const geographicAllocation: GeographicAllocation[] = Object.entries(geoMap)
    .map(([region, total_value]) => ({
      region,
      total_value,
      pct: geoTotal > 0 ? (total_value / geoTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total_value - a.total_value);

  // 3. Risk vs Return scatter (1Y period)
  const riskReturnResult = await sql<{
    fund_name: string;
    return_1y: string;
    std_dev: string;
    sector_name: string;
    fund_size: string;
  }>`
    SELECT DISTINCT ON (f.fund_id)
      f.fund_name,
      (fp.return_annualized * 100)::text AS return_1y,
      (fr.std_dev_annualized * 100)::text AS std_dev,
      s.sector_name,
      f.fund_size::text AS fund_size
    FROM fund_holding fh
    JOIN wrapper w ON w.wrapper_id = fh.wrapper_id
    JOIN client c ON c.client_id = w.client_id
    JOIN fund f ON f.fund_id = fh.fund_id
    JOIN sector s ON s.sector_id = f.sector_id
    JOIN fund_performance_fact fp ON fp.fund_id = f.fund_id
    JOIN period_definition pd ON pd.period_id = fp.period_id AND pd.period_code = '1Y'
    JOIN fund_risk_fact fr ON fr.fund_id = f.fund_id AND fr.period_id = fp.period_id
    WHERE c.advisor_id = ${advisorId}
    ORDER BY f.fund_id
  `;

  const riskReturn: RiskReturnPoint[] = riskReturnResult.rows.map((r) => ({
    fund_name: r.fund_name,
    return_1y: Number(r.return_1y),
    std_dev: Number(r.std_dev),
    sector_name: r.sector_name,
    fund_size: Number(r.fund_size),
  }));

  // 4. Top 10 holdings by value
  const holdingsResult = await sql<{
    fund_name: string;
    total_value: string;
    sector_name: string;
  }>`
    SELECT f.fund_name, SUM(fh.current_value)::text AS total_value, s.sector_name
    FROM fund_holding fh
    JOIN wrapper w ON w.wrapper_id = fh.wrapper_id
    JOIN client c ON c.client_id = w.client_id
    JOIN fund f ON f.fund_id = fh.fund_id
    JOIN sector s ON s.sector_id = f.sector_id
    WHERE c.advisor_id = ${advisorId}
    GROUP BY f.fund_name, s.sector_name
    ORDER BY SUM(fh.current_value) DESC
    LIMIT 10
  `;

  const holdingsTotal = holdingsResult.rows.reduce((sum, r) => sum + Number(r.total_value), 0);
  const topHoldings: HoldingConcentration[] = holdingsResult.rows.map((r) => ({
    fund_name: r.fund_name,
    total_value: Number(r.total_value),
    pct: holdingsTotal > 0 ? (Number(r.total_value) / holdingsTotal) * 100 : 0,
    sector_name: r.sector_name,
  }));

  // 5. Fee vs Return scatter
  const feeResult = await sql<{
    fund_name: string;
    management_fee_pct: string;
    return_1y_pct: string;
    sector_name: string;
  }>`
    SELECT DISTINCT ON (f.fund_id)
      f.fund_name,
      (f.management_fee * 100)::text AS management_fee_pct,
      (fp.return_annualized * 100)::text AS return_1y_pct,
      s.sector_name
    FROM fund_holding fh
    JOIN wrapper w ON w.wrapper_id = fh.wrapper_id
    JOIN client c ON c.client_id = w.client_id
    JOIN fund f ON f.fund_id = fh.fund_id
    JOIN sector s ON s.sector_id = f.sector_id
    JOIN fund_performance_fact fp ON fp.fund_id = f.fund_id
    JOIN period_definition pd ON pd.period_id = fp.period_id AND pd.period_code = '1Y'
    WHERE c.advisor_id = ${advisorId}
    ORDER BY f.fund_id
  `;

  const feeVsReturn: FeeComparison[] = feeResult.rows.map((r) => ({
    fund_name: r.fund_name,
    management_fee_pct: Number(r.management_fee_pct),
    return_1y_pct: Number(r.return_1y_pct),
    sector_name: r.sector_name,
  }));

  return { sectorAllocation, geographicAllocation, riskReturn, topHoldings, feeVsReturn };
}
