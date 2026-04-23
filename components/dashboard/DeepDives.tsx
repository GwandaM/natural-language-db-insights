"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Globe2, PieChart as PieIcon, TrendingUp, BarChart3, DollarSign } from "lucide-react";
import { DeepDiveData } from "@/lib/chart-data";

// ---------------------------------------------------------------------------
// Shared palette & helpers
// ---------------------------------------------------------------------------

const SECTOR_COLORS: Record<string, string> = {
  "SA Equity":    "hsl(222, 64%, 24%)",
  "Multi-Asset":  "hsl(200, 95%, 42%)",
  "Fixed Income": "hsl(213, 77%, 58%)",
  "Money Market": "hsl(258, 60%, 64%)",
  "Real Estate":  "hsl(32, 89%, 60%)",
};

const GEO_COLORS: Record<string, string> = {
  "South Africa":    "hsl(222, 64%, 24%)",
  "North America":   "hsl(200, 95%, 42%)",
  "Europe":          "hsl(213, 77%, 58%)",
  "Asia Pacific":    "hsl(258, 60%, 64%)",
  "Rest of Africa":  "hsl(32, 89%, 60%)",
};

const PALETTE = [
  "hsl(222, 64%, 24%)",
  "hsl(200, 95%, 42%)",
  "hsl(213, 77%, 58%)",
  "hsl(258, 60%, 64%)",
  "hsl(32, 89%, 60%)",
  "hsl(170, 60%, 45%)",
  "hsl(340, 65%, 55%)",
  "hsl(45, 85%, 55%)",
  "hsl(280, 50%, 55%)",
  "hsl(15, 75%, 55%)",
];

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: 12,
};

// ---------------------------------------------------------------------------
// Chart card wrapper
// ---------------------------------------------------------------------------

