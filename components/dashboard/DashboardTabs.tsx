"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { InsightChart } from "./InsightChart";
import { RankedList } from "./RankedList";
import { DashboardInsights } from "@/lib/insights";

const zarM = (v: string | number) => `R${(Number(v) / 1e6).toFixed(1)}M`;
const zarK = (v: string | number) => `R${(Number(v) / 1e3).toFixed(0)}K`;
const pct  = (v: string | number) => `${Number(v).toFixed(1)}%`;
const shorten = (len: number) => (v: string | number) => {
  const s = String(v);
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
};

interface Props {
  insights: DashboardInsights;
}

export function DashboardTabs({ insights }: Props) {
  return (
    <Tabs.Root defaultValue="book" className="space-y-4">
      <Tabs.List className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {[
          { value: "book",  label: "Book of Business" },
          { value: "funds", label: "Fund Analytics" },
        ].map(({ value, label }) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors
              text-muted-foreground hover:text-foreground
              data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {/* ── Book of Business ── */}
      <Tabs.Content value="book" className="space-y-4">
        {/* AUM by Advisor */}
        <InsightChart
          title="AUM by Advisor"
          caption={insights.aum_by_advisor.caption}
          data={insights.aum_by_advisor.data as unknown as Record<string, string | number>[]}
          xKey="advisor_name"
          yKey="total_aum"
          type="bar"
          yTickFormatter={zarM}
          xTickFormatter={shorten(14)}
        />

        {/* Risk profiles + Policy types */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightChart
            title="Client Risk Profile Breakdown"
            caption={insights.risk_profile_breakdown.caption}
            data={insights.risk_profile_breakdown.data as unknown as Record<string, string | number>[]}
            xKey="risk_profile"
            yKey="count"
            type="bar"
          />
          <InsightChart
            title="Policy Type Distribution"
            caption={insights.policy_type_distribution.caption}
            data={insights.policy_type_distribution.data as unknown as Record<string, string | number>[]}
            xKey="policy_type"
            yKey="count"
            type="bar"
            xTickFormatter={shorten(14)}
          />
        </div>

        {/* Transaction activity */}
        <InsightChart
          title="Transaction Activity (Last 12 Months)"
          caption={insights.transaction_activity.caption}
          data={insights.transaction_activity.data as unknown as Record<string, string | number>[]}
          xKey="month"
          yKey="tx_count"
          type="line"
        />

        {/* Top clients + At-risk clients */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RankedList
            title="Top 10 Clients by Portfolio Value"
            caption={insights.top_clients.caption}
            items={(insights.top_clients.data as unknown as { client_name: string; total_value: number }[]).map((r) => ({
              label: r.client_name,
              value: Math.round(r.total_value / 1000),
            }))}
            valueLabel="kZAR"
          />
          <RankedList
            title="At-Risk Clients (Dormant / Inactive)"
            caption={insights.at_risk_clients.caption}
            items={(insights.at_risk_clients.data as unknown as { client_name: string; status: string; total_value: number }[]).map((r) => ({
              label: r.client_name,
              value: Math.round(r.total_value / 1000),
              sub: r.status,
            }))}
            valueLabel="kZAR"
          />
        </div>
      </Tabs.Content>

      {/* ── Fund Analytics ── */}
      <Tabs.Content value="funds" className="space-y-4">
        {/* Top funds + Sharpe by sector */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightChart
            title="Top 10 Funds — 1Y Return (%)"
            caption={insights.top_funds_1y.caption}
            data={insights.top_funds_1y.data as unknown as Record<string, string | number>[]}
            xKey="fund_name"
            yKey="return_1y_pct"
            type="bar"
            yTickFormatter={pct}
            xTickFormatter={shorten(16)}
          />
          <InsightChart
            title="Average Sharpe Ratio by Sector (3Y)"
            caption={insights.sharpe_by_sector.caption}
            data={insights.sharpe_by_sector.data as unknown as Record<string, string | number>[]}
            xKey="sector_name"
            yKey="avg_sharpe"
            type="bar"
          />
        </div>

        {/* Net fund flows by peer group */}
        <InsightChart
          title="Net Fund Flows by Peer Group — 1Y (R millions)"
          caption={insights.flows_by_peer_group.caption}
          data={insights.flows_by_peer_group.data as unknown as Record<string, string | number>[]}
          xKey="peer_group_name"
          yKey="net_flow_m"
          type="bar"
          xTickFormatter={shorten(16)}
          yTickFormatter={(v) => `R${Number(v).toFixed(0)}M`}
        />

        {/* Quartile distribution + Morningstar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightChart
            title="Q1 (Top Quartile) Funds per Peer Group"
            caption={insights.quartile_distribution.caption}
            data={insights.quartile_distribution.data as unknown as Record<string, string | number>[]}
            xKey="peer_group_name"
            yKey="q1"
            type="bar"
            xTickFormatter={shorten(14)}
          />
          <InsightChart
            title="Morningstar Rating Distribution"
            caption={insights.morningstar_distribution.caption}
            data={(insights.morningstar_distribution.data as unknown as { rating: number; count: number }[]).map((r) => ({
              rating: `${r.rating}★`,
              count: r.count,
            }))}
            xKey="rating"
            yKey="count"
            type="bar"
          />
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
