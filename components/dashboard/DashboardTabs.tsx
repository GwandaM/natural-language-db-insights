"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { InsightChart } from "./InsightChart";
import { DeepDives } from "./DeepDives";
import { DashboardInsights } from "@/lib/insights";
import { AdvisorBookStats } from "@/lib/advisor-data";
import { DeepDiveData } from "@/lib/chart-data";

const pct  = (v: string | number) => `${Number(v).toFixed(1)}%`;
const shorten = (len: number) => (v: string | number) => {
  const s = String(v);
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
};

interface Props {
  bookStats: AdvisorBookStats;
  fundInsights: DashboardInsights | null;
  deepDiveData: DeepDiveData | null;
}

export function DashboardTabs({ bookStats, fundInsights, deepDiveData }: Props) {
  return (
    <Tabs.Root defaultValue="book" className="space-y-4">
      <Tabs.List className="flex gap-1 border-b border-border">
        {[
          { value: "book",  label: "Book of Business" },
          { value: "funds", label: "Fund Analytics" },
          { value: "deep",  label: "Deep Dives" },
        ].map(({ value, label }) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className="relative px-4 py-2.5 text-sm font-medium transition-colors
              text-muted-foreground hover:text-foreground
              data-[state=active]:text-primary
              data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-[hsl(var(--brand-teal))]"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {/* ── Book of Business (advisor-scoped) ── */}
      <Tabs.Content value="book" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightChart
            title="Client Risk Profile Breakdown"
            caption="Distribution of risk profiles across this advisor's clients."
            data={bookStats.risk_profile_breakdown as unknown as Record<string, string | number>[]}
            xKey="risk_profile"
            yKey="count"
            type="bar"
          />
          <InsightChart
            title="Policy Type Distribution"
            caption="Breakdown of policy types held by this advisor's clients."
            data={bookStats.policy_type_distribution as unknown as Record<string, string | number>[]}
            xKey="policy_type"
            yKey="count"
            type="bar"
            xTickFormatter={shorten(14)}
          />
        </div>

        <InsightChart
          title="Transaction Activity (Last 12 Months)"
          caption="Monthly transaction volume for this advisor's book of business."
          data={bookStats.transaction_activity as unknown as Record<string, string | number>[]}
          xKey="month"
          yKey="tx_count"
          type="line"
        />
      </Tabs.Content>

      {/* ── Fund Analytics (firm-wide cached) ── */}
      <Tabs.Content value="funds" className="space-y-4">
        {!fundInsights ? (
          <p className="text-sm text-muted-foreground">Fund analytics are loading — check back shortly.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InsightChart
                title="Top 10 Funds — 1Y Return (%)"
                caption={fundInsights.top_funds_1y.caption}
                data={fundInsights.top_funds_1y.data as unknown as Record<string, string | number>[]}
                xKey="fund_name"
                yKey="return_1y_pct"
                type="bar"
                yTickFormatter={pct}
                xTickFormatter={shorten(16)}
              />
              <InsightChart
                title="Average Sharpe Ratio by Sector (3Y)"
                caption={fundInsights.sharpe_by_sector.caption}
                data={fundInsights.sharpe_by_sector.data as unknown as Record<string, string | number>[]}
                xKey="sector_name"
                yKey="avg_sharpe"
                type="bar"
              />
            </div>

            <InsightChart
              title="Net Fund Flows by Peer Group — 1Y (R millions)"
              caption={fundInsights.flows_by_peer_group.caption}
              data={fundInsights.flows_by_peer_group.data as unknown as Record<string, string | number>[]}
              xKey="peer_group_name"
              yKey="net_flow_m"
              type="bar"
              xTickFormatter={shorten(16)}
              yTickFormatter={(v) => `R${Number(v).toFixed(0)}M`}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InsightChart
                title="Q1 (Top Quartile) Funds per Peer Group"
                caption={fundInsights.quartile_distribution.caption}
                data={fundInsights.quartile_distribution.data as unknown as Record<string, string | number>[]}
                xKey="peer_group_name"
                yKey="q1"
                type="bar"
                xTickFormatter={shorten(14)}
              />
              <InsightChart
                title="Morningstar Rating Distribution"
                caption={fundInsights.morningstar_distribution.caption}
                data={(fundInsights.morningstar_distribution.data as unknown as { rating: number; count: number }[]).map((r) => ({
                  rating: `${r.rating}★`,
                  count: r.count,
                }))}
                xKey="rating"
                yKey="count"
                type="bar"
              />
            </div>
          </>
        )}
      </Tabs.Content>

      {/* ── Deep Dives (advisor-scoped analytics) ── */}
      <Tabs.Content value="deep" className="space-y-4">
        {deepDiveData ? (
          <DeepDives data={deepDiveData} />
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Deep dive analytics are loading — check back shortly.
          </p>
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}