function ChartCard({
  title,
  caption,
  icon: Icon,
  children,
}: {
  title: string;
  caption: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{caption}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Geographic Allocation — donut + region breakdown
// ---------------------------------------------------------------------------

function GeographicAllocationChart({ data }: { data: DeepDiveData["geographicAllocation"] }) {
  return (
    <ChartCard
      title="Geographic Allocation"
      caption="Estimated regional exposure derived from fund sector composition and Reg 28 offshore limits."
      icon={Globe2}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="pct"
              nameKey="region"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {data.map((entry) => (
                <Cell key={entry.region} fill={GEO_COLORS[entry.region] ?? "hsl(var(--muted))"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="space-y-2.5">
          {data.map((entry) => (
            <div key={entry.region} className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: GEO_COLORS[entry.region] ?? "hsl(var(--muted))" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{entry.region}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{entry.pct.toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(entry.pct, 100)}%`,
                      backgroundColor: GEO_COLORS[entry.region] ?? "hsl(var(--muted))",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 2. Sector Allocation — donut chart
// ---------------------------------------------------------------------------

function SectorAllocationChart({ data }: { data: DeepDiveData["sectorAllocation"] }) {
  return (
    <ChartCard
      title="Sector Allocation"
      caption="Book-wide allocation across ASISA sectors, by current market value."
      icon={PieIcon}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="pct"
              nameKey="sector_name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {data.map((entry) => (
                <Cell key={entry.sector_name} fill={SECTOR_COLORS[entry.sector_name] ?? "hsl(var(--muted))"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="space-y-2.5">
          {data.map((entry) => (
            <div key={entry.sector_name} className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: SECTOR_COLORS[entry.sector_name] ?? "hsl(var(--muted))" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{entry.sector_name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatZar(entry.total_value)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(entry.pct, 100)}%`,
                        backgroundColor: SECTOR_COLORS[entry.sector_name] ?? "hsl(var(--muted))",
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground w-12 text-right">{entry.pct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 3. Risk vs Return scatter
// ---------------------------------------------------------------------------

function RiskReturnChart({ data }: { data: DeepDiveData["riskReturn"] }) {
  const sectors = Array.from(new Set(data.map((d) => d.sector_name)));

  return (
    <ChartCard
      title="Risk vs Return (1Y)"
      caption="Each dot is a fund in the advisor's book. X = annualised volatility, Y = annualised return. Higher and left is better."
      icon={TrendingUp}
    >
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="std_dev"
            type="number"
            name="Volatility"
            unit="%"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            label={{ value: "Volatility (%)", position: "bottom", offset: -2, fontSize: 11, className: "fill-muted-foreground" }}
          />
          <YAxis
            dataKey="return_1y"
            type="number"
            name="Return"
            unit="%"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            label={{ value: "Return (%)", angle: -90, position: "insideLeft", offset: 16, fontSize: 11, className: "fill-muted-foreground" }}
          />
          <ZAxis dataKey="fund_size" range={[40, 400]} name="Fund Size" />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => {
              if (name === "Fund Size") return [formatZar(value), name];
              return [`${value.toFixed(1)}%`, name];
            }}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload;
              return point ? point.fund_name : "";
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
          {sectors.map((sector, i) => (
            <Scatter
              key={sector}
              name={sector}
              data={data.filter((d) => d.sector_name === sector)}
              fill={SECTOR_COLORS[sector] ?? PALETTE[i % PALETTE.length]}
              fillOpacity={0.8}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 4. Top 10 Holdings — horizontal bar
// ---------------------------------------------------------------------------

function TopHoldingsChart({ data }: { data: DeepDiveData["topHoldings"] }) {
  const chartData = data.map((d) => ({
    ...d,
    short_name: d.fund_name.length > 22 ? d.fund_name.slice(0, 21) + "…" : d.fund_name,
  }));

  return (
    <ChartCard
      title="Top 10 Holdings"
      caption="Largest fund positions across the advisor's client book by market value."
      icon={BarChart3}
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            tickFormatter={(v) => formatZar(v)}
          />
          <YAxis
            type="category"
            dataKey="short_name"
            width={140}
            tick={{ fontSize: 10 }}
            className="fill-muted-foreground"
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [formatZar(value), "Value"]}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload;
              return point ? `${point.fund_name} · ${point.sector_name}` : "";
            }}
          />
          <Bar dataKey="total_value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={entry.fund_name} fill={SECTOR_COLORS[entry.sector_name] ?? PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 5. Fee vs Return — scatter (cost-efficiency quadrant)
// ---------------------------------------------------------------------------

function FeeVsReturnChart({ data }: { data: DeepDiveData["feeVsReturn"] }) {
  const sectors = Array.from(new Set(data.map((d) => d.sector_name)));

  return (
    <ChartCard
      title="Fee Efficiency"
      caption="Management fee vs 1Y return. Top-left quadrant = high return, low cost — the sweet spot."
      icon={DollarSign}
    >
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="management_fee_pct"
            type="number"
            name="Fee"
            unit="%"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            label={{ value: "Management Fee (%)", position: "bottom", offset: -2, fontSize: 11, className: "fill-muted-foreground" }}
          />
          <YAxis
            dataKey="return_1y_pct"
            type="number"
            name="Return"
            unit="%"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            label={{ value: "1Y Return (%)", angle: -90, position: "insideLeft", offset: 16, fontSize: 11, className: "fill-muted-foreground" }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload;
              return point ? point.fund_name : "";
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
          {sectors.map((sector, i) => (
            <Scatter
              key={sector}
              name={sector}
              data={data.filter((d) => d.sector_name === sector)}
              fill={SECTOR_COLORS[sector] ?? PALETTE[i % PALETTE.length]}
              fillOpacity={0.8}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface DeepDivesProps {
  data: DeepDiveData;
}

export function DeepDives({ data }: DeepDivesProps) {
  if (data.sectorAllocation.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No holding data available for deep dive analytics.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Geographic + Sector donuts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GeographicAllocationChart data={data.geographicAllocation} />
        <SectorAllocationChart data={data.sectorAllocation} />
      </div>

      {/* Row 2: Risk vs Return (full width) */}
      <RiskReturnChart data={data.riskReturn} />

      {/* Row 3: Top Holdings + Fee Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopHoldingsChart data={data.topHoldings} />
        <FeeVsReturnChart data={data.feeVsReturn} />
      </div>
    </div>
  );
}
